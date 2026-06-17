# Plan 006: Characterization tests for `buildGraph` (the layout engine)

> **Executor**: Follow step by step, verify each step. STOP and report on any STOP condition.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- src/lib/flow.ts`. If
> `flow.ts` changed, re-read it and adjust the asserted shapes to match the live exports.

## Status
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
`src/lib/flow.ts` is the entire layout engine: `buildGraph(tree)` turns the flat tree
into React Flow nodes/edges (couples become "union" junction nodes; children hang from
the union when both partners are parents; single-parent children get a direct edge). It
runs on every render and has ZERO tests. It's pure and deterministic, so it's cheap to
characterize — and a refactor that breaks union routing or freshness would otherwise
ship silently. Lock the contract now.

## Current state
`src/lib/flow.ts` exports (verified at plan time):
- `buildGraph(tree: TreeData): FlowGraph` where
  `FlowGraph = { nodes: FlowNode[]; edges: {id,source,target,type:"smoothstep",data:{kind:"couple"|"parent"}}[] }`
  and `FlowNode` is either `{type:"person", id, position, data:{label,line,fresh,freshLabel}}`
  or `{type:"union", id:"u:"+coupleId, position, data:{}, draggable:false, selectable:false}`.
- `freshness(updatedAt): { fresh: boolean; label: string }` — fresh within 48h; labels
  "recién" (<12h), "hoy" (<24h), "ayer" (<48h); else `{fresh:false,label:""}`.
- `personLine(p): string` — joins birthplace + birthYear with " · ", appends " — {deathYear}".
- Types: `TreeData = { persons: PersonRow[]; couples: Edge2[]; parentChild: PCEdge[] }`,
  `Edge2 = { id?: string; personA: string; personB: string }`, `PCEdge = {parentId, childId}`,
  `PersonRow` has `id,name,birthplace,birthYear,...,living,updatedAt`.

Behavior to pin (from reading `buildGraph`, lines 75-154):
- Each couple with both persons present adds ONE union node (`u:{coupleId}`) and TWO
  "couple"-kind edges (each partner → union).
- A child whose parents are BOTH members of a couple hangs from the union: ONE "parent"
  edge `union → child` (NOT two direct parent→child edges).
- A parent→child edge NOT covered by a union (single/unknown other parent) becomes a
  direct "parent" edge `parent → child`.
- Couples referencing a missing person are skipped (no union node, no edges).

Reference test conventions: see `test/persons.test.ts` (vitest, `describe/it/expect`).
Note: `buildGraph` is PURE — these tests need NO database and NO pglite mock. Do not copy
the `vi.mock("@/db")` block; import `buildGraph` directly.

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Run new test | `npx vitest run test/flow.test.ts` | all pass |
| Full unit suite | `npx vitest run --exclude '**/*.live.test.ts'` | all pass (26 existing + new) |
| Typecheck | `npx tsc --noEmit` | exit 0 |

## Scope
**In scope**: `test/flow.test.ts` (create)
**Out of scope**: `src/lib/flow.ts` (do NOT change the implementation — this is
characterization; if a test reveals a bug, STOP and report, don't fix it here).

## Git workflow
- Commit message: `test: characterization tests for buildGraph layout`
- Body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Create `test/flow.test.ts`
Import `{ buildGraph, freshness, personLine }` from `@/lib/flow`. Write a small
`person(id, name, overrides)` helper that returns a valid `PersonRow` (set
`updatedAt` to an old date like `new Date("2000-01-01")` by default so `fresh` is false
unless a test overrides it).

Add these cases (assert STRUCTURE, never pixel positions — dagre positions vary):

1. **single person**: one person, no couples/edges → `nodes` has 1 person node, 0 union
   nodes, `edges` is empty.
2. **couple**: persons A,B + one couple `{id:"c1",personA:A,personB:B}` → 2 person nodes,
   1 union node with id `u:c1`, exactly 2 edges both `data.kind==="couple"`.
3. **couple + shared child**: A,B,C + couple c1(A,B) + parentChild [{A,C},{B,C}] →
   3 person nodes, 1 union node, edges include exactly 2 "couple" edges and exactly 1
   "parent" edge whose `source === "u:c1"` and `target === C`. Assert there is NO direct
   A→C or B→C parent edge.
4. **single-parent child**: A,C + parentChild [{A,C}] (no couple) → 0 union nodes, exactly
   1 "parent" edge `source===A,target===C`.
5. **couple referencing a missing person**: couple c1(A, "ghost") where "ghost" not in
   persons → no `u:c1` union node, no couple edges for it.
6. **freshness**: `freshness(new Date())` → `{fresh:true, label:"recién"}`;
   `freshness(new Date("2000-01-01"))` → `{fresh:false, label:""}`.
7. **personLine**: a person with birthplace "Roma" + birthYear 1900 → `"Roma · 1900"`;
   add deathYear 1980 → `"Roma · 1900 — 1980"`.

Each assertion must check real behavior (counts, ids, edge kinds), not `toBeDefined()`.

### Step 2: Run and confirm
**Verify**: `npx vitest run test/flow.test.ts` → all new tests pass;
`npx vitest run --exclude '**/*.live.test.ts'` → whole suite green.

## Done criteria
- [ ] `test/flow.test.ts` exists with ≥ 7 meaningful assertions covering the cases above
- [ ] `npx vitest run test/flow.test.ts` passes
- [ ] full unit suite passes; `npx tsc --noEmit` exits 0
- [ ] `src/lib/flow.ts` is unchanged (`git status` shows only the new test file)

## STOP conditions
- A characterization test fails against current behavior — that may be a real bug in
  `buildGraph`; STOP and report what you observed (do NOT change `flow.ts` to make a test
  pass, and do NOT weaken the assertion).

## Maintenance notes
- These tests pin the union-routing contract; if the layout model changes (e.g. couples
  stop using a junction node), update them deliberately alongside the implementation.
</content>
