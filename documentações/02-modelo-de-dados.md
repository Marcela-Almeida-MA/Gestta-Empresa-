# Modelo de Dados (Supabase / PostgreSQL)

> O SQL está em `supabase/migrations/` (6 arquivos, ver seção 8). Este documento descreve o modelo.

## 1. Regras gerais

- Chaves primárias em `uuid` (`gen_random_uuid()`).
- **Toda tabela de negócio tem `empresa_id`** (base do isolamento entre empresas).
- Valores monetários em `numeric(12,2)`. Nunca `float`.
- Quantidades de estoque são **inteiras** (`integer`): o controle é sempre por unidade.
- Datas em `timestamptz` (com fuso horário).
- Nomes de tabelas e colunas em português, minúsculo, com `_`.
- Produtos são **inativados**, não apagados (`ativo = false`).

## 2. Diagrama de relacionamentos

```
auth.users (Supabase Auth)
     │ 1
     │ 1
  perfis
     │ 1
     │ N
membros_empresa (papel por empresa) ── N:1 ──► empresas
                                                  │ 1   (toda tabela abaixo tem empresa_id)
      ┌─────────────────┬─────────────────────────┼──────────────────────┬────────────────────────┐
      │ N               │ N                       │ N                    │ 1
 categorias         produtos                despesas_fixas      configuracoes_precificacao
      │ 1               │ N:1 (categoria_id, opcional)
      └─────────────────┘
                        │ 1
        ┌───────────────┼───────────────────┐
        │ N             │ N                 │ N
  movimentacoes   despesas_adicionais_produto   precificacoes
```

## 3. Tabelas

### 3.1 `empresas`
| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid PK | |
| nome | text | obrigatório |
| documento | text | CNPJ/CPF, opcional |
| criado_em | timestamptz | default `now()` |

### 3.2 `perfis` e `membros_empresa`
Uma pessoa pode participar de **várias empresas**, com um papel em cada uma.

**`perfis`**: dados da pessoa (um por usuário).

| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid PK | igual a `auth.users.id` |
| nome | text | |
| criado_em | timestamptz | |

**`membros_empresa`**: liga a pessoa a cada empresa de que participa.

| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid PK | |
| empresa_id | uuid FK → empresas | |
| usuario_id | uuid FK → perfis | |
| papel | text | `admin` ou `operador` (por empresa) |
| criado_em | timestamptz | |

Restrições: `unique (empresa_id, usuario_id)`. Toda empresa deve ter **pelo menos um admin**.

### 3.3 `produtos`
| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid PK | |
| empresa_id | uuid FK | |
| nome | text | obrigatório |
| sku | text | único **dentro da empresa** |
| descricao | text | |
| categoria_id | uuid FK → categorias | opcional (produto pode ficar sem categoria) |
| foto_path | text | caminho no Storage (não a URL) |
| custo_unitario | numeric(12,2) | custo de compra/produção |
| preco_venda | numeric(12,2) | preço praticado |
| quantidade_atual | integer | **atualizada só por movimentações** |
| estoque_minimo | integer | alerta de estoque baixo |
| ativo | boolean | default `true` |
| criado_em / atualizado_em | timestamptz | |

Restrições: `unique (empresa_id, sku)` · `check (quantidade_atual >= 0)` · `check (custo_unitario >= 0)`.

### 3.4 `movimentacoes`
Histórico imutável de entradas e saídas.

| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid PK | |
| empresa_id | uuid FK | |
| produto_id | uuid FK → produtos | |
| tipo | text | `entrada` ou `saida` |
| motivo | text | `compra`, `venda`, `devolucao`, `ajuste`, `perda`, `consumo`, `estoque_inicial`, `outro` |
| quantidade | integer | sempre positiva (`check > 0`) |
| valor_unitario | numeric(12,2) | valor no momento da operação |
| custo_unitario | numeric(12,2) | custo do produto no momento da operação (preenchido automaticamente; base do lucro bruto) |
| observacao | text | |
| criado_por | uuid FK → perfis | |
| criado_em | timestamptz | |

Sem `update` nem `delete` para usuários (ver políticas de segurança).

### 3.5 `despesas_fixas`
| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid PK | |
| empresa_id | uuid FK | |
| descricao | text | aluguel, internet, salários... |
| valor_mensal | numeric(12,2) | |
| ativo | boolean | |

### 3.6 `configuracoes_precificacao`
Uma linha por empresa.

| Coluna | Tipo | Observação |
|---|---|---|
| empresa_id | uuid PK/FK | |
| periodo_vendas_dias | integer | período usado para contar as unidades vendidas (padrão **30**; opções 30, 60 ou 90) |
| usar_vendas_reais | boolean | `true` (padrão): conta as saídas com motivo venda; `false`: usa só a estimativa |
| unidades_mes_estimadas | integer | estimativa manual de unidades vendidas por mês, **informada no cadastro da empresa** (usada se não houver vendas ou se `usar_vendas_reais = false`); mínimo 1 |
| lucro_padrao_percentual | numeric(6,2) | sugestão inicial |
| metodo_lucro | text | `markup` (padrão). `margem` reservado para o futuro |

### 3.7 `despesas_adicionais_produto`
Custos extras de cada produto (embalagem, etiqueta, frete...).

| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid PK | |
| empresa_id | uuid FK | |
| produto_id | uuid FK | |
| descricao | text | |
| valor | numeric(12,2) | por unidade vendida |

### 3.8 `precificacoes`
Histórico dos cálculos. Guarda os valores usados, para que o cálculo antigo não mude se as despesas mudarem depois.

| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid PK | |
| empresa_id | uuid FK | |
| produto_id | uuid FK | |
| custo_produto | numeric(12,2) | |
| despesas_adicionais | numeric(12,2) | soma no momento do cálculo |
| unidades_mes_usadas | integer | unidades vendidas no mês usadas no rateio |
| custo_fixo_unitario | numeric(12,4) | rateio calculado |
| lucro_percentual | numeric(6,2) | |
| metodo_lucro | text | `markup` ou `margem` |
| preco_sugerido | numeric(12,2) | resultado |
| aplicado | boolean | se virou o `preco_venda` do produto |
| criado_em | timestamptz | |

### 3.9 `categorias`
Categorias de produtos, criadas e editadas por cada empresa (ex.: Roupas, Bolsas, Acessórios).

| Coluna | Tipo | Observação |
|---|---|---|
| id | uuid PK | |
| empresa_id | uuid FK | |
| nome | text | obrigatório |
| cor | text | opcional, formato `#RRGGBB`, para identificação visual |
| ativo | boolean | default `true` |
| criado_em | timestamptz | |

Restrições: nome único por empresa, sem diferenciar maiúsculas de minúsculas
(`create unique index on categorias (empresa_id, lower(nome));`).
`produtos` liga-se à categoria por uma chave composta `(categoria_id, empresa_id)`: assim um
produto **nunca aponta para categoria de outra empresa**, e **categoria com produtos não
pode ser excluída** (só inativada).

## 4. Atualização do estoque (consistência)

A `quantidade_atual` **não é editada diretamente**. Ela muda apenas quando uma
movimentação é gravada, por **gatilhos do banco**, na **mesma transação**
(migration 2):

| Gatilho | Quando | O que faz |
|---|---|---|
| `trg_movimentacoes_preparar` | antes de gravar a movimentação | Confere o produto (existe, é da mesma empresa, está ativo), guarda o custo do produto naquele momento e registra quem fez |
| `trg_movimentacoes_aplicar_estoque` | depois de gravar | Soma (entrada) ou subtrai (saída) do saldo. A saída só acontece se `quantidade_atual >= quantidade`; o banco trava a linha, então **duas saídas simultâneas nunca deixam o saldo negativo** (erro `SALDO_INSUFICIENTE`) |
| `trg_produtos_proteger_saldo` | ao editar um produto | Recusa qualquer alteração direta de `quantidade_atual` (erro `ESTOQUE_SOMENTE_POR_MOVIMENTACAO`) |
| `trg_produtos_saldo_inicial` | ao criar um produto | Força saldo zero. O estoque inicial entra como movimentação com motivo `estoque_inicial` |

O backend pode inserir direto em `movimentacoes` ou chamar a função
`registrar_movimentacao(produto, tipo, quantidade, valor, motivo, observacao)`,
que descobre a empresa pelo produto e grava a linha. Nos dois casos as regras
acima valem, porque ficam no banco.

## 5. Índices recomendados

```sql
create index on produtos (empresa_id, nome);
create index on produtos (empresa_id, categoria_id);
create index on movimentacoes (empresa_id, tipo, criado_em desc);
create index on movimentacoes (empresa_id, produto_id, criado_em desc);
create index on movimentacoes (empresa_id, criado_em desc);
create index on despesas_fixas (empresa_id) where ativo;
create index on precificacoes (empresa_id, produto_id, criado_em desc);
```

## 6. Storage (fotos)

- Bucket: `produtos-fotos` (**privado**).
- Caminho: `{empresa_id}/{produto_id}/{nome-do-arquivo}`.
- Formatos: JPEG, PNG, WebP · tamanho máximo sugerido: 5 MB.
- O banco guarda apenas o `foto_path`. O front recebe uma **URL assinada** temporária.
- Política de acesso: o primeiro trecho do caminho deve ser o id de uma empresa da qual o usuário é membro.

## 7. Consultas do dashboard

Os cálculos rodam **no banco**, em funções com `security invoker`, para que o
RLS continue valendo. Todas recebem o **id da empresa** (o usuário pode ter
várias) e recusam quem não participa dela. Valores em R$ só são devolvidos ao
`admin`; para o operador esses campos voltam `NULL`.

| Função | Devolve |
|---|---|
| `dashboard_resumo(empresa, de, ate, categoria)` | Unidades que entraram e saíram, saldo, estoque baixo e (admin) valores em R$, valor em estoque e lucro bruto |
| `dashboard_movimentacao_periodo(empresa, de, ate, agrupar, categoria)` | Entradas e saídas agrupadas por `dia`, `semana` ou `mes` |
| `dashboard_ranking_produtos(empresa, tipo, de, ate, limite)` | Produtos que mais saem (`saida`) ou mais entram (`entrada`) |
| `dashboard_por_categoria(empresa, de, ate)` | Movimentação e estoque por categoria, incluindo "Sem categoria" |
| `dashboard_produtos_parados(empresa, dias)` | Produtos com saldo e sem saída nos últimos X dias |
| `vw_estoque_baixo` (view) | Produtos com saldo menor ou igual ao estoque mínimo (filtrar por `empresa_id`) |

O período usa o fuso `America/Sao_Paulo`, do início do primeiro dia ao fim do último.

## 8. Migrations (ordem de execução)

| Arquivo | Conteúdo |
|---|---|
| `20260921120001_tabelas.sql` | Tabelas, chaves e índices |
| `20260921120002_funcoes_e_gatilhos.sql` | Funções de segurança, gatilhos de saldo, `criar_empresa`, `excluir_empresa`, apoio à precificação |
| `20260921120003_rls_politicas.sql` | Ativação do RLS e políticas por empresa e por papel |
| `20260921120004_storage_fotos.sql` | Bucket privado de fotos e políticas |
| `20260921120005_dashboard.sql` | Funções do dashboard e view de estoque baixo |
| `20260921120006_permissoes.sql` | Permissões finais (anon sem acesso; funções liberadas uma a uma) |
