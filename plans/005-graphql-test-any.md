# Plan 005: Remove `any` casts in `graphql.test.ts` (make lint pass)

> **Executor**: Follow step by step, verify each step. STOP and report on any STOP condition.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- test/graphql.test.ts`.
> If it changed, re-locate the `any` usages with `grep -n "any" test/graphql.test.ts`.

## Status
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
`npm run lint` currently FAILS with 3 `@typescript-eslint/no-explicit-any` errors, all
in `test/graphql.test.ts`. A red lint blocks a clean CI gate and signals inconsistent
rigor in an otherwise strict-TypeScript repo. The fix is local and type-only.

## Current state
The repo is strict TS; `npm run lint` reports exactly:
```
test/graphql.test.ts
   32:41  error  Unexpected any  @typescript-eslint/no-explicit-any
   32:87  error  Unexpected any  @typescript-eslint/no-explicit-any
  136:51  error  Unexpected any  @typescript-eslint/no-explicit-any
```
Line 32 is the return cast of the `gql` helper:
```ts
return res.json() as Promise<{ data?: any; errors?: { message: string; extensions?: any }[] }>;
```
Line 136 is a second `any` cast at a call site (read it before editing — it asserts on a
query result). The `gql` helper is called throughout the file; call sites read fields like
`r.data.tree.people`.

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Lint | `npm run lint` | exit 0, no errors |
| Tests | `npx vitest run test/graphql.test.ts --exclude '**/*.live.test.ts'` | all pass |
| Typecheck | `npx tsc --noEmit` | exit 0 |

## Scope
**In scope**: `test/graphql.test.ts`
**Out of scope**: source files, other tests, the eslint config (do NOT disable the rule
or add `eslint-disable`).

## Git workflow
- Commit message: `test: drop any casts in graphql.test (lint clean)`
- Body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Introduce a typed GraphQL response shape
Near the top of the file, add a reusable type, e.g.:
```ts
type GqlResponse<T = Record<string, unknown>> = {
  data?: T;
  errors?: { message: string; extensions?: Record<string, unknown> }[];
};
```
Change the `gql` helper's return cast (line ~32) to use it:
`return res.json() as Promise<GqlResponse>;` (or make `gql` generic `gql<T>` if a call
site needs a concrete shape).

### Step 2: Fix the line ~136 `any`
Read the assertion at line 136 and replace its `any` with the typed shape (or a precise
inline type / `unknown` + a narrowing cast). Keep the assertion's intent identical.

### Step 3: Adjust call sites minimally if needed
If switching to `Record<string, unknown>` makes a field access (e.g. `r.data.tree`)
no longer type-check, cast at the specific access (`(r.data as { tree: ... })`) or
parameterize `gql<T>` per call. Do not loosen anything beyond what's needed to keep the
existing assertions compiling.

**Verify after all steps**:
- `npm run lint` → exit 0
- `npx vitest run test/graphql.test.ts --exclude '**/*.live.test.ts'` → all pass
- `npx tsc --noEmit` → exit 0

## Done criteria
- [ ] `npm run lint` exits 0 (no `no-explicit-any` errors)
- [ ] `grep -n ": any\|<any>\|as any" test/graphql.test.ts` returns nothing
- [ ] graphql.test.ts tests still pass
- [ ] No `eslint-disable` added; only `test/graphql.test.ts` modified

## STOP conditions
- Removing `any` cascades into needing `any` in source files — that means a real typing
  gap; report it rather than adding `any` elsewhere.

## Maintenance notes
- The codegen-typed `ExploreTreeQuery` (`src/graphql/gen/types.ts`) exists; a stronger
  follow-up is typing test queries against generated types, but that's out of scope here.
</content>
