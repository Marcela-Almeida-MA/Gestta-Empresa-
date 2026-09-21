-- =====================================================================
-- MIGRATION 5 · DASHBOARD (entradas e saídas)
--
-- Os cálculos rodam no banco, em funções com "security invoker": o RLS do
-- usuário continua valendo. Toda função recebe o id da empresa (o usuário pode
-- ter várias) e recusa quem não participa dela.
--
-- Valores em R$ (receita, custo, lucro) só são devolvidos para ADMIN.
-- Para o operador esses campos voltam NULL; as unidades voltam normalmente.
--
-- Os períodos usam datas do fuso America/Sao_Paulo: de 00:00 do dia inicial
-- até 23:59:59 do dia final (inclusive).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Apoio
-- ---------------------------------------------------------------------

-- Início do dia (00:00) no fuso de São Paulo, como timestamptz.
create or replace function public.inicio_do_dia(p_data date)
returns timestamptz
language sql stable
as $$
  select p_data::timestamp at time zone 'America/Sao_Paulo'
$$;

-- Devolve o papel do usuário na empresa ou recusa o acesso.
create or replace function public.exigir_papel(p_empresa uuid)
returns text
language plpgsql stable
set search_path = public
as $$
declare
  v_papel text;
begin
  v_papel := public.papel_na_empresa(p_empresa);
  if v_papel is null then
    raise exception 'ACESSO_NEGADO: você não participa desta empresa' using errcode = '42501';
  end if;
  return v_papel;
end;
$$;


-- ---------------------------------------------------------------------
-- RESUMO: cartões do dashboard
-- ---------------------------------------------------------------------
create or replace function public.dashboard_resumo(
  p_empresa       uuid,
  p_de            date,
  p_ate           date,
  p_categoria_id  uuid default null
)
returns table (
  unidades_entrada       bigint,
  unidades_saida         bigint,
  saldo_unidades         bigint,
  produtos_estoque_baixo bigint,
  total_entradas         numeric,   -- R$ (só admin)
  total_saidas           numeric,   -- R$ (só admin)
  valor_em_estoque       numeric,   -- R$ (só admin)
  lucro_bruto            numeric    -- R$ (só admin)
)
language plpgsql stable
set search_path = public
as $$
#variable_conflict use_column
declare
  v_admin boolean := (public.exigir_papel(p_empresa) = 'admin');
begin
  if p_de > p_ate then
    raise exception 'PERIODO_INVALIDO: a data inicial é maior que a final';
  end if;

  return query
  with mov as (
    -- movimentações do período (e da categoria, se filtrada)
    select m.tipo, m.motivo, m.quantidade, m.valor_unitario, m.custo_unitario
      from public.movimentacoes m
      join public.produtos p on p.id = m.produto_id
     where m.empresa_id = p_empresa
       and m.criado_em >= public.inicio_do_dia(p_de)
       and m.criado_em <  public.inicio_do_dia(p_ate + 1)
       and (p_categoria_id is null or p.categoria_id = p_categoria_id)
  ),
  est as (
    -- situação atual do estoque (não depende do período)
    select count(*) filter (where p.quantidade_atual <= p.estoque_minimo) as baixos,
           sum(p.quantidade_atual * p.custo_unitario)                     as valor
      from public.produtos p
     where p.empresa_id = p_empresa and p.ativo
       and (p_categoria_id is null or p.categoria_id = p_categoria_id)
  )
  select
    coalesce(sum(mov.quantidade) filter (where mov.tipo = 'entrada'), 0)::bigint,
    coalesce(sum(mov.quantidade) filter (where mov.tipo = 'saida'), 0)::bigint,
    (coalesce(sum(mov.quantidade) filter (where mov.tipo = 'entrada'), 0)
     - coalesce(sum(mov.quantidade) filter (where mov.tipo = 'saida'), 0))::bigint,
    (select est.baixos from est)::bigint,
    case when v_admin then
      coalesce(sum(mov.quantidade * mov.valor_unitario) filter (where mov.tipo = 'entrada'), 0)
    end,
    case when v_admin then
      coalesce(sum(mov.quantidade * mov.valor_unitario) filter (where mov.tipo = 'saida'), 0)
    end,
    case when v_admin then coalesce((select est.valor from est), 0) end,
    -- lucro bruto = receita das vendas - custo das mercadorias vendidas
    case when v_admin then
      coalesce(sum(mov.quantidade * (mov.valor_unitario - mov.custo_unitario))
               filter (where mov.tipo = 'saida' and mov.motivo = 'venda'), 0)
    end
  from mov;
end;
$$;


-- ---------------------------------------------------------------------
-- ENTRADAS x SAÍDAS POR PERÍODO: dados do gráfico
-- p_agrupar: 'dia', 'semana' ou 'mes'.
-- Só devolve períodos que tiveram movimentação (o front preenche os vazios).
-- ---------------------------------------------------------------------
create or replace function public.dashboard_movimentacao_periodo(
  p_empresa       uuid,
  p_de            date,
  p_ate           date,
  p_agrupar       text default 'dia',
  p_categoria_id  uuid default null
)
returns table (
  periodo          date,
  unidades_entrada bigint,
  unidades_saida   bigint,
  valor_entrada    numeric,   -- R$ (só admin)
  valor_saida      numeric    -- R$ (só admin)
)
language plpgsql stable
set search_path = public
as $$
#variable_conflict use_column
declare
  v_admin   boolean := (public.exigir_papel(p_empresa) = 'admin');
  v_unidade text := case p_agrupar
                      when 'dia' then 'day'
                      when 'semana' then 'week'
                      when 'mes' then 'month'
                    end;
begin
  if v_unidade is null then
    raise exception 'AGRUPAMENTO_INVALIDO: use dia, semana ou mes';
  end if;
  if p_de > p_ate then
    raise exception 'PERIODO_INVALIDO: a data inicial é maior que a final';
  end if;

  return query
  select
    date_trunc(v_unidade, m.criado_em at time zone 'America/Sao_Paulo')::date,
    coalesce(sum(m.quantidade) filter (where m.tipo = 'entrada'), 0)::bigint,
    coalesce(sum(m.quantidade) filter (where m.tipo = 'saida'), 0)::bigint,
    case when v_admin then
      coalesce(sum(m.quantidade * m.valor_unitario) filter (where m.tipo = 'entrada'), 0)
    end,
    case when v_admin then
      coalesce(sum(m.quantidade * m.valor_unitario) filter (where m.tipo = 'saida'), 0)
    end
  from public.movimentacoes m
  join public.produtos p on p.id = m.produto_id
  where m.empresa_id = p_empresa
    and m.criado_em >= public.inicio_do_dia(p_de)
    and m.criado_em <  public.inicio_do_dia(p_ate + 1)
    and (p_categoria_id is null or p.categoria_id = p_categoria_id)
  group by 1
  order by 1;
end;
$$;


-- ---------------------------------------------------------------------
-- RANKING DE PRODUTOS
-- p_tipo: 'saida' (mais vendidos/saídos) ou 'entrada' (mais repostos).
-- ---------------------------------------------------------------------
create or replace function public.dashboard_ranking_produtos(
  p_empresa  uuid,
  p_tipo     text,
  p_de       date,
  p_ate      date,
  p_limite   integer default 10
)
returns table (
  produto_id      uuid,
  nome            text,
  categoria_nome  text,
  unidades        bigint,
  valor           numeric   -- R$ (só admin)
)
language plpgsql stable
set search_path = public
as $$
#variable_conflict use_column
declare
  v_admin boolean := (public.exigir_papel(p_empresa) = 'admin');
begin
  if p_tipo not in ('entrada', 'saida') then
    raise exception 'TIPO_INVALIDO: use entrada ou saida';
  end if;
  if p_de > p_ate then
    raise exception 'PERIODO_INVALIDO: a data inicial é maior que a final';
  end if;

  return query
  select
    p.id,
    p.nome,
    c.nome,
    sum(m.quantidade)::bigint,
    case when v_admin then sum(m.quantidade * m.valor_unitario) end
  from public.movimentacoes m
  join public.produtos p on p.id = m.produto_id
  left join public.categorias c on c.id = p.categoria_id
  where m.empresa_id = p_empresa
    and m.tipo = p_tipo
    and m.criado_em >= public.inicio_do_dia(p_de)
    and m.criado_em <  public.inicio_do_dia(p_ate + 1)
  group by p.id, p.nome, c.nome
  order by 4 desc, 2
  limit greatest(least(p_limite, 100), 1);
end;
$$;


-- ---------------------------------------------------------------------
-- POR CATEGORIA: movimentação do período + estoque atual de cada categoria
-- Inclui a linha "Sem categoria" (categoria_id nulo).
-- ---------------------------------------------------------------------
create or replace function public.dashboard_por_categoria(
  p_empresa  uuid,
  p_de       date,
  p_ate      date
)
returns table (
  categoria_id         uuid,
  categoria_nome       text,
  cor                  text,
  ativo                boolean,
  unidades_entrada     bigint,
  unidades_saida       bigint,
  unidades_em_estoque  bigint,
  valor_saida          numeric   -- R$ (só admin)
)
language plpgsql stable
set search_path = public
as $$
#variable_conflict use_column
declare
  v_admin boolean := (public.exigir_papel(p_empresa) = 'admin');
begin
  if p_de > p_ate then
    raise exception 'PERIODO_INVALIDO: a data inicial é maior que a final';
  end if;

  return query
  with base as (
    -- todas as categorias da empresa + a linha "Sem categoria"
    select c.id as cid, c.nome as cnome, c.cor as ccor, c.ativo as cativo
      from public.categorias c
     where c.empresa_id = p_empresa
    union all
    select null::uuid, 'Sem categoria'::text, null::text, true
  ),
  mov as (
    select p.categoria_id as cid,
           coalesce(sum(m.quantidade) filter (where m.tipo = 'entrada'), 0) as ent,
           coalesce(sum(m.quantidade) filter (where m.tipo = 'saida'), 0)   as sai,
           coalesce(sum(m.quantidade * m.valor_unitario) filter (where m.tipo = 'saida'), 0) as val_sai
      from public.movimentacoes m
      join public.produtos p on p.id = m.produto_id
     where m.empresa_id = p_empresa
       and m.criado_em >= public.inicio_do_dia(p_de)
       and m.criado_em <  public.inicio_do_dia(p_ate + 1)
     group by p.categoria_id
  ),
  est as (
    select p.categoria_id as cid, sum(p.quantidade_atual) as un
      from public.produtos p
     where p.empresa_id = p_empresa and p.ativo
     group by p.categoria_id
  )
  select
    b.cid,
    b.cnome,
    b.ccor,
    b.cativo,
    coalesce(mov.ent, 0)::bigint,
    coalesce(mov.sai, 0)::bigint,
    coalesce(est.un, 0)::bigint,
    case when v_admin then coalesce(mov.val_sai, 0) end
  from base b
  left join mov on mov.cid is not distinct from b.cid
  left join est on est.cid is not distinct from b.cid
  order by coalesce(mov.sai, 0) desc, b.cnome;
end;
$$;


-- ---------------------------------------------------------------------
-- PRODUTOS PARADOS: ativos, com saldo, sem nenhuma saída nos últimos X dias
-- ---------------------------------------------------------------------
create or replace function public.dashboard_produtos_parados(
  p_empresa  uuid,
  p_dias     integer default 30
)
returns table (
  produto_id        uuid,
  nome              text,
  categoria_nome    text,
  quantidade_atual  integer,
  ultima_saida      timestamptz
)
language plpgsql stable
set search_path = public
as $$
#variable_conflict use_column
begin
  perform public.exigir_papel(p_empresa);

  return query
  select p.id, p.nome, c.nome, p.quantidade_atual, u.ultima
    from public.produtos p
    left join public.categorias c on c.id = p.categoria_id
    left join lateral (
      select max(m.criado_em) as ultima
        from public.movimentacoes m
       where m.produto_id = p.id and m.tipo = 'saida'
    ) u on true
   where p.empresa_id = p_empresa
     and p.ativo
     and p.quantidade_atual > 0
     and (u.ultima is null or u.ultima < now() - make_interval(days => greatest(p_dias, 1)))
   order by u.ultima nulls first, p.nome;
end;
$$;


-- ---------------------------------------------------------------------
-- VIEW: produtos com estoque baixo (saldo <= estoque mínimo)
-- security_invoker: o RLS de "produtos" continua valendo. Filtre por empresa_id.
-- ---------------------------------------------------------------------
create or replace view public.vw_estoque_baixo
with (security_invoker = true)
as
select p.id,
       p.empresa_id,
       p.nome,
       p.sku,
       p.categoria_id,
       c.nome as categoria_nome,
       p.quantidade_atual,
       p.estoque_minimo
  from public.produtos p
  left join public.categorias c on c.id = p.categoria_id
 where p.ativo
   and p.quantidade_atual <= p.estoque_minimo;
