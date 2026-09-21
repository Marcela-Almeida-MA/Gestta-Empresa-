# Arquitetura

## 1. Stack recomendada

Uma única linguagem nos dois lados: **TypeScript**.

| Camada | Tecnologia | Motivo |
|---|---|---|
| Front-end | React + Vite + Tailwind CSS | Componentes reutilizáveis e responsividade simples |
| Backend | Node.js + NestJS | Organizado em módulos, favorece arquitetura limpa |
| Banco de dados | Supabase (PostgreSQL) | Banco, autenticação e storage no mesmo lugar |
| Autenticação | Supabase Auth | Senhas gerenciadas por serviço especializado |
| Fotos | Supabase Storage (bucket privado) | Arquivos separados por empresa |
| Validação | class-validator (API) e Zod (front) | Dados validados na entrada |
| Testes | Vitest (front) e Jest (API) | Testes unitários das regras de negócio |

## 2. Visão geral

```
┌────────────────┐   HTTPS + JWT   ┌────────────────┐   JWT do usuário   ┌────────────────────┐
│   Front-end    │ ──────────────► │    Backend     │ ─────────────────► │      Supabase      │
│  React (SPA)   │ ◄────────────── │    NestJS      │ ◄───────────────── │ Postgres + Storage │
└───────┬────────┘                 └────────────────┘                    └────────────────────┘
        │  login / cadastro                                                        ▲
        └────────────────────────── Supabase Auth ────────────────────────────────┘
```

**Fluxo de autenticação**

1. O front faz login/cadastro direto no **Supabase Auth** e recebe um **JWT**.
2. Toda chamada à API leva o JWT no cabeçalho `Authorization: Bearer <token>`.
   Após o login, o front lista as empresas do usuário (`GET /empresas`). Se houver
   mais de uma, mostra um **seletor de empresa**, e a escolha segue no cabeçalho
   `X-Empresa-Id` das chamadas seguintes.
3. O backend valida o token, confere se o usuário **participa da empresa** informada em
   `X-Empresa-Id` e consulta o banco **usando o JWT do usuário**, para que o **RLS**
   seja aplicado automaticamente.
4. A chave `service_role` (que ignora o RLS) é usada **somente** em operações
   administrativas pontuais, como convidar usuários por e-mail ou excluir a conta do
   usuário. A criação da empresa usa a função `criar_empresa` do banco, sem `service_role`.

## 3. Estrutura do repositório (monorepo)

```
estoque/
├── docs/                      # esta documentação
├── apps/
│   ├── api/                   # backend
│   └── web/                   # front-end
└── supabase/
    └── migrations/            # scripts SQL versionados
```

## 4. Backend: arquitetura limpa

### Regra de dependência

As dependências apontam **sempre para dentro**. A camada de domínio não
conhece framework, banco nem HTTP.

```
presentation  ──►  application  ──►  domain
      │                 │
      └────►  infra ────┘   (infra implementa as interfaces definidas em domain)
```

### Camadas

| Camada | Responsabilidade | Exemplo |
|---|---|---|
| `domain` | Entidades e regras de negócio puras, interfaces de repositório | `Produto`, `Movimentacao`, `CalculadoraDePreco` |
| `application` | Casos de uso que orquestram o domínio | `CadastrarProduto`, `RegistrarSaida`, `CalcularPrecoSugerido` |
| `infra` | Implementações concretas (Supabase, storage) | `ProdutoRepositorySupabase` |
| `presentation` | Controllers, DTOs e validação HTTP | `ProdutosController` |

### Estrutura de pastas

```
apps/api/src/
├── modules/
│   ├── produtos/
│   │   ├── domain/
│   │   │   ├── produto.entity.ts
│   │   │   └── produto.repository.ts          # interface
│   │   ├── application/
│   │   │   ├── cadastrar-produto.usecase.ts
│   │   │   └── listar-produtos.usecase.ts
│   │   ├── infra/
│   │   │   └── produto.repository.supabase.ts # implementação
│   │   └── presentation/
│   │       ├── produtos.controller.ts
│   │       └── dto/
│   ├── empresas/         # empresas e membros (várias empresas por usuário)
│   ├── categorias/       # mesma divisão em 4 camadas
│   ├── movimentacoes/
│   ├── precificacao/
│   ├── dashboard/        # consultas de entradas, saídas e financeiro
│   └── auth/
├── shared/
│   ├── errors/           # erros de domínio padronizados
│   ├── guards/           # validação do JWT e do perfil
│   └── supabase/         # criação do cliente com o JWT do usuário
└── main.ts
```

Cada módulo repete a mesma divisão, o que facilita achar e manter o código.

## 5. Front-end: componentização

```
apps/web/src/
├── components/
│   ├── ui/               # botão, input, modal, tabela (genéricos)
│   └── layout/           # menu lateral, cabeçalho, container
├── features/
│   ├── auth/             # telas e hooks de login e cadastro
│   ├── produtos/
│   │   ├── components/   # ProdutoCard, ProdutoForm, UploadFoto, FiltroCategoria
│   │   ├── hooks/        # useProdutos
│   │   ├── services/     # chamadas à API
│   │   └── pages/
│   ├── empresas/         # cadastro de empresa e seletor de empresa
│   ├── categorias/       # cadastro e edição de categorias
│   ├── movimentacoes/
│   ├── precificacao/
│   └── dashboard/        # cartões, gráficos e rankings
├── lib/                  # cliente Supabase Auth, cliente HTTP
├── routes/               # rotas e proteção de rotas privadas
└── main.tsx
```

**Princípios**

- `components/ui` não conhece regra de negócio.
- Cada `feature` é independente e só usa `components/ui` e `lib`.
- Chamadas HTTP ficam em `services/`, nunca dentro do componente.
- Layout **mobile first**: começa no celular e cresce com os breakpoints do Tailwind (`sm`, `md`, `lg`).
- Tabelas viram cartões em telas pequenas.

## 6. Convenções de código

- **Comentários em português** explicando o *porquê* de cada regra, não só o *o quê*.
  Toda classe, caso de uso e função pública recebe um comentário de cabeçalho.
- Nomes de arquivos em `kebab-case`; classes em `PascalCase`; variáveis em `camelCase`.
- Um caso de uso por arquivo, com um único método público `executar()`.
- Nenhuma regra de negócio em controller ou componente visual.
- Erros de domínio com mensagens claras (ex.: `SaldoInsuficienteError`).
- Commits no padrão *Conventional Commits* (`feat:`, `fix:`, `docs:`).
- Variáveis sensíveis somente em `.env` (nunca no repositório).

### Exemplo de comentário esperado

```ts
/**
 * Caso de uso: registrar a saída de um produto do estoque.
 *
 * Regras:
 *  - a quantidade deve ser maior que zero;
 *  - não pode ser maior que o saldo atual (estoque não fica negativo).
 */
export class RegistrarSaida {
  async executar(entrada: RegistrarSaidaInput): Promise<void> { /* ... */ }
}
```

## 7. Testes

| Tipo | O que cobre | Prioridade |
|---|---|---|
| Unitário | Fórmula de preço, regras de saldo | **Alta** |
| Integração | Repositórios contra o Supabase de teste | Média |
| Isolamento | Empresa A **não** lê dados da empresa B | **Alta** |
| E2E | Fluxos principais no navegador | Baixa (fase final) |

## 8. Ambientes

| Ambiente | Uso |
|---|---|
| Local | Desenvolvimento com projeto Supabase de desenvolvimento |
| Homologação | Testes antes de publicar |
| Produção | Usuários reais, com backup ativo |

Cada ambiente tem seu **próprio projeto Supabase**.
