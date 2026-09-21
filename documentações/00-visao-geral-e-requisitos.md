# Sistema de Estoque, Financeiro e Precificação

> Documentação do projeto · Versão 0.2

## Índice da documentação

| Arquivo | Conteúdo |
|---|---|
| `00-visao-geral-e-requisitos.md` | Este arquivo: objetivo, escopo, requisitos e roadmap |
| `01-arquitetura.md` | Stack, arquitetura limpa, estrutura de pastas e convenções |
| `02-modelo-de-dados.md` | Tabelas do Supabase, relacionamentos e regras de integridade |
| `03-regras-de-negocio.md` | Estoque, categorias, dashboard e **fórmula de precificação** |
| `04-seguranca-e-privacidade.md` | Multiempresa, RLS, autenticação, LGPD |
| `05-api.md` | Endpoints da API do backend |

---

## 1. Objetivo

Aplicativo web responsivo (funciona em celular, tablet e computador) para
**controlar estoque, entradas e saídas de produtos, acompanhar o financeiro e
calcular o preço de venda sugerido** de cada produto.

O sistema é **multiempresa**: várias empresas usam o mesmo app, cada uma com
seu próprio login e senha, e **nenhuma empresa enxerga os dados de outra**.

## 2. Escopo da primeira versão (MVP)

**Dentro do escopo**

1. Login e cadastro dentro do próprio app (a empresa se cadastra sozinha). Uma mesma pessoa pode ter **várias empresas** na mesma conta.
2. **Categorias** de produtos (ex.: Roupas, Bolsas, Acessórios), criadas e editadas pelo próprio cliente.
3. Cadastro de produtos (com foto, categoria, custo, preço de venda e quantidade).
4. Entrada e saída de produtos (movimentações de estoque).
5. **Dashboard** para acompanhar entradas e saídas de produtos.
6. Precificação: despesas fixas, despesas adicionais (embalagem), custo do
   produto e lucro, resultando em um **preço sugerido**.
7. Controle financeiro básico: totais de entradas, saídas e lucro bruto por período.

**Fora do escopo (versões futuras)**

- Emissão de nota fiscal.
- Integração com marketplaces e meios de pagamento.
- Aplicativo nativo (o app web responsivo cobre o uso em celular).
- Controle de múltiplos depósitos.
- Subcategorias (nesta versão, um único nível de categoria).

## 3. Perfis de usuário

| Perfil | Pode |
|---|---|
| **Admin** (dono da empresa) | Tudo: usuários, produtos, movimentações, despesas, precificação, relatórios |
| **Operador** | Consultar produtos, registrar entradas e saídas e ver o dashboard de movimentação (em unidades, sem valores em R$) |

O papel vale **por empresa**: a mesma pessoa pode ser admin de uma e operador de outra.

## 4. Requisitos funcionais

### RF01 · Autenticação e cadastro
- RF01.1 Cadastrar o usuário (e-mail e senha) e a primeira empresa, da qual ele será administrador. O cadastro da empresa pede a **estimativa de unidades vendidas por mês** (usada na precificação).
- RF01.2 Entrar (login) e sair (logout).
- RF01.3 Recuperar senha por e-mail.
- RF01.4 Admin pode convidar outros usuários para a mesma empresa.
- RF01.5 Uma conta pode participar de **várias empresas** e alternar entre elas por um seletor de empresa.
- RF01.6 Qualquer usuário logado pode criar uma nova empresa na própria conta (ele será o admin dela).
- RF01.7 Os dados de cada empresa são totalmente separados (produtos, categorias, estoque, despesas e dashboard).

### RF02 · Cadastro de produtos
- RF02.1 Criar, editar, consultar, listar e inativar produtos.
- RF02.2 Campos: nome, SKU (código), descrição, **categoria**, **foto**, **custo**, **preço de venda**, **quantidade atual** e estoque mínimo. As quantidades são sempre em **unidades inteiras**, e o estoque inicial entra como uma movimentação.
- RF02.3 Busca por nome ou SKU e filtros por **categoria** e por estoque baixo.
- RF02.5 A página de visualização permite navegar por categoria (abas ou filtros) e mostra "Sem categoria" para produtos sem categoria.
- RF02.4 Produto com movimentações não pode ser excluído, apenas inativado.

### RF03 · Entrada e saída
- RF03.1 Registrar **entrada** (compra, reposição, devolução) e **saída** (venda, perda, consumo).
- RF03.2 A quantidade atual é atualizada automaticamente a cada movimentação.
- RF03.3 Não permitir saída maior que o saldo disponível.
- RF03.4 Histórico de movimentações com filtros por produto, tipo e período.
- RF03.5 Movimentações não são editadas nem apagadas. Erros são corrigidos com uma movimentação de ajuste.

### RF04 · Precificação
- RF04.1 Cadastrar as despesas fixas mensais da empresa (aluguel, internet, etc.).
- RF04.2 Cadastrar despesas adicionais por produto (embalagem, etiqueta, etc.).
- RF04.3 Informar o percentual de lucro desejado (aplicado como *markup* sobre o custo).
- RF04.4 O sistema **sugere o preço de venda**, rateando as despesas fixas do mês pelas unidades vendidas no mês (fórmula em `03-regras-de-negocio.md`).
- RF04.5 O usuário pode aceitar a sugestão e aplicá-la ao produto.
- RF04.6 Guardar o histórico das precificações feitas.
- RF04.7 A estimativa de unidades vendidas por mês é informada no **cadastro da empresa** e pode ser alterada depois em Configurações.

### RF05 · Dashboard e financeiro
- RF05.1 Cartões-resumo: unidades que entraram, unidades que saíram, saldo do período e produtos com estoque baixo.
- RF05.2 Gráfico de **entradas x saídas** por dia, semana ou mês.
- RF05.3 Ranking dos produtos que mais saem e que mais entram; lista de produtos parados (sem saída há X dias).
- RF05.4 Visão por **categoria** (saídas e estoque de cada uma).
- RF05.5 Últimas movimentações e lista de estoque baixo com atalho para dar entrada.
- RF05.6 Filtros por período (dia, semana, mês, personalizado), categoria e produto.
- RF05.7 Para o admin: total de entradas e saídas em R$, valor em estoque e lucro bruto.

### RF06 · Categorias
- RF06.1 Criar, renomear, inativar e excluir categorias (somente admin).
- RF06.2 Cada empresa tem as **suas** categorias; não existe lista fixa.
- RF06.3 Categoria que possui produtos não pode ser excluída; pode ser inativada ou os produtos podem ser movidos para outra categoria.
- RF06.4 Cor opcional por categoria, para identificação visual nas listas e gráficos.

## 5. Requisitos não funcionais

| Código | Requisito |
|---|---|
| RNF01 | Interface **responsiva** (mobile first) |
| RNF02 | **Isolamento total entre empresas** (RLS no banco) |
| RNF03 | Comunicação somente por HTTPS |
| RNF04 | Valores monetários com precisão decimal, sem ponto flutuante |
| RNF05 | Código componentizado, em camadas, **comentado** |
| RNF06 | Backend e front-end em projetos separados |
| RNF07 | Conformidade com a **LGPD** |
| RNF08 | Tempo de resposta das listagens abaixo de 2 segundos |
| RNF09 | Uma conta pode participar de várias empresas, com dados totalmente separados entre elas |

## 6. Roadmap sugerido

| Fase | Entrega |
|---|---|
| 0 | Documentação (este material) |
| 1 | Banco de dados no Supabase com RLS + autenticação e cadastro de empresa |
| 2 | Categorias e cadastro de produtos com upload de foto |
| 3 | Entrada e saída com controle de saldo |
| 4 | Precificação |
| 5 | Dashboard de entradas e saídas e painel financeiro |
| 6 | Testes, ajustes de responsividade e publicação |

## 7. Decisões tomadas

| Tema | Decisão |
|---|---|
| Rateio das despesas fixas | Despesas fixas do mês ÷ unidades vendidas no mês (dias sem venda já entram na conta) |
| Lucro | *Markup* sobre o custo (padrão). *Margem* fica como opção futura |
| Unidades | Somente unidades inteiras (sem kg, litro ou metro) |
| Categorias | Editáveis pelo cliente, um único nível, opcionais no produto |
| Dashboard | Entradas e saídas em unidades para todos; valores em R$ apenas para o admin |
| Várias empresas por usuário | **Sim.** Uma conta pode ter várias empresas (ex.: bolsas, embalagens, camisas), com papel e dados separados em cada uma |
| Estimativa de vendas | Informada no **cadastro da empresa** (obrigatória, mínimo 1) e editável depois |

## 8. Decisões em aberto

Nenhuma pendência bloqueante para iniciar a fase 1 (banco de dados e autenticação).
