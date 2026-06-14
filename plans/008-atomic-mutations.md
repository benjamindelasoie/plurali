# Plan 008: Make multi-write mutations atomic

> **Executor**: Follow step by step, verify each step. STOP and report on any STOP
> condition — this plan has a real driver-compatibility risk; do NOT improvise around it.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- src/lib/persons.ts src/db/index.ts`.
> Confirm plan 007's tenant check is present in `addRelative` before starting (this plan
> depends on it).

## Status
- **Priority**: P2
- **Effort**: M
- **Risk**: MED (driver migration)
- **Depends on**: 007
- **Category**: bug
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
Three mutations perform multiple dependent writes that are NOT atomic:
- `addChildToCouple` — insert child person, then insert 2 parent_child rows.
- `addChildWithParents` (with `otherParentName`) — insert child, insert other parent,
  insert couple, insert 2 parent_child rows.
- `addRelative` — insert person, then insert a couple or parent_child row.

If a later write fails (constraint, transient error), the earlier rows persist: a person
stranded with no relationships, or a child with one parent instead of two. For an archive
meant to last, silent partial state is the wrong failure mode.

The blocker: the prod driver is `drizzle-orm/neon-http` (`src/db/index.ts`), which does
NOT support interactive `db.transaction()`. The test driver is `drizzle-orm/pglite`
(`test/db.ts`), which does NOT support `db.batch()`. So neither `transaction()` nor
`batch()` works in BOTH environments today. The fix is to move prod onto
`drizzle-orm/neon-serverless` (Pool), which supports interactive `transaction()` exactly
like pglite — then one `db.transaction(...)` wrapping works in test and prod.

## Current state
`src/db/index.ts` (prod driver — neon-http, lazy proxy):
```ts
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
type Db = NeonHttpDatabase<typeof schema>;
let instance: Db | null = null;
function getDb(): Db {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("[plurali] DATABASE_URL is not set — no database connection available.");
    instance = drizzle(neon(url), { schema });
  }
  return instance;
}
export const db = new Proxy({} as Db, { get(_t, prop) { const real = getDb(); const v = Reflect.get(real as object, prop, real); return typeof v === "function" ? v.bind(real) : v; } });
export { schema };
```
The lazy proxy MUST be preserved (the comment explains: `neon()` throws at import without
`DATABASE_URL`, which broke Preview builds). `@neondatabase/serverless` is already a
dependency (it exports both `neon` and `Pool`).

`test/db.ts` uses `drizzle(new PGlite(), { schema })` from `drizzle-orm/pglite` — pglite
supports interactive transactions, so a `db.transaction()` works there unchanged.

The three mutations are in `src/lib/persons.ts` (after plan 007: `addRelative` now also
validates `relationTo`). Multi-write blocks: `addChildToCouple` `:147-154`,
`addChildWithParents` `:206-227`, `addRelative` `:89-115`.

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Unit suite (pglite) | `npx vitest run --exclude '**/*.live.test.ts'` | all pass |
| Build | `npm run build` | exit 0 |
| Live smoke (only if DATABASE_URL set) | `npx vitest run test/smoke.live.test.ts` | pass — skip if no DATABASE_URL |

## Scope
**In scope**: `src/db/index.ts` (driver swap), `src/lib/persons.ts` (wrap the 3 mutations
in `db.transaction`), `test/persons.test.ts` (add a completeness/atomicity test).
**Out of scope**: schema (`src/db/schema.ts`), the GraphQL layer, single-write mutations
(`addPerson`, `editPerson`, `connectParent`'s single insert — leave as-is). Do NOT remove
the lazy proxy. Do NOT add a `ws` dependency unless step 1's build proves it's required.

## Git workflow
- Two commits: (1) `refactor(db): neon-serverless Pool driver (enables transactions)`,
  (2) `fix: wrap multi-write person mutations in a transaction`.
- Each body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Migrate the prod driver to neon-serverless Pool
Edit `src/db/index.ts` to use the Pool driver while keeping the lazy proxy:
```ts
import { drizzle, type NeonDatabase } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";
type Db = NeonDatabase<typeof schema>;
let instance: Db | null = null;
function getDb(): Db {
  if (!instance) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("[plurali] DATABASE_URL is not set — no database connection available.");
    instance = drizzle(new Pool({ connectionString: url }), { schema });
  }
  return instance;
}
// keep the existing Proxy + `export { schema }` unchanged
```
**Verify**: `npx tsc --noEmit` → exit 0; `npm run build` → exit 0. If the build fails
because a WebSocket constructor is missing in the Node target, that is a STOP condition
(see STOP conditions) — do not add `ws` and keep going without confirming; report.

### Step 2: Wrap the three multi-write mutations in `db.transaction`
In `src/lib/persons.ts`, change `addChildToCouple`, `addChildWithParents`, and the
`relationTo` branch of `addRelative` so all of their writes happen inside a single
`await db.transaction(async (tx) => { ... })`, using `tx` for every insert/select in the
block (including the `relationTo` lookup added by plan 007 and the `wouldCreateCycle`
read — pass `tx`-scoped queries or keep the cycle read before the transaction; prefer
moving the existence/cycle checks INSIDE the transaction so check-and-write are atomic).
Return the created person from the transaction.

Example shape for `addChildToCouple`:
```ts
return await db.transaction(async (tx) => {
  const [couple] = await tx.select().from(couples).where(and(eq(couples.id, coupleId), eq(couples.treeId, ctx.treeId))).limit(1);
  if (!couple) throw new MutationError("No se encontró ese matrimonio.");
  const [c] = await tx.insert(persons).values({ ...fields(ctx.treeId, child), createdByLinkId: ctx.linkId }).returning();
  await tx.insert(parentChild).values([
    { treeId: ctx.treeId, parentId: couple.personA, childId: c.id, createdByLinkId: ctx.linkId },
    { treeId: ctx.treeId, parentId: couple.personB, childId: c.id, createdByLinkId: ctx.linkId },
  ]);
  return c;
});
```
`wouldCreateCycle` currently uses the module `db`; for the transactional mutations it's
acceptable to keep the cycle read on `db` (it reads committed state) OR refactor it to
accept an optional executor. Simplest correct choice: keep `wouldCreateCycle(ctx.treeId,…)`
as-is (a pre-check), then do the writes in the transaction. Document the choice in a
comment. Single-write mutations stay unchanged.

**Verify**: `npx vitest run --exclude '**/*.live.test.ts'` → all existing mutation tests
pass (transactions are transparent on the happy path under pglite).

### Step 3: Add an atomicity / completeness test
In `test/persons.test.ts` add a NEW `it` that asserts `addChildWithParents` with
`otherParentName` produces the COMPLETE graph in one go (child + other parent + couple +
two parent_child edges), proving the transactional block commits all writes together:
```ts
it("addChildWithParents creates child + other parent + couple + both edges atomically", async () => {
  const ctx = await freshTree();
  const parent = await addPerson(ctx, { name: "Ana" });
  const child = await addChildWithParents(ctx, { parentId: parent.id, otherParentName: "Luis", child: { name: "Sofi" } });
  const tree = await getTree(ctx.treeId);
  expect(tree.persons.map((p) => p.name).sort()).toEqual(["Ana", "Luis", "Sofi"]);
  expect(tree.couples).toHaveLength(1);
  expect(tree.parentChild.filter((e) => e.childId === child.id)).toHaveLength(2);
});
```
(True fault-injection rollback testing — forcing a mid-transaction failure and asserting
zero rows — is a follow-up noted in Maintenance; pglite has no easy hook here.)

**Verify**: `npx vitest run test/persons.test.ts --exclude '**/*.live.test.ts'` → pass.

### Step 4: Final gates
**Verify**: `npx tsc --noEmit` → 0; `npm run build` → 0; full unit suite green. If
`DATABASE_URL` is set in your env, run `npx vitest run test/smoke.live.test.ts` and
confirm it passes (proves the new driver talks to real Neon). If `DATABASE_URL` is NOT
set, note that the live path was not verified.

## Done criteria
- [ ] `src/db/index.ts` uses `drizzle-orm/neon-serverless` Pool, lazy proxy intact
- [ ] the 3 multi-write mutations run inside `db.transaction`
- [ ] `npx tsc --noEmit` exits 0; `npm run build` exits 0
- [ ] full unit suite green; new atomicity test passes
- [ ] only `src/db/index.ts`, `src/lib/persons.ts`, `test/persons.test.ts` modified

## STOP conditions
- `npm run build` fails after the driver swap (e.g. missing WebSocket constructor / `ws`
  resolution) — STOP and report. Do NOT silently add dependencies or polyfills; the
  reviewer will decide whether to add `ws`, pin a Node target, or defer this plan.
- Existing mutation tests fail under pglite with the transaction wrapping (pglite should
  support `db.transaction` — a failure means a real incompatibility) — STOP and report.
- The live smoke test fails against real Neon with the new driver — STOP and report (do
  not revert silently).

## Maintenance notes
- Follow-up: a true rollback test via fault injection (e.g. a temporary unique constraint
  or a forced error inside the transaction) would prove rollback, not just completeness.
- If the driver swap is rejected, the fallback is application-level compensation
  (try/catch + manual cleanup), which is fragile — prefer the transaction approach.
- `@neondatabase/serverless` Pool uses WebSockets; on Vercel's current Node runtime the
  global `WebSocket` is available. Watch this if the Node target changes.
</content>
