# Plan 007: `addRelative` must verify `relationTo` belongs to the caller's tree

> **Executor**: Follow step by step, verify each step. STOP and report on any STOP condition.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- src/lib/persons.ts`. If
> `persons.ts` changed, re-read `addRelative` and confirm the missing check before editing.

## Status
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
Every other mutation that references an existing person validates that the id belongs to
the caller's tree (`ctx.treeId`) before writing — `connectParent` (persons.ts:166-170),
`addChildToCouple` (`:140-145`), `addChildWithParents` (`:199-204`). `addRelative` does
NOT: it inserts a couple / parent-child edge using the caller-supplied `relationTo`
without checking it's in `ctx.treeId`. A holder of a valid link to tree A can pass a
person id from tree B and write a cross-tree edge (and probe which ids exist). Reads are
tree-scoped so the damage is limited to orphan rows + existence probing, but it's an
inconsistent tenant boundary in the one security-critical module. Make `addRelative`
match its siblings.

## Current state
`src/lib/persons.ts`, `addRelative` (lines 87-118) — note: NO tree check on `relationTo`:
```ts
export async function addRelative(ctx: TreeContext, rawInput: unknown) {
  const { person, relationTo, relation } = addRelativeInput.parse(rawInput);
  const [p] = await db.insert(persons).values({ ...fields(ctx.treeId, person), createdByLinkId: ctx.linkId }).returning();
  if (relationTo && relation) {
    if (relation === "partner") {
      await db.insert(couples).values({ treeId: ctx.treeId, personA: relationTo, personB: p.id, createdByLinkId: ctx.linkId });
    } else if (relation === "child") {
      if (await wouldCreateCycle(ctx.treeId, relationTo, p.id)) throw new MutationError("Eso crearía un ciclo en el árbol.");
      await db.insert(parentChild).values({ treeId: ctx.treeId, parentId: relationTo, childId: p.id, createdByLinkId: ctx.linkId });
    } else if (relation === "parent") {
      if (await wouldCreateCycle(ctx.treeId, p.id, relationTo)) throw new MutationError("Eso crearía un ciclo en el árbol.");
      await db.insert(parentChild).values({ treeId: ctx.treeId, parentId: p.id, childId: relationTo, createdByLinkId: ctx.linkId });
    }
  }
  return p;
}
```
The exemplar pattern to copy, from `connectParent` (`:166-170`):
```ts
const found = await db.select({ id: persons.id }).from(persons)
  .where(and(eq(persons.treeId, ctx.treeId), inArray(persons.id, [parentId, childId])));
if (found.length < 2) throw new MutationError("No se encontró la persona.");
```
`MutationError`, `and`, `eq`, `inArray`, `persons` are already imported in this file.
Error-message voice: Spanish, e.g. `"No se encontró la persona."` (match existing).

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Tests | `npx vitest run test/persons.test.ts --exclude '**/*.live.test.ts'` | all pass incl. new |
| Full unit suite | `npx vitest run --exclude '**/*.live.test.ts'` | all pass |
| Typecheck | `npx tsc --noEmit` | exit 0 |

## Scope
**In scope**: `src/lib/persons.ts`, `test/persons.test.ts` (add a new `it`, do not change
existing tests).
**Out of scope**: other mutations (they already check), the validation schemas, the
GraphQL layer.

## Git workflow
- Commit message: `fix(security): scope relationTo to the caller's tree in addRelative`
- Body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Add the tenant check
In `addRelative`, immediately after parsing input and BEFORE inserting the new person
(or at minimum before any couple/parentChild insert), when `relationTo` is provided,
verify it exists in `ctx.treeId`:
```ts
if (relationTo) {
  const [rel] = await db.select({ id: persons.id }).from(persons)
    .where(and(eq(persons.id, relationTo), eq(persons.treeId, ctx.treeId))).limit(1);
  if (!rel) throw new MutationError("No se encontró la persona.");
}
```
Place it before the `db.insert(persons)` for the new person so a bad `relationTo` does
not leave a stranded person (this also helps plan 008). Keep the rest of the logic.

**Verify**: `npx tsc --noEmit` → exit 0.

### Step 2: Add a regression test
In `test/persons.test.ts`, add a NEW `it` (do not modify existing ones). Pattern: create
two trees, then call `addRelative` on tree A's ctx with `relationTo` set to a person from
tree B; expect it to reject.
```ts
it("addRelative rejects a relationTo from another tree", async () => {
  const a = await freshTree();
  const { token: tokenB } = await createTree("Otra Familia");
  const ctxB = await requireTreeContext(tokenB);
  const foreign = await addPerson(ctxB, { name: "Ajeno" });
  await expect(
    addRelative(a, { person: { name: "Intruso" }, relationTo: foreign.id, relation: "partner" })
  ).rejects.toBeTruthy();
});
```
(`freshTree`, `createTree`, `requireTreeContext`, `addPerson`, `addRelative` are already
imported/defined in the file.)

**Verify**: `npx vitest run test/persons.test.ts --exclude '**/*.live.test.ts'` → all pass.

### Step 3: Confirm the suite
**Verify**: `npx vitest run --exclude '**/*.live.test.ts'` → all green.

## Done criteria
- [ ] `addRelative` rejects a `relationTo` not in `ctx.treeId` (new test passes)
- [ ] existing `addRelative(partner)` / child / parent tests still pass (same-tree path unaffected)
- [ ] `npx tsc --noEmit` exits 0; full unit suite green
- [ ] only `src/lib/persons.ts` and `test/persons.test.ts` modified

## STOP conditions
- An existing `addRelative` test breaks in a way that isn't about the new check (e.g. the
  same-tree happy path now fails) — report; the check should be transparent to valid calls.

## Maintenance notes
- This makes the four relationship-writing mutations consistent. Plan 008 (atomicity)
  builds on this corrected control flow; land 007 first.
</content>
