-- =====================================================================
-- MIGRATION 1 · TABELAS
-- Sistema de Estoque, Financeiro e Precificação (multiempresa)
--
-- Convenções:
--   * chaves primárias em uuid;
--   * dinheiro em numeric(12,2) (nunca float);
--   * quantidades de estoque sempre inteiras;
--   * toda tabela de negócio tem empresa_id (base do isolamento entre empresas).
--
-- Ordem de execução: 1 tabelas -> 2 funções e gatilhos -> 3 RLS -> 4 storage
--                    -> 5 dashboard -> 6 permissões
-- =====================================================================


-- ---------------------------------------------------------------------
-- EMPRESAS
-- Cada empresa é um "inquilino" separado. Uma pessoa pode ter várias.
-- ---------------------------------------------------------------------
create table public.empresas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null check (length(trim(nome)) > 0),
  documento  text,                                   -- CNPJ/CPF (opcional)
  criado_em  timestamptz not null default now()
);
comment on table public.empresas is 'Empresas (inquilinos). Cada uma tem dados totalmente separados.';


-- ---------------------------------------------------------------------
-- PERFIS
-- Dados da pessoa. O id é o mesmo do usuário no Supabase Auth.
-- É criado automaticamente por um gatilho quando o usuário se cadastra
-- (ver migration 2).
-- ---------------------------------------------------------------------
create table public.perfis (
  id         uuid primary key references auth.users (id) on delete cascade,
  nome       text,
  criado_em  timestamptz not null default now()
);
comment on table public.perfis is 'Dados da pessoa (1 por usuário do Supabase Auth).';


-- ---------------------------------------------------------------------
-- MEMBROS DA EMPRESA
-- Liga a pessoa a cada empresa de que participa, com um papel POR empresa.
-- ---------------------------------------------------------------------
create table public.membros_empresa (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  usuario_id  uuid not null references public.perfis (id) on delete cascade,
  papel       text not null check (papel in ('admin', 'operador')),
  criado_em   timestamptz not null default now(),
  unique (empresa_id, usuario_id)
);
create index on public.membros_empresa (usuario_id);
comment on table public.membros_empresa is 'Participação de cada usuário em cada empresa, com o papel (admin/operador).';


-- ---------------------------------------------------------------------
-- CATEGORIAS
-- Criadas e editadas por cada empresa (ex.: Roupas, Bolsas, Acessórios).
-- ---------------------------------------------------------------------
create table public.categorias (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  cor         text check (cor is null or cor ~ '^#[0-9A-Fa-f]{6}$'),  -- ex.: #8B5CF6
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  -- necessário para a chave estrangeira composta de produtos (ver abaixo)
  unique (id, empresa_id)
);
-- Nome único dentro da empresa, sem diferenciar maiúsculas de minúsculas
create unique index categorias_nome_unico on public.categorias (empresa_id, lower(nome));


-- ---------------------------------------------------------------------
-- PRODUTOS
-- IMPORTANTE: quantidade_atual NÃO é editada diretamente. Ela só muda
-- por movimentações (gatilhos da migration 2 garantem isso).
-- ---------------------------------------------------------------------
create table public.produtos (
  id                uuid primary key default gen_random_uuid(),
  empresa_id        uuid not null references public.empresas (id) on delete cascade,
  categoria_id      uuid,                                   -- opcional
  nome              text not null check (length(trim(nome)) > 0),
  sku               text,                                   -- único dentro da empresa
  descricao         text,
  foto_path         text,                                   -- caminho no Storage (não a URL)
  custo_unitario    numeric(12,2) not null default 0 check (custo_unitario >= 0),
  preco_venda       numeric(12,2) not null default 0 check (preco_venda >= 0),
  quantidade_atual  integer       not null default 0 check (quantidade_atual >= 0),
  estoque_minimo    integer       not null default 0 check (estoque_minimo >= 0),
  ativo             boolean       not null default true,
  criado_em         timestamptz   not null default now(),
  atualizado_em     timestamptz   not null default now(),
  unique (empresa_id, sku),                                 -- SKU nulo pode repetir
  unique (id, empresa_id),
  -- Chave composta: garante que o produto só pode apontar para uma categoria
  -- DA MESMA empresa. Sem ação de exclusão: categoria com produtos não pode ser apagada.
  constraint produtos_categoria_fk
    foreign key (categoria_id, empresa_id)
    references public.categorias (id, empresa_id)
);
create index on public.produtos (empresa_id, nome);
create index on public.produtos (empresa_id, categoria_id);
comment on column public.produtos.quantidade_atual is 'Saldo atual. Só muda por movimentações.';


-- ---------------------------------------------------------------------
-- MOVIMENTAÇÕES (entradas e saídas)
-- Histórico IMUTÁVEL: sem update nem delete. Erros são corrigidos com uma
-- movimentação de ajuste.
-- ---------------------------------------------------------------------
create table public.movimentacoes (
  id              uuid primary key default gen_random_uuid(),
  empresa_id      uuid not null references public.empresas (id) on delete cascade,
  produto_id      uuid not null,
  tipo            text not null check (tipo in ('entrada', 'saida')),
  motivo          text not null check (motivo in (
                    'compra', 'venda', 'devolucao', 'ajuste',
                    'perda', 'consumo', 'estoque_inicial', 'outro')),
  quantidade      integer not null check (quantidade > 0),      -- sempre positiva
  valor_unitario  numeric(12,2) not null default 0 check (valor_unitario >= 0),
  -- custo do produto NO MOMENTO da operação (preenchido por gatilho); usado no lucro bruto
  custo_unitario  numeric(12,2) not null default 0,
  observacao      text,
  criado_por      uuid references public.perfis (id) on delete set null,
  criado_em       timestamptz not null default now(),
  -- produto e movimentação precisam ser da mesma empresa
  constraint movimentacoes_produto_fk
    foreign key (produto_id, empresa_id)
    references public.produtos (id, empresa_id)
);
create index on public.movimentacoes (empresa_id, produto_id, criado_em desc);
create index on public.movimentacoes (empresa_id, criado_em desc);
create index on public.movimentacoes (empresa_id, tipo, criado_em desc);


-- ---------------------------------------------------------------------
-- DESPESAS FIXAS (aluguel, internet, salários...)
-- ---------------------------------------------------------------------
create table public.despesas_fixas (
  id            uuid primary key default gen_random_uuid(),
  empresa_id    uuid not null references public.empresas (id) on delete cascade,
  descricao     text not null check (length(trim(descricao)) > 0),
  valor_mensal  numeric(12,2) not null check (valor_mensal >= 0),
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);
create index on public.despesas_fixas (empresa_id) where ativo;


-- ---------------------------------------------------------------------
-- CONFIGURAÇÃO DE PRECIFICAÇÃO (1 linha por empresa)
-- Criada junto com a empresa (função criar_empresa, migration 2).
-- ---------------------------------------------------------------------
create table public.configuracoes_precificacao (
  empresa_id               uuid primary key references public.empresas (id) on delete cascade,
  -- janela usada para contar as unidades vendidas (rateio das despesas fixas)
  periodo_vendas_dias      integer not null default 30 check (periodo_vendas_dias in (30, 60, 90)),
  -- true: conta as saídas com motivo "venda"; false: usa só a estimativa
  usar_vendas_reais        boolean not null default true,
  -- estimativa de unidades vendidas por mês, informada no cadastro da empresa
  unidades_mes_estimadas   integer not null check (unidades_mes_estimadas >= 1),
  lucro_padrao_percentual  numeric(6,2) not null default 30 check (lucro_padrao_percentual >= 0),
  -- 'markup' = % sobre o custo (padrão); 'margem' reservado para o futuro
  metodo_lucro             text not null default 'markup' check (metodo_lucro in ('markup', 'margem'))
);


-- ---------------------------------------------------------------------
-- DESPESAS ADICIONAIS POR PRODUTO (embalagem, etiqueta, frete...)
-- Valor por unidade vendida.
-- ---------------------------------------------------------------------
create table public.despesas_adicionais_produto (
  id          uuid primary key default gen_random_uuid(),
  empresa_id  uuid not null references public.empresas (id) on delete cascade,
  produto_id  uuid not null,
  descricao   text not null check (length(trim(descricao)) > 0),
  valor       numeric(12,2) not null check (valor >= 0),
  criado_em   timestamptz not null default now(),
  constraint despesas_adicionais_produto_fk
    foreign key (produto_id, empresa_id)
    references public.produtos (id, empresa_id) on delete cascade
);
create index on public.despesas_adicionais_produto (empresa_id, produto_id);


-- ---------------------------------------------------------------------
-- PRECIFICAÇÕES (histórico dos cálculos)
-- Guarda os valores usados no cálculo, para que o histórico não mude se
-- as despesas forem alteradas depois.
-- ---------------------------------------------------------------------
create table public.precificacoes (
  id                    uuid primary key default gen_random_uuid(),
  empresa_id            uuid not null references public.empresas (id) on delete cascade,
  produto_id            uuid not null,
  custo_produto         numeric(12,2) not null,
  despesas_adicionais   numeric(12,2) not null default 0,   -- soma no momento do cálculo
  unidades_mes_usadas   integer not null check (unidades_mes_usadas >= 1),
  custo_fixo_unitario   numeric(12,4) not null,             -- despesas fixas / unidades do mês
  lucro_percentual      numeric(6,2) not null check (lucro_percentual >= 0),
  metodo_lucro          text not null default 'markup' check (metodo_lucro in ('markup', 'margem')),
  preco_sugerido        numeric(12,2) not null,
  aplicado              boolean not null default false,     -- virou o preco_venda do produto?
  criado_em             timestamptz not null default now(),
  constraint precificacoes_produto_fk
    foreign key (produto_id, empresa_id)
    references public.produtos (id, empresa_id) on delete cascade
);
create index on public.precificacoes (empresa_id, produto_id, criado_em desc);
