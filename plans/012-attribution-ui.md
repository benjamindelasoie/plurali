# Plan 012: Attribution UI — "de la mano de …" on the detail card

> **Executor**: Follow step by step, verify each step. STOP and report on any STOP
> condition. Read `DESIGN.md` (marginalia voice) first.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- src/lib/persons.ts src/lib/flow.ts src/components/TreeExplorer.tsx`.

## Status
- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none (keep `listLinks` shape stable if 010 also lands)
- **Category**: direction
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
Every person/edge row stamps `created_by_link_id` (the attribution columns from the
eng-review TODO #2 are already in the schema), and `DESIGN.md` specifies a marginalia line
("de la mano de Tía Marta · martes") as part of the "many hands" feeling. The data exists;
the display doesn't. Surfacing "who added this" on the focused card delivers the archive's
credit/provenance pillar with no schema change. Honest scope: links only carry a `label`
when one was set at mint time (anchored links can; the open + owner links have none), so
attribution shows the label when present and a warm fallback ("alguien de la familia")
otherwise — never a raw id.

## Current state
- `src/db/schema.ts`: `persons.createdByLinkId` references `links.id`; `links.label` is
  nullable text (set for some anchored links).
- `src/lib/persons.ts` `getTree(treeId)` returns `{ name, persons, couples, parentChild }`
  where `persons` is `db.select().from(persons)` — rows DO include `createdByLinkId`, but
  there is NO link-label resolution.
- `src/lib/flow.ts` `PersonRow` interface (lines ~18-30) does NOT include `createdByLinkId`
  or an author label; the `DetailCard` in `src/components/TreeExplorer.tsx` shows name +
  `personLine` + freshness + relationships + edit, with NO author line.
- `DESIGN.md`: marginalia is Literata italic, muted; freshness already shows "agregada {label}".

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Build | `npm run build` | exit 0 |
| Unit suite | `npx vitest run --exclude '**/*.live.test.ts'` | all pass |
| Manual | open a person added via a labeled anchored link | card shows "de la mano de {label}" |

## Scope
**In scope**: `src/lib/persons.ts` (`getTree` returns an author label per person, or a
`linkId → label` map), `src/lib/flow.ts` (`PersonRow` gains an optional `authorLabel`),
`src/components/TreeExplorer.tsx` (`DetailCard` renders the marginalia line), a unit test
in `test/persons.test.ts` for the label resolution.
**Out of scope**: edit-history/undo (that's the large half of TODO #2), the GraphQL read
path parity (note it, don't expand it), changing the attribution columns.

## Git workflow
- Commits: 1) `feat: resolve author link label in getTree` 2) `feat: attribution marginalia on the detail card`
- Each body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Resolve the author label in `getTree`
Extend `getTree` to also load the tree's links (`id`, `label`, `kind`) and attach an
`authorLabel` to each person (resolve `createdByLinkId` → that link's `label`; if the link
has no label, leave `authorLabel` undefined — the UI supplies the warm fallback). Keep the
return backward-compatible (additive field). Add a unit test: create a tree, mint a labeled
anchored link, add a person via that link's ctx, assert `getTree(...).persons[x].authorLabel`
equals the label.
**Verify**: `npx vitest run test/persons.test.ts --exclude '**/*.live.test.ts'` → pass.

### Step 2: Thread the type
Add `authorLabel?: string | null` to `PersonRow` in `src/lib/flow.ts` so the explorer types
flow through. (The GraphQL read path does not provide this yet — that's fine; it's the
non-default path. Note the gap in a comment.)
**Verify**: `npx tsc --noEmit` → 0.

### Step 3: Render the marginalia line
In `DetailCard` (`TreeExplorer.tsx`), add a muted italic line under the relationships, in
DESIGN.md voice: when `authorLabel` is set, "de la mano de {authorLabel}"; otherwise a warm
fallback like "agregada por la familia". Do NOT show raw link ids. Keep it muted (not
terracotta — terracotta is freshness-only).
**Verify**: `npm run build` → 0; manual: a person added via a labeled link shows the line.

### Step 4: Gates
**Verify**: `npx tsc --noEmit` → 0; `npm run build` → 0; full unit suite green.

## Done criteria
- [ ] `getTree` returns a per-person `authorLabel` resolved from the creating link's label
- [ ] the detail card shows "de la mano de {label}" (or a warm fallback), never a raw id
- [ ] unit test covers the label resolution
- [ ] `npx tsc --noEmit` 0; `npm run build` 0; unit suite green; only in-scope files changed

## STOP conditions
- Resolving labels would require an N+1 per person (a query per row) — instead load all
  tree links once and map in memory (family scale); if that's somehow not possible, STOP
  and report.

## Maintenance notes
- The "· martes" day part and full edit-history/undo are deferred (TODO #2 large half).
- If labels are usually empty (most contribution is via the open link, which has no label),
  consider letting contributors set a one-time "tu nombre" label per session in a future
  plan — note this as the real lever for richer attribution.
</content>
