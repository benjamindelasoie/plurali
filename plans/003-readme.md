# Plan 003: Replace the boilerplate README

> **Executor**: Follow step by step. STOP and report on any STOP condition.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- README.md`. If README
> changed materially since plan time, read it before overwriting.

## Status
- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
`README.md` is the unmodified create-next-app template (sections on "Getting Started",
"Learn More", "Deploy on Vercel"). A developer or agent cloning the repo learns nothing
about plurali: what it is, that it uses capability-link auth, that tests run on pglite,
or where the real docs live. The README is the front door; right now it points at
Next.js docs instead of this project.

## Current state
`README.md` begins:
```
This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`]...
## Getting Started
First, run the development server:
```bash
npm run dev
...
```
The repo's real docs are: `DESIGN.md` (design system + decisions log), `TODOS.md`
(deferred work), `CLAUDE.md` (project brief / agent guidance), `AGENTS.md` (Next.js
version warning), `docs/ideas/true-federation.md`. `.env.example` defines `DATABASE_URL`.
Stack (from `package.json` + `CLAUDE.md`): Next.js 16 App Router + TypeScript, React 19,
Neon Postgres + Drizzle, React Flow + dagre, GraphQL Yoga (parallel learning layer),
vitest + @electric-sql/pglite for tests. Verification: `npm run dev`, `npm run build`,
`npm run test` (live tests need `DATABASE_URL`), `npm run lint`.

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Build (smoke) | `npm run build` | exit 0 (README change shouldn't affect it, but confirm tree still builds) |

## Scope
**In scope**: `README.md`
**Out of scope**: every other file. Do not invent setup steps not backed by the repo
(only reference `DATABASE_URL`, the real scripts, and the real doc files).

## Git workflow
- Commit message: `docs: real README for plurali (replace create-next-app boilerplate)`
- Body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Rewrite README.md
Replace the whole file with content covering, in this order:
1. **One-line what-it-is**: "plurali — a collaborative family-tree archive. A family
   starts a tree and shares links (one open 'join' link + per-person anchored links);
   each branch fills in its own people, no signup."
2. **Stack**: Next.js 16 (App Router) + TypeScript, React 19, Neon Postgres + Drizzle,
   React Flow + dagre for the mesh, capability-link auth (no accounts in V0). Note the
   GraphQL Yoga layer is a parallel learning read-path (`?gql=1`).
3. **Getting started**: clone → `npm install` → copy `.env.example` to `.env.local` and
   set `DATABASE_URL` (Neon connection string) → `npm run dev`.
4. **Scripts**: `dev`, `build`, `test` (note: `*.live.test.ts` need a real `DATABASE_URL`;
   the rest run on pglite), `lint`, `typecheck` (if plan 001 has landed), `db:generate` /
   `db:push` (Drizzle).
5. **Where to read next**: `DESIGN.md` (design system, READ before any UI change),
   `CLAUDE.md` (project brief), `TODOS.md` (roadmap), `docs/ideas/true-federation.md`.

Keep it concise (under ~60 lines). Match the calm, plain tone of the existing docs.

**Verify**: `grep -q "create-next-app" README.md && echo STILL_BOILERPLATE || echo OK` → `OK`.

## Done criteria
- [ ] `grep -c "plurali" README.md` ≥ 1
- [ ] `grep "create-next-app" README.md` returns nothing
- [ ] README mentions `DATABASE_URL`, `DESIGN.md`, and `npm run dev`
- [ ] Only `README.md` is modified

## STOP conditions
- You're unsure of a setup step and would have to guess — write only what the repo's
  `.env.example` / `package.json` / docs support, and note the gap rather than invent.

## Maintenance notes
- Keep the scripts list in sync with `package.json` when scripts change.
</content>
