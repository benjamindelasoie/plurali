# plurali

A collaborative family-tree archive. A family starts a tree and shares links (one
open "join" link + per-person anchored links); each branch fills in its own people,
no signup. The emotional core is a living archive — facts are stewarded, memory is
collective.

## Stack

- **Next.js 16** (App Router) + **TypeScript**, **React 19**
- **Neon** (serverless Postgres) + **Drizzle** ORM
- **React Flow** + **dagre** for the explorable mesh layout
- **Capability-link auth** — no accounts in V0; access rides on a URL token (`?k=…`)
- **GraphQL Yoga** — a parallel learning read-path, opt-in via `?gql=1`

## Getting started

```bash
git clone <repo> && cd plurali
npm install
cp .env.example .env.local   # then set DATABASE_URL to your Neon connection string
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run test` | Run tests on pglite. The `*.live.test.ts` files need a real `DATABASE_URL`; the rest run in-memory on `@electric-sql/pglite`. |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` — fast type gate |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:push` | Push the schema to the database |

## Where to read next

- **`DESIGN.md`** — design system and decisions log. Read this before any UI change.
- **`CLAUDE.md`** — project brief and agent guidance.
- **`TODOS.md`** — deferred work and roadmap.
- **`docs/ideas/true-federation.md`** — a longer-horizon idea.
