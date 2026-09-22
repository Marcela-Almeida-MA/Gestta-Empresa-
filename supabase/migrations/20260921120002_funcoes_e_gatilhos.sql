-- =====================================================================
-- MIGRATION 2 · FUNÇÕES AUXILIARES, GATILHOS E FUNÇÕES DE NEGÓCIO
--
-- Os erros de regra de negócio começam com um CÓDIGO em maiúsculas
-- (ex.: 'SALDO_INSUFICIENTE: ...') para o backend traduzir para HTTP 422.
-- =====================================================================


-- =====================================================================
-- 1. FUNÇÕES AUXILIARES DE SEGURANÇA (usadas nas políticas de RLS)
-- =====================================================================

-- Empresas das quais o usuário logado participa.
-- security definer: lê membros_empresa ignorando o RLS, o que evita recursão
-- infinita (a própria política de membros_empresa usa esta função).
create or replace function public.empresas_do_usuario()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select empresa_id from public.membros_empresa where usuario_id = auth.uid()
$$;

-- Papel do usuário logado em uma empresa: 'admin', 'operador' ou NULL (não participa).
create or replace function public.papel_na_empresa(p_empresa uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select papel from public.membros_empresa
   where empresa_id = p_empresa and usuario_id = auth.uid()
$$;

-- Atalho: o usuário logado é admin desta empresa?
create or replace function public.eh_admin_da_empresa(p_empresa uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce(public.papel_na_empresa(p_empresa) = 'admin', false)
$$;


-- =====================================================================
-- 2. PERFIL AUTOMÁTICO AO CADASTRAR USUÁRIO
-- =====================================================================

create or replace function public.criar_perfil_ao_cadastrar()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome)
  values (
    new.id,
    -- usa o nome enviado no cadastro; se não houver, usa a parte inicial do e-mail
    coalesce(new.raw_user_meta_data ->> 'nome', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger trg_auth_users_criar_perfil
  after insert on auth.users
  for each row execute function public.criar_perfil_ao_cadastrar();

-- Usuários que já existiam antes desta migration (em projeto novo não há nenhum)
insert into public.perfis (id, nome)
select id, split_part(email, '@', 1) from auth.users
on conflict (id) do nothing;


-- =====================================================================
-- 3. GATILHOS GENÉRICOS
-- =====================================================================

-- Atualiza a coluna atualizado_em a cada alteração.
create or replace function public.definir_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- Impede "mudar" uma linha de uma empresa para outra.
create or replace function public.impedir_troca_de_empresa()
returns trigger
language plpgsql
as $$
begin
  if new.empresa_id is distinct from old.empresa_id then
    raise exception 'EMPRESA_IMUTAVEL: não é permitido mover o registro para outra empresa';
  end if;
  return new;
end;
$$;

-- Aplica o gatilho acima em todas as tabelas de negócio que têm empresa_id editável.
do $$
declare
  v_tabela text;
begin
  foreach v_tabela in array array[
    'membros_empresa', 'categorias', 'produtos', 'despesas_fixas',
    'despesas_adicionais_produto', 'precificacoes'
  ] loop
    execute format(
      'create trigger trg_%1$s_sem_troca_empresa
         before update on public.%1$s
         for each row execute function public.impedir_troca_de_empresa()',
      v_tabela);
  end loop;
end;
$$;


-- =====================================================================
-- 4. PRODUTOS: regras do saldo
-- =====================================================================

create trigger trg_produtos_atualizado_em
  before update on public.produtos
  for each row execute function public.definir_atualizado_em();

-- Todo produto nasce com saldo ZERO. O estoque inicial entra como uma
-- movimentação (motivo 'estoque_inicial'), assim o histórico fica completo.
create or replace function public.zerar_saldo_ao_criar_produto()
returns trigger
language plpgsql
as $$
begin
  new.quantidade_atual := 0;
  return new;
end;
$$;

create trigger trg_produtos_saldo_inicial
  before insert on public.produtos
  for each row execute function public.zerar_saldo_ao_criar_produto();

-- Bloqueia a edição direta do saldo.
-- pg_trigger_depth() < 2 significa que o UPDATE veio diretamente do usuário.
-- Quando a alteração vem do gatilho de movimentações (seção 5), a profundidade é 2.
create or replace function public.proteger_saldo_do_produto()
returns trigger
language plpgsql
as $$
begin
  if new.quantidade_atual is distinct from old.quantidade_atual
     and pg_trigger_depth() < 2 then
    raise exception 'ESTOQUE_SOMENTE_POR_MOVIMENTACAO: o saldo só pode mudar por entradas e saídas';
  end if;
  return new;
end;
$$;

create trigger trg_produtos_proteger_saldo
  before update of quantidade_atual on public.produtos
  for each row execute function public.proteger_saldo_do_produto();


-- =====================================================================
-- 5. MOVIMENTAÇÕES: validação e atualização do saldo
-- =====================================================================

-- ANTES de gravar: valida o produto e completa campos automáticos.
create or replace function public.preparar_movimentacao()
returns trigger
language plpgsql
as $$
declare
  v_ativo  boolean;
  v_custo  numeric(12,2);
begin
  -- O RLS já garante que só enxergamos produtos de empresas em que o usuário participa.
  select ativo, custo_unitario
    into v_ativo, v_custo
    from public.produtos
   where id = new.produto_id and empresa_id = new.empresa_id;

  if not found then
    raise exception 'PRODUTO_NAO_ENCONTRADO: produto inexistente ou de outra empresa';
  end if;
  if not v_ativo then
    raise exception 'PRODUTO_INATIVO: não é possível movimentar um produto inativo';
  end if;

  -- Guarda o custo do produto no momento da operação (usado no lucro bruto)
  new.custo_unitario := v_custo;

  -- Quem fez a operação é sempre o usuário logado (não confia no valor enviado)
  if auth.uid() is not null then
    new.criado_por := auth.uid();
  end if;

  return new;
end;
$$;

create trigger trg_movimentacoes_preparar
  before insert on public.movimentacoes
  for each row execute function public.preparar_movimentacao();

-- DEPOIS de gravar: atualiza o saldo do produto, na MESMA transação.
-- security definer: o operador pode registrar movimentações, mas não tem permissão
-- de editar produtos. A permissão para chegar até aqui já foi conferida pela política
-- de INSERT da movimentação.
-- A saída usa "update ... where quantidade_atual >= qtd": o banco trava a linha, então
-- duas saídas simultâneas nunca deixam o saldo negativo.
create or replace function public.aplicar_movimentacao_no_estoque()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if new.tipo = 'entrada' then
    update public.produtos
       set quantidade_atual = quantidade_atual + new.quantidade
     where id = new.produto_id;
  else
    update public.produtos
       set quantidade_atual = quantidade_atual - new.quantidade
     where id = new.produto_id
       and quantidade_atual >= new.quantidade;

    if not found then
      raise exception 'SALDO_INSUFICIENTE: a quantidade solicitada é maior que o saldo em estoque';
    end if;
  end if;
  return null;  -- gatilho AFTER: o retorno é ignorado
end;
$$;

create trigger trg_movimentacoes_aplicar_estoque
  after insert on public.movimentacoes
  for each row execute function public.aplicar_movimentacao_no_estoque();

-- Função de conveniência para o backend registrar uma movimentação.
-- security invoker (padrão): respeita o RLS do usuário que chamou.
create or replace function public.registrar_movimentacao(
  p_produto_id      uuid,
  p_tipo            text,
  p_quantidade      integer,
  p_valor_unitario  numeric,
  p_motivo          text,
  p_observacao      text default null
) returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_empresa uuid;
  v_id      uuid;
begin
  -- A empresa vem do próprio produto (o RLS só mostra produtos das empresas do usuário)
  select empresa_id into v_empresa from public.produtos where id = p_produto_id;
  if not found then
    raise exception 'PRODUTO_NAO_ENCONTRADO: produto inexistente ou sem acesso';
  end if;

  insert into public.movimentacoes
    (empresa_id, produto_id, tipo, motivo, quantidade, valor_unitario, observacao)
  values
    (v_empresa, p_produto_id, p_tipo, p_motivo, p_quantidade,
     coalesce(p_valor_unitario, 0), p_observacao)
  returning id into v_id;

  return v_id;
end;
$$;


-- =====================================================================
-- 6. MEMBROS: toda empresa precisa ter pelo menos um admin
-- =====================================================================

create or replace function public.garantir_ultimo_admin()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  -- Exclusão da empresa inteira (função excluir_empresa): liberado
  if tg_op = 'DELETE'
     and current_setting('app.excluindo_empresa', true) = old.empresa_id::text then
    return old;
  end if;

  -- Removendo um admin, ou rebaixando um admin para operador?
  if old.papel = 'admin' and (tg_op = 'DELETE' or new.papel <> 'admin') then
    if not exists (
      select 1 from public.membros_empresa
       where empresa_id = old.empresa_id and papel = 'admin' and id <> old.id
    ) then
      raise exception 'ULTIMO_ADMIN: a empresa precisa ter pelo menos um admin';
    end if;
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create trigger trg_membros_ultimo_admin
  before update or delete on public.membros_empresa
  for each row execute function public.garantir_ultimo_admin();


-- =====================================================================
-- 7. CADASTRO E EXCLUSÃO DE EMPRESA
-- =====================================================================

-- Cria a empresa, torna o usuário logado ADMIN e cria a configuração de
-- precificação, tudo em uma única transação. Não precisa de service_role.
-- Pode ser chamada várias vezes: uma pessoa pode ter várias empresas.
create or replace function public.criar_empresa(
  p_nome                    text,
  p_unidades_mes_estimadas  integer,
  p_documento               text default null
) returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_usuario uuid := auth.uid();
  v_empresa uuid;
begin
  if v_usuario is null then
    raise exception 'NAO_AUTENTICADO: faça login para criar uma empresa' using errcode = '42501';
  end if;
  if p_nome is null or length(trim(p_nome)) = 0 then
    raise exception 'NOME_OBRIGATORIO: informe o nome da empresa';
  end if;
  if p_unidades_mes_estimadas is null or p_unidades_mes_estimadas < 1 then
    raise exception 'ESTIMATIVA_INVALIDA: informe uma estimativa de vendas por mês (mínimo 1)';
  end if;

  insert into public.empresas (nome, documento)
  values (trim(p_nome), nullif(trim(coalesce(p_documento, '')), ''))
  returning id into v_empresa;

  insert into public.membros_empresa (empresa_id, usuario_id, papel)
  values (v_empresa, v_usuario, 'admin');

  insert into public.configuracoes_precificacao (empresa_id, unidades_mes_estimadas)
  values (v_empresa, p_unidades_mes_estimadas);

  return v_empresa;
end;
$$;

-- Exclui a empresa e TODOS os dados dela (somente admin).
-- Apaga na ordem certa por causa das chaves estrangeiras.
-- ATENÇÃO: as fotos no Storage NÃO são apagadas aqui (apagar arquivos por SQL deixa
-- o arquivo órfão). O backend deve remover a pasta {empresa_id}/ pela API do Storage
-- ANTES de chamar esta função.
create or replace function public.excluir_empresa(p_empresa uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.eh_admin_da_empresa(p_empresa) then
    raise exception 'ACESSO_NEGADO: apenas o admin pode excluir a empresa' using errcode = '42501';
  end if;

  -- libera a remoção do último admin apenas nesta transação
  perform set_config('app.excluindo_empresa', p_empresa::text, true);

  delete from public.precificacoes               where empresa_id = p_empresa;
  delete from public.despesas_adicionais_produto where empresa_id = p_empresa;
  delete from public.movimentacoes               where empresa_id = p_empresa;
  delete from public.produtos                    where empresa_id = p_empresa;
  delete from public.categorias                  where empresa_id = p_empresa;
  delete from public.despesas_fixas              where empresa_id = p_empresa;
  delete from public.configuracoes_precificacao  where empresa_id = p_empresa;
  -- a exclusão da empresa apaga também os membros (on delete cascade)
  delete from public.empresas                    where id = p_empresa;
end;
$$;


-- =====================================================================
-- 8. APOIO À PRECIFICAÇÃO
-- (a fórmula em si fica no backend, na classe de domínio CalculadoraDePreco)
-- =====================================================================

-- Soma das despesas fixas mensais ativas da empresa.
create or replace function public.despesas_fixas_mensais(p_empresa uuid)
returns numeric
language sql stable
set search_path = public
as $$
  select coalesce(sum(valor_mensal), 0)
    from public.despesas_fixas
   where empresa_id = p_empresa and ativo
$$;

-- Unidades a usar no rateio das despesas fixas:
--   * vendas reais (saídas com motivo 'venda') no período configurado, se houver;
--   * caso contrário (ou se usar_vendas_reais = false), a estimativa da empresa.
-- É da empresa inteira, pois as despesas fixas são pagas por todos os produtos.
create or replace function public.unidades_mes_para_rateio(p_empresa uuid)
returns integer
language plpgsql stable
set search_path = public
as $$
declare
  v_config  public.configuracoes_precificacao%rowtype;
  v_vendas  bigint;
begin
  select * into v_config
    from public.configuracoes_precificacao where empresa_id = p_empresa;
  if not found then
    raise exception 'CONFIGURACAO_NAO_ENCONTRADA: empresa sem configuração de precificação';
  end if;

  if v_config.usar_vendas_reais then
    select coalesce(sum(quantidade), 0) into v_vendas
      from public.movimentacoes
     where empresa_id = p_empresa
       and tipo = 'saida' and motivo = 'venda'
       and criado_em >= now() - make_interval(days => v_config.periodo_vendas_dias);

    if v_vendas > 0 then
      return v_vendas::integer;
    end if;
  end if;

  return v_config.unidades_mes_estimadas;
end;
$$;
