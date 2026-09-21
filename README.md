# Gestta Empresa+

Projeto monorepo para um sistema de estoque, financeiro e precificação multiempresa.

## Estrutura

- `apps/api`: backend em NestJS + TypeScript
- `apps/web`: frontend em React + Vite + Tailwind CSS
- `documentações`: especificações do negócio e arquitetura
- `Sql`: migrações e scripts do banco do Supabase

## Desenvolvimento local

```bash
npm install
npm run dev:api
npm run dev:web
```

## Build

```bash
npm run build
```

## Stack

- Front-end: React, Vite, Tailwind
- Backend: NestJS, TypeScript
- Banco: Supabase (PostgreSQL)
- Autenticação: Supabase Auth

## Observações

A documentação de requisitos e arquitetura está em [documentações/00-visao-geral-e-requisitos.md](documentações/00-visao-geral-e-requisitos.md).
