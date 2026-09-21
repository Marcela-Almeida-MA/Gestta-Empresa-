# Regras de Negócio

## 1. Estoque e movimentações

| Regra | Descrição |
|---|---|
| RN01 | O saldo (`quantidade_atual`) só muda por meio de uma movimentação. |
| RN02 | **Entrada** soma ao saldo; **saída** subtrai. |
| RN03 | A quantidade de uma movimentação é um número **inteiro** maior que zero (o controle é sempre por unidade). |
| RN04 | Saída maior que o saldo é **recusada** (estoque nunca fica negativo). |
| RN05 | Movimentações **não são editadas nem excluídas**. Um erro é corrigido com uma movimentação de ajuste. |
| RN06 | Produto com movimentações só pode ser **inativado**. |
| RN07 | Saldo menor ou igual ao `estoque_minimo` gera alerta de estoque baixo. |
| RN08 | O valor e o custo do produto são gravados no momento da operação (mudanças futuras de preço não alteram o histórico). |
| RN09 | O produto sempre nasce com saldo zero. Ao cadastrar um produto com estoque, o sistema registra uma **entrada** com motivo `estoque_inicial`. |

## 2. Categorias

| Regra | Descrição |
|---|---|
| RN10 | Cada empresa cria e edita **as próprias categorias** (ex.: Roupas, Bolsas, Acessórios). Não existe lista fixa. |
| RN11 | O nome da categoria é único dentro da empresa (sem diferenciar maiúsculas de minúsculas). |
| RN12 | A categoria é **opcional** no produto. Produtos sem categoria aparecem como "Sem categoria". |
| RN13 | Categoria que tem produtos **não pode ser excluída**. O usuário pode inativá-la ou mover os produtos para outra categoria antes. |
| RN14 | Categoria inativa não aparece para novos cadastros, mas continua nos produtos e relatórios antigos. |
| RN15 | Apenas o **admin** cria, edita, inativa ou exclui categorias. O operador só visualiza e filtra. |
| RN16 | Nesta versão há **um único nível** de categoria (sem subcategorias). |

## 3. Dashboard e financeiro

O dashboard usa somente as movimentações do período escolhido e pode ser
filtrado por **categoria** e por **produto**.

### 3.1 Indicadores

| Indicador | Cálculo | Quem vê |
|---|---|---|
| Unidades que entraram | Σ `quantidade` das entradas | todos |
| Unidades que saíram | Σ `quantidade` das saídas | todos |
| Saldo do período | entradas − saídas (em unidades) | todos |
| Produtos com estoque baixo | `quantidade_atual <= estoque_minimo` | todos |
| Total de entradas (R$) | Σ `quantidade × valor_unitario` das entradas | admin |
| Total de saídas (R$) | Σ `quantidade × valor_unitario` das saídas | admin |
| Valor em estoque | Σ `quantidade_atual × custo_unitario` (produtos ativos) | admin |
| Lucro bruto | receita das vendas − custo das mercadorias vendidas | admin |

### 3.2 Gráficos e listas

| Componente | O que mostra |
|---|---|
| Entradas x saídas por período | Barras ou linhas agrupadas por dia, semana ou mês |
| Ranking de produtos | Os que mais saem (e os que mais entram) |
| Produtos parados | Sem nenhuma saída nos últimos X dias |
| Por categoria | Saídas e estoque divididos por categoria |
| Últimas movimentações | As 10 mais recentes |
| Estoque baixo | Lista de produtos abaixo do mínimo, com atalho para dar entrada |

> Valores em R$ (receita, custo, lucro) ficam visíveis **apenas para o admin**.
> O operador vê o dashboard de movimentação em unidades.

### 3.3 Receita e lucro

Enquanto o sistema não tiver um módulo de vendas completo, uma **saída com
motivo "venda"** representa a receita. O custo da mercadoria vendida usa o
`custo_unitario` do produto no momento da saída.

## 4. Precificação

### 4.1 Entradas do cálculo

| Variável | Origem |
|---|---|
| `despesas_fixas_mensais` | Soma das despesas fixas ativas da empresa |
| `unidades_mes` | Unidades **vendidas** pela empresa no período de referência (padrão: últimos 30 dias). Se não houver vendas registradas, usa a estimativa informada no cadastro da empresa. |
| `custo_produto` | Custo unitário do produto |
| `despesas_adicionais` | Soma das despesas adicionais do produto (embalagem, etc.) |
| `lucro` | Percentual de lucro desejado |

### 4.2 Fórmula

```
1) unidades_mes          = unidades vendidas no período (ou a estimativa, se não houver vendas)
2) custo_fixo_unitario   = despesas_fixas_mensais / unidades_mes
3) preco_base            = custo_produto + despesas_adicionais + custo_fixo_unitario
4) preco_sugerido        = preco_base × (1 + lucro / 100)         ← markup (padrão)
```

**Por que dividir pelas unidades do mês e não por 30?**
Dias sem venda fazem parte do mês, então o rateio mensal já os considera e não
oscila de um dia para outro. Dividir por 30 seria o gasto de **um dia**
(R$ 3.000 ÷ 30 = R$ 100). Somar isso em cada unidade só funciona se a empresa
vende uma unidade por dia.

**Detalhes importantes**

- `unidades_mes` é da **empresa inteira** (todos os produtos somados), pois as
  despesas fixas são pagas por todos eles.
- O período de referência é configurável (30, 60 ou 90 dias), o que ajuda em
  meses fracos ou sazonais.
- É possível escolher usar apenas a **estimativa manual**, sem olhar as vendas reais.

### 4.3 Lucro: markup e margem

| Método | Fórmula | Significado do lucro |
|---|---|---|
| **Markup** (padrão) | `preco_base × (1 + lucro/100)` | Percentual **sobre o custo** |
| Margem (opção futura) | `preco_base / (1 − lucro/100)` | Percentual **sobre o preço de venda** |

O campo `metodo_lucro` já existe no banco para permitir a margem depois, sem
mudar a estrutura. A margem exige `lucro < 100`.

### 4.4 Exemplo numérico

Dados: despesas fixas de R$ 3.000,00/mês · 600 unidades vendidas nos últimos 30
dias · custo do produto R$ 20,00 · embalagem R$ 2,00 · lucro de 30%.

| Passo | Cálculo | Resultado |
|---|---|---|
| Custo fixo por unidade | 3.000 ÷ 600 | R$ 5,00 |
| Preço base | 20 + 2 + 5 | R$ 27,00 |
| **Preço sugerido (markup)** | 27 × 1,30 | **R$ 35,10** |

Se o mês tivesse só 100 unidades vendidas, o custo fixo por unidade seria
R$ 30,00 e o preço base subiria para R$ 52,00. O sistema mostra esse alerta.

### 4.5 Regras complementares

| Regra | Descrição |
|---|---|
| RN20 | Todos os cálculos usam **decimais** (nunca `float`). |
| RN21 | Arredondamento apenas no resultado final, para 2 casas (padrão *half up*). |
| RN22 | Se `unidades_mes` for zero, usa a estimativa manual. Se a estimativa também for zero, o cálculo é recusado (evita divisão por zero). |
| RN23 | O sistema **sugere**; o usuário decide se aplica o preço ao produto. |
| RN24 | Cada cálculo é salvo em `precificacoes` com os valores usados (inclusive `unidades_mes`). O histórico não muda se as despesas forem alteradas depois. |
| RN25 | Se o `preco_venda` atual for menor que o `preco_base`, o sistema avisa que o produto está sendo vendido **com prejuízo**. |
| RN26 | Se as vendas reais forem bem menores que a estimativa, o sistema alerta que o custo fixo por unidade está alto. |

### 4.6 Onde fica o código

A fórmula fica em uma classe de domínio **pura**, sem acesso a banco, fácil de testar:

```ts
/**
 * Calcula o preço de venda sugerido de um produto.
 * Classe de domínio: não depende de banco, HTTP ou framework.
 */
export class CalculadoraDePreco {
  calcular(entrada: EntradaPrecificacao): ResultadoPrecificacao {
    // 1) rateia as despesas fixas do mês pelas unidades vendidas no mês
    // 2) soma com o custo do produto e as despesas adicionais
    // 3) aplica o lucro (markup)
    // 4) devolve o preço sugerido com alertas (prejuízo, custo fixo alto)
  }
}
```

**Casos de teste mínimos:** exemplo da seção 4.4 · lucro 0% · `unidades_mes = 0`
com estimativa (usa a estimativa) · `unidades_mes = 0` sem estimativa (erro) ·
arredondamento de centavos · preço atual abaixo do preço base (alerta de prejuízo).

## 5. Contas e empresas

| Regra | Descrição |
|---|---|
| RN30 | Um usuário pode participar de **várias empresas**, com um papel (admin ou operador) em cada uma. |
| RN31 | Os dados de cada empresa são **totalmente separados**: produtos, categorias, movimentações, despesas e configurações não são compartilhados nem somados. O dashboard mostra uma empresa por vez. |
| RN32 | Quem cria a empresa passa a ser **admin** dela. |
| RN33 | A **estimativa de unidades vendidas por mês** é informada no cadastro da empresa (mínimo 1) e pode ser alterada em Configurações. |
| RN34 | Toda empresa tem **pelo menos um admin**: o último admin não pode ser removido nem sair. |
| RN35 | Excluir uma empresa apaga todos os dados dela. Só o admin pode, com confirmação. |
| RN36 | Excluir a **conta do usuário** remove apenas as participações dele. Em empresas onde ele é o único admin, é preciso antes transferir a administração ou excluir a empresa. |
