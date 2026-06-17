# Plan 001: Add a `typecheck` npm script

> **Executor**: Follow step by step. Run every verification command and confirm the
> expected result before moving on. If a STOP condition occurs, stop and report.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- package.json`
> If `package.json` changed since this plan was written, compare the "Current state"
> excerpt to the live file before editing; on mismatch, STOP.

## Status
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
There is no fast type gate. The only way to catch type errors today is a full
`next build`, which is slow for CI and impossible in a pre-commit hook. A one-line
`typecheck` script makes `tsc --noEmit` a first-class, sub-second verification step
that every other plan in this batch already relies on.

## Current state
`package.json` scripts block (no `typecheck`):
```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "db:generate": "drizzle-kit generate",
  "db:push": "drizzle-kit push",
  "db:studio": "drizzle-kit studio",
  "test": "vitest run",
  "test:watch": "vitest",
  "graphql:codegen": "graphql-codegen --config codegen.ts"
}
```
`tsc` resolves from devDependencies (TypeScript is installed). `npx tsc --noEmit`
already runs clean in this repo.

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0, no output |
| Run new script | `npm run typecheck` | exit 0, no output |

## Scope
**In scope**: `package.json`
**Out of scope**: every other file. Do not touch `tsconfig.json`.

## Git workflow
- Commit message (conventional, matches repo log): `chore: add typecheck npm script`
- End the commit body with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- Do not push.

## Steps
### Step 1: Add the script
Add a `"typecheck": "tsc --noEmit"` entry to the `scripts` object in `package.json`
(place it next to `"lint"`).

**Verify**: `npm run typecheck` → exit 0, no errors.

## Done criteria
- [ ] `npm run typecheck` exits 0
- [ ] `grep '"typecheck"' package.json` returns the new line
- [ ] `git status` shows only `package.json` modified

## STOP conditions
- `npm run typecheck` reports type errors (the repo was clean at plan time — a failure
  means drift; report the errors, do not "fix" unrelated code).

## Maintenance notes
- Wire this into CI and any pre-commit hook as the cheap type gate before `build`.
</content>
