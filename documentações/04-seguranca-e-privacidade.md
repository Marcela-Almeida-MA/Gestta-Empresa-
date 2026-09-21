# Segurança e Privacidade

## 1. Isolamento entre empresas (multiempresa)

Cada empresa só pode ver e alterar os **próprios** dados. A proteção acontece em
**duas camadas**:

1. **Backend:** valida o JWT e o perfil do usuário em cada requisição.
2. **Banco (RLS):** mesmo que o código tenha uma falha, o Postgres bloqueia
   o acesso a dados de outra empresa. **Esta é a proteção principal.**

### 1.1 Funções auxiliares

Como uma pessoa pode ter várias empresas, as políticas liberam as linhas de
**todas as empresas das quais ela é membro**. A API sempre filtra pela empresa
escolhida (`X-Empresa-Id`) e confere a participação antes de responder.

```sql
-- Empresas das quais o usuário logado participa.
-- security definer: lê membros_empresa sem cair em recursão de RLS.
create or replace function public.empresas_do_usuario()
returns setof uuid
language sql stable security definer
set search_path = public
as $$
  select empresa_id from public.membros_empresa where usuario_id = auth.uid()
$$;

-- Papel do usuário logado em uma empresa ('admin', 'operador' ou nulo).
create or replace function public.papel_na_empresa(p_empresa uuid)
returns text
language sql stable security definer
set search_path = public
as $$
  select papel from public.membros_empresa
   where empresa_id = p_empresa and usuario_id = auth.uid()
$$;
```

### 1.2 Padrão de política (aplicar em todas as tabelas de negócio)

```sql
alter table public.produtos enable row level security;

-- Só lê e escreve linhas de empresas das quais o usuário é membro.
create policy "isolamento por empresa"
  on public.produtos
  for all
  to authenticated
  using      (empresa_id in (select public.empresas_do_usuario()))
  with check (empresa_id in (select public.empresas_do_usuario()));
```

Nas tabelas em que só o admin pode escrever (categorias, despesas, precificação),
a política de escrita usa `public.eh_admin_da_empresa(empresa_id)`.

### 1.3 Regras especiais

| Tabela | Política |
|---|---|
| `movimentacoes` | Permitir apenas `select` e `insert`. **Sem** `update` e `delete`. |
| `categorias` | Todos da empresa leem; apenas `admin` cria, edita e exclui. |
| `despesas_fixas`, `configuracoes_precificacao`, `despesas_adicionais_produto`, `precificacoes` | Somente `admin` (ver e escrever). |
| `perfis` | Cada usuário lê o próprio perfil e o de quem participa das mesmas empresas; edita apenas o próprio. |
| `membros_empresa` | Usuário lê os membros das suas empresas; só `admin` da empresa altera papéis, adiciona ou remove membros. |
| `empresas` | Usuário lê apenas as empresas das quais é membro; só `admin` edita. Qualquer usuário logado pode criar uma nova (via API). |
| `storage.objects` (fotos) | Acesso somente se o primeiro trecho do caminho for o id de uma empresa listada em `empresas_do_usuario()`. |

> **Atenção:** o operador consegue ler `custo_unitario` na tabela `produtos`. Se for
> necessário escondê-lo, crie uma view sem essa coluna para o operador e restrinja o
> `select` da tabela ao admin.

### 1.4 Checklist obrigatório

- [ ] RLS **ativado** em todas as tabelas (`enable row level security`).
- [ ] Nenhuma tabela criada sem política (RLS ligado sem política bloqueia tudo, o que é seguro).
- [ ] Bucket de fotos **privado**.
- [ ] `service_role` **nunca** vai para o front nem para o repositório.
- [ ] Teste automatizado: usuário da empresa A tenta ler/gravar dados da empresa B (da qual **não** é membro) e **falha**.
- [ ] Teste automatizado: usuário membro de A e B só recebe dados da empresa enviada em `X-Empresa-Id`.
- [ ] Teste automatizado: operador não consegue criar categoria nem alterar despesas.

## 2. Cadastro de empresa

Ao se cadastrar, a pessoa cria o usuário e a primeira empresa:

1. Front chama `signUp` no Supabase Auth (e-mail e senha).
2. Front chama a API: `POST /empresas` com o nome da empresa e a **estimativa de unidades vendidas por mês**.
3. A API chama a função `criar_empresa` do banco, que cria, em **uma única transação**: a empresa, a participação do usuário como `admin` e a configuração de precificação inicial. Não usa `service_role`.
4. O usuário entra no sistema já dentro da empresa criada.

**Mais empresas na mesma conta:** o usuário logado chama `POST /empresas` de
novo (ex.: empresa de bolsas, de embalagens, de camisas). Cada uma nasce com
dados próprios e ele é admin de todas que criar.

**Convites:** o admin convida por e-mail. Se o e-mail já tem conta, a pessoa é
adicionada à empresa com o papel escolhido. Se não tem, recebe um convite para
criar a conta e entrar direto na empresa.

## 3. Autenticação e sessão

- Senhas e tokens são gerenciados pelo **Supabase Auth**. O sistema nunca guarda senha.
- Exigir **confirmação de e-mail** no cadastro.
- Política de senha: mínimo de 8 caracteres.
- Recuperação de senha por e-mail.
- Tokens de curta duração, com renovação automática.
- Recomendado: opção de **verificação em duas etapas (MFA)** para administradores.

## 4. Segurança da aplicação

| Tema | Medida |
|---|---|
| Transporte | Somente HTTPS |
| Validação | Todo dado de entrada validado na API (tipo, tamanho, faixa) |
| Injeção de SQL | Consultas parametrizadas pelo cliente Supabase; nada de SQL montado por concatenação |
| XSS | Não renderizar HTML vindo do usuário; usar o escape padrão do React |
| CORS | Liberar apenas o domínio do front |
| Abuso | Limite de requisições (rate limit) no login e na API |
| Upload | Validar tipo real do arquivo, limitar o tamanho e renomear o arquivo |
| Segredos | Somente em variáveis de ambiente; `.env` no `.gitignore` |
| Logs | Nunca registrar senhas, tokens ou dados pessoais completos |
| Dependências | Verificação periódica de vulnerabilidades (`npm audit`) |

## 5. Privacidade (LGPD)

### 5.1 Dados tratados

| Dado | Finalidade | Base legal sugerida |
|---|---|---|
| E-mail e nome do usuário | Acesso e identificação | Execução de contrato |
| Nome e documento da empresa | Identificar a conta | Execução de contrato |
| Dados de estoque e financeiro | Prestar o serviço | Execução de contrato |

**Minimização:** coletar somente o necessário. O documento (CNPJ/CPF) é opcional.

### 5.2 Direitos do titular

O sistema deve permitir:

- **Acessar e corrigir** os próprios dados (tela de perfil).
- **Exportar** os dados da empresa (CSV/JSON).
- **Excluir a própria conta** (remove as participações do usuário) e, para o admin, **excluir uma empresa** e todos os seus dados, com confirmação.
- Consultar os **Termos de Uso** e a **Política de Privacidade** (aceite no cadastro).

### 5.3 Boas práticas

- Aceite dos termos registrado com data e hora no cadastro.
- Backups automáticos do Supabase, com retenção definida.
- Definir prazo de guarda e regra de descarte após o cancelamento da conta.
- Registrar quem é o responsável pelo tratamento e o canal de contato para pedidos de titulares.
- Em caso de incidente de segurança, seguir o plano de comunicação previsto na LGPD.

> Os textos de Termos de Uso e Política de Privacidade devem ser revisados por
> um profissional jurídico antes da publicação.

## 6. Papéis e permissões

O papel é definido **por empresa**: a mesma pessoa pode ser admin em uma e operador em outra.

| Ação | Admin | Operador |
|---|:---:|:---:|
| Ver produtos e saldo | ✅ | ✅ |
| Cadastrar/editar produtos | ✅ | ❌ |
| Registrar entrada e saída | ✅ | ✅ |
| Ver histórico de movimentações | ✅ | ✅ |
| Gerenciar despesas e precificação | ✅ | ❌ |
| Ver e filtrar por categorias | ✅ | ✅ |
| Gerenciar categorias | ✅ | ❌ |
| Ver dashboard de movimentação (unidades) | ✅ | ✅ |
| Ver valores em R$ no dashboard e no financeiro | ✅ | ❌ |
| Convidar e remover usuários | ✅ | ❌ |
| Excluir a empresa | ✅ | ❌ |
| Criar uma nova empresa na própria conta | ✅ | ✅ |
