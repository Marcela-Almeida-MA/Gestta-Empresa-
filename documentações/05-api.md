# API do Backend

Base: `/api/v1` · Formato: JSON · Autenticação: `Authorization: Bearer <JWT do Supabase>`

> O login e o cadastro de usuário são feitos diretamente no **Supabase Auth**
> pelo front-end. A API cuida do restante.

## 1. Convenções

| Item | Padrão |
|---|---|
| Códigos de sucesso | `200` leitura/edição · `201` criação · `204` sem conteúdo |
| Códigos de erro | `400` dados inválidos · `401` sem login · `403` sem permissão · `404` não encontrado · `409` conflito · `422` regra de negócio violada |
| Paginação | `?pagina=1&limite=20` |
| Datas | ISO 8601 (`2026-09-21T14:30:00Z`) |
| Dinheiro | Número decimal com 2 casas (`35.10`) |
| Empresa ativa | Rotas de negócio exigem o cabeçalho `X-Empresa-Id`. A API confere se o usuário participa dessa empresa (senão `403`) |

**Formato de erro**

```json
{
  "codigo": "SALDO_INSUFICIENTE",
  "mensagem": "A quantidade solicitada é maior que o saldo em estoque.",
  "detalhes": { "saldo": 5, "solicitado": 8 }
}
```

## 2. Empresa e usuários

| Método | Rota | Descrição | Perfil |
|---|---|---|---|
| GET | `/empresas` | Lista as empresas das quais o usuário participa, com o papel em cada uma | autenticado |
| POST | `/empresas` | Cria uma empresa (quem cria vira admin) | autenticado |
| GET | `/empresas/atual` | Dados da empresa do cabeçalho `X-Empresa-Id` | todos |
| PATCH | `/empresas/atual` | Editar dados da empresa e a estimativa de unidades/mês | admin |
| DELETE | `/empresas/atual` | Excluir a empresa e todos os seus dados (o backend apaga antes as fotos do Storage e chama `excluir_empresa`) | admin |
| GET | `/usuarios` | Membros da empresa | admin |
| POST | `/usuarios/convites` | Convidar por e-mail (conta existente entra direto; senão recebe convite) | admin |
| PATCH | `/usuarios/:id` | Alterar o papel na empresa | admin |
| DELETE | `/usuarios/:id` | Remover da empresa (o último admin não pode ser removido) | admin |
| DELETE | `/conta` | Excluir a própria conta (`409` se for o único admin de alguma empresa) | autenticado |

**Exemplo: `POST /empresas`**

```json
{
  "nome": "Minha Empresa de Bolsas",
  "documento": null,
  "unidadesMesEstimadas": 300
}
```

`unidadesMesEstimadas` é obrigatório (mínimo 1) e pode ser alterado depois.

## 3. Produtos

| Método | Rota | Descrição | Perfil |
|---|---|---|---|
| GET | `/produtos` | Lista com busca (`?busca=`), filtros (`?categoriaId=`, `?semCategoria=true`, `?estoqueBaixo=true`) e paginação | todos |
| GET | `/produtos/:id` | Detalhe do produto | todos |
| POST | `/produtos` | Cadastrar produto | admin |
| PATCH | `/produtos/:id` | Editar produto | admin |
| PATCH | `/produtos/:id/inativar` | Inativar produto | admin |
| POST | `/produtos/:id/foto` | Enviar foto (`multipart/form-data`) | admin |
| DELETE | `/produtos/:id/foto` | Remover foto | admin |

**Exemplo: `POST /produtos`**

```json
{
  "nome": "Caneca branca 300ml",
  "sku": "CAN-001",
  "categoriaId": "c7a2...",
  "custoUnitario": 20.0,
  "precoVenda": 35.1,
  "estoqueMinimo": 10,
  "quantidadeInicial": 50
}
```

> A `quantidadeAtual` **não** é enviada. Ela muda apenas por movimentações. Para dar estoque
> inicial, envie `quantidadeInicial` (opcional): o backend registra uma entrada com motivo `estoque_inicial`.

## 3.1 Categorias

| Método | Rota | Descrição | Perfil |
|---|---|---|---|
| GET | `/categorias` | Listar categorias (`?incluirInativas=true`) | todos |
| POST | `/categorias` | Criar categoria (`{ "nome": "Bolsas", "cor": "#8B5CF6" }`) | admin |
| PATCH | `/categorias/:id` | Renomear ou alterar a cor | admin |
| PATCH | `/categorias/:id/inativar` | Inativar categoria | admin |
| DELETE | `/categorias/:id` | Excluir (erro `CATEGORIA_COM_PRODUTOS` se houver produtos) | admin |

## 4. Movimentações

| Método | Rota | Descrição | Perfil |
|---|---|---|---|
| GET | `/movimentacoes` | Histórico (`?produtoId=&categoriaId=&tipo=&de=&ate=`) | todos |
| POST | `/movimentacoes` | Registrar entrada ou saída | todos |

**Exemplo: `POST /movimentacoes`**

```json
{
  "produtoId": "b3d1...",
  "tipo": "saida",
  "quantidade": 3,
  "valorUnitario": 35.1,
  "motivo": "venda"
}
```

Erros possíveis: `SALDO_INSUFICIENTE` (422) · `PRODUTO_INATIVO` (422) · `QUANTIDADE_INVALIDA` (400).

## 5. Precificação

| Método | Rota | Descrição | Perfil |
|---|---|---|---|
| GET | `/precificacao/configuracao` | Ler configuração (período de vendas, estimativa de unidades/mês, lucro padrão, método) | admin |
| PUT | `/precificacao/configuracao` | Salvar configuração | admin |
| GET | `/despesas-fixas` | Listar despesas fixas | admin |
| POST | `/despesas-fixas` | Criar despesa fixa | admin |
| PATCH | `/despesas-fixas/:id` | Editar despesa fixa | admin |
| DELETE | `/despesas-fixas/:id` | Remover despesa fixa | admin |
| GET | `/produtos/:id/despesas-adicionais` | Listar despesas adicionais do produto | admin |
| POST | `/produtos/:id/despesas-adicionais` | Adicionar (ex.: embalagem) | admin |
| DELETE | `/produtos/:id/despesas-adicionais/:despesaId` | Remover | admin |
| POST | `/produtos/:id/precificacao/simular` | Calcula o preço sugerido **sem salvar** | admin |
| POST | `/produtos/:id/precificacao` | Salva o cálculo no histórico | admin |
| POST | `/precificacoes/:id/aplicar` | Aplica o preço sugerido ao produto | admin |
| GET | `/produtos/:id/precificacoes` | Histórico de cálculos do produto | admin |

**Exemplo: resposta de `/simular`**

```json
{
  "custoProduto": 20.0,
  "despesasAdicionais": 2.0,
  "unidadesMes": 600,
  "custoFixoUnitario": 5.0,
  "precoBase": 27.0,
  "lucroPercentual": 30,
  "metodoLucro": "markup",
  "precoSugerido": 35.1,
  "alertas": []
}
```

## 6. Dashboard e financeiro

| Método | Rota | Descrição | Perfil |
|---|---|---|---|
| GET | `/dashboard/resumo?de=&ate=&categoriaId=` | Cartões: entradas, saídas, saldo e estoque baixo (e, para o admin, valores em R$) | todos |
| GET | `/dashboard/movimentacao-por-periodo?de=&ate=&agrupar=&categoriaId=` | Série para o gráfico de entradas x saídas (`agrupar` = dia, semana ou mes) | todos |
| GET | `/dashboard/ranking-produtos?tipo=&de=&ate=&limite=10` | Produtos que mais saem ou mais entram (`tipo` = saida ou entrada) | todos |
| GET | `/dashboard/por-categoria?de=&ate=` | Saídas e estoque por categoria | todos |
| GET | `/dashboard/produtos-parados?dias=30` | Produtos sem saída no período | todos |
| GET | `/dashboard/estoque-baixo` | Produtos no estoque mínimo ou abaixo | todos |
| GET | `/dashboard/ultimas-movimentacoes?limite=10` | Movimentações mais recentes | todos |

**Exemplo: resposta de `/dashboard/resumo`**

```json
{
  "periodo": { "de": "2026-09-01", "ate": "2026-09-30" },
  "unidadesEntrada": 240,
  "unidadesSaida": 180,
  "saldoUnidades": 60,
  "produtosEstoqueBaixo": 4,
  "financeiro": {
    "totalEntradas": 4800.0,
    "totalSaidas": 6318.0,
    "valorEmEstoque": 12500.0,
    "lucroBruto": 2100.0
  }
}
```

O bloco `financeiro` só é enviado quando o usuário é **admin**.

## 7. Ordem sugerida de implementação

1. `empresas` + `auth` (cadastro e guarda do JWT)
2. `categorias`
3. `produtos` (com categoria e foto)
4. `movimentacoes`
5. `dashboard` (entradas e saídas)
6. `despesas-fixas` + `configuracao` + `precificacao`

## 8. Tradução dos erros do banco para HTTP

As regras de negócio no banco devolvem mensagens que começam com um código.
O backend converte cada uma na resposta de erro padrão (seção 1).

| Código no banco | HTTP | Quando acontece |
|---|---|---|
| `SALDO_INSUFICIENTE` | 422 | Saída maior que o saldo |
| `PRODUTO_INATIVO` | 422 | Movimentação de produto inativo |
| `PRODUTO_NAO_ENCONTRADO` | 404 | Produto inexistente ou de outra empresa |
| `ESTOQUE_SOMENTE_POR_MOVIMENTACAO` | 422 | Tentativa de editar o saldo direto |
| `ULTIMO_ADMIN` | 409 | Remover ou rebaixar o último admin da empresa |
| `ACESSO_NEGADO` / `NAO_AUTENTICADO` | 403 / 401 | Sem participação na empresa ou sem login |
| `ESTIMATIVA_INVALIDA` / `NOME_OBRIGATORIO` | 400 | Dados inválidos ao criar a empresa |
| `PERIODO_INVALIDO` / `AGRUPAMENTO_INVALIDO` / `TIPO_INVALIDO` | 400 | Parâmetros errados no dashboard |
| Violação de FK ao excluir categoria | 409 | `CATEGORIA_COM_PRODUTOS` |
