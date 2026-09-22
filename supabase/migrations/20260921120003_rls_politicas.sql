-- =====================================================================
-- MIGRATION 3 · ROW LEVEL SECURITY (RLS)
--
-- Regra geral: o usuário só enxerga e altera linhas de empresas das quais
-- é MEMBRO. Esta é a proteção principal do sistema: mesmo que o backend
-- tenha uma falha, o banco bloqueia o acesso a dados de outra empresa.
--
-- Com RLS ligado e SEM política para uma operação, essa operação é NEGADA.
-- Por isso várias tabelas não têm política de INSERT/DELETE de propósito
-- (ex.: movimentações não têm UPDATE nem DELETE).
--
-- Papéis por empresa:
--   admin    -> tudo da empresa
--   operador -> vê produtos e categorias e registra entradas/saídas
-- =====================================================================

alter table public.empresas                     enable row level security;
alter table public.perfis                       enable row level security;
alter table public.membros_empresa              enable row level security;
alter table public.categorias                   enable row level security;
alter table public.produtos                     enable row level security;
alter table public.movimentacoes                enable row level security;
alter table public.despesas_fixas               enable row level security;
alter table public.configuracoes_precificacao   enable row level security;
alter table public.despesas_adicionais_produto  enable row level security;
alter table public.precificacoes                enable row level security;


-- ---------------------------------------------------------------------
-- EMPRESAS
-- Ver: quem participa. Editar: só admin. Criar e excluir: apenas pelas
-- funções criar_empresa() e excluir_empresa() (por isso não há política
-- de INSERT nem de DELETE).
-- ---------------------------------------------------------------------
create policy "empresas: membros leem"
  on public.empresas for select to authenticated
  using (id in (select public.empresas_do_usuario()));

create policy "empresas: admin edita"
  on public.empresas for update to authenticated
  using      (public.eh_admin_da_empresa(id))
  with check (public.eh_admin_da_empresa(id));


-- ---------------------------------------------------------------------
-- PERFIS
-- Cada um vê e edita o próprio perfil. Também é possível ver o nome de
-- quem participa das mesmas empresas (para listar os membros).
-- O perfil é criado por gatilho; não há INSERT/DELETE direto.
-- ---------------------------------------------------------------------
create policy "perfis: le o proprio e colegas de empresa"
  on public.perfis for select to authenticated
  using (
    id = auth.uid()
    or id in (
      select m.usuario_id from public.membros_empresa m
       where m.empresa_id in (select public.empresas_do_usuario())
    )
  );

create policy "perfis: edita o proprio"
  on public.perfis for update to authenticated
  using      (id = auth.uid())
  with check (id = auth.uid());


-- ---------------------------------------------------------------------
-- MEMBROS DA EMPRESA
-- Ver: membros da mesma empresa. Adicionar/alterar: só admin.
-- Remover: admin remove qualquer um; cada pessoa pode sair da empresa.
-- O gatilho garantir_ultimo_admin impede ficar sem admin.
-- ---------------------------------------------------------------------
create policy "membros: veem a propria empresa"
  on public.membros_empresa for select to authenticated
  using (empresa_id in (select public.empresas_do_usuario()));

create policy "membros: admin adiciona"
  on public.membros_empresa for insert to authenticated
  with check (public.eh_admin_da_empresa(empresa_id));

create policy "membros: admin altera papel"
  on public.membros_empresa for update to authenticated
  using      (public.eh_admin_da_empresa(empresa_id))
  with check (public.eh_admin_da_empresa(empresa_id));

create policy "membros: admin remove ou a pessoa sai"
  on public.membros_empresa for delete to authenticated
  using (public.eh_admin_da_empresa(empresa_id) or usuario_id = auth.uid());


-- ---------------------------------------------------------------------
-- CATEGORIAS e PRODUTOS
-- Ver: todos da empresa. Criar/editar/excluir: só admin.
-- ---------------------------------------------------------------------
create policy "categorias: membros leem"
  on public.categorias for select to authenticated
  using (empresa_id in (select public.empresas_do_usuario()));

create policy "categorias: admin escreve"
  on public.categorias for all to authenticated
  using      (public.eh_admin_da_empresa(empresa_id))
  with check (public.eh_admin_da_empresa(empresa_id));

-- Observação: o operador consegue ler custo_unitario em "produtos".
-- Se for preciso esconder o custo dele, crie uma view sem essa coluna
-- para o operador e restrinja o SELECT da tabela ao admin.
create policy "produtos: membros leem"
  on public.produtos for select to authenticated
  using (empresa_id in (select public.empresas_do_usuario()));

create policy "produtos: admin escreve"
  on public.produtos for all to authenticated
  using      (public.eh_admin_da_empresa(empresa_id))
  with check (public.eh_admin_da_empresa(empresa_id));


-- ---------------------------------------------------------------------
-- MOVIMENTAÇÕES
-- Ver e registrar: qualquer membro (admin ou operador).
-- SEM política de UPDATE e DELETE: o histórico é imutável.
-- ---------------------------------------------------------------------
create policy "movimentacoes: membros leem"
  on public.movimentacoes for select to authenticated
  using (empresa_id in (select public.empresas_do_usuario()));

create policy "movimentacoes: membros registram"
  on public.movimentacoes for insert to authenticated
  with check (empresa_id in (select public.empresas_do_usuario()));


-- ---------------------------------------------------------------------
-- DESPESAS, CONFIGURAÇÃO E PRECIFICAÇÕES
-- Somente admin (ver e escrever): o operador não acessa dados financeiros.
-- ---------------------------------------------------------------------
create policy "despesas_fixas: somente admin"
  on public.despesas_fixas for all to authenticated
  using      (public.eh_admin_da_empresa(empresa_id))
  with check (public.eh_admin_da_empresa(empresa_id));

create policy "configuracoes_precificacao: somente admin"
  on public.configuracoes_precificacao for all to authenticated
  using      (public.eh_admin_da_empresa(empresa_id))
  with check (public.eh_admin_da_empresa(empresa_id));

create policy "despesas_adicionais_produto: somente admin"
  on public.despesas_adicionais_produto for all to authenticated
  using      (public.eh_admin_da_empresa(empresa_id))
  with check (public.eh_admin_da_empresa(empresa_id));

create policy "precificacoes: somente admin"
  on public.precificacoes for all to authenticated
  using      (public.eh_admin_da_empresa(empresa_id))
  with check (public.eh_admin_da_empresa(empresa_id));
