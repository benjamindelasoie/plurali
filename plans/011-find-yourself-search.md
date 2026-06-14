# Plan 011: "Find yourself" search for open-link recipients

> **Executor**: Follow step by step, verify each step. STOP and report on any STOP
> condition. Read `DESIGN.md` first — especially the "No chrome" rule and the voice.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- src/components/TreeExplorer.tsx`.

## Status
- **Priority**: P2
- **Effort**: M
- **Risk**: MED (adds a control to the main screen; design-sensitive)
- **Depends on**: none (coordinates with 010 if both land)
- **Category**: direction
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
An open ("join") link drops the recipient at the root of a tree of N people with no anchor
(TODOS.md #1). A non-tech-fluent older relative — a hard-requirement audience — may not
recognize owner-spelled names (Müller/Mueller, maiden vs married) and has no way to locate
themselves. A discreet name search ("¿sos vos? buscá tu nombre") lets them find and focus
their card so they can start contributing. Anchored-link recipients already land focused
(plan 010); this serves the OPEN-link case.

## Current state
- `src/components/TreeExplorer.tsx` holds the full `tree.persons` array and a `selected`
  state; selecting a person shows its `DetailCard` and the fit/focus logic centers it
  (after plan QA, `fit.current?.()` re-fits on count change; selection centers via React
  Flow). There is currently no search UI.
- `DESIGN.md` "No chrome" rule: "no persistent toolbar, no search bar on the canvas
  (open-link 'find yourself' search is a tracked TODO)." So search must be a DISCREET,
  contextual affordance — not a permanent SaaS search bar. Voice is warm Spanish, italic
  marginalia for hints, `.pl-act`/`.pl-input`/`.pl-btn` primitives.
- `src/lib/flow.ts` exports `personLine(p)` for the secondary line.

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Build | `npm run build` | exit 0 |
| Manual | open a tree, use search, click a result | the matching person is focused/centered |
| Optional unit | `npx vitest run test/<search-helper>.test.ts` | pass (if the matcher is extracted) |

## Scope
**In scope**: `src/components/TreeExplorer.tsx` (search affordance + focus-on-select), a
small `src/lib/search.ts` (a pure, accent-insensitive name matcher) + `test/search.test.ts`,
and minimal `globals.css` additions if needed (reuse existing `.pl-*` where possible).
**Out of scope**: server-side search (client-side over the loaded tree is correct at family
scale), the mobile view (plan 013), changing the auth model.

## Git workflow
- Commits: 1) `feat: accent-insensitive person name matcher (+test)` 2) `feat: find-yourself search in the explorer`
- Each body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Pure matcher + test
Create `src/lib/search.ts` exporting `matchPersons(persons, query)` that normalizes both
sides (lowercase, strip diacritics via `String.prototype.normalize("NFD")` + remove combining
marks) and returns persons whose name includes the normalized query (substring is fine at
family scale). Empty/whitespace query → empty result. Create `test/search.test.ts` with
cases: "muller" matches "Müller"; "ana" matches "Ana María"; "" → []; no-match → [].
**Verify**: `npx vitest run test/search.test.ts` → pass.

### Step 2: Discreet search affordance in TreeExplorer
Add a quiet, contextual search entry (NOT a permanent toolbar). Suggested: a small
"¿sos vos? buscá tu nombre" text action that expands into a single `.pl-input` (Fraunces,
underline) with a live result list (name + `personLine`). Selecting a result sets
`selected` to that person id (which focuses + centers via the existing logic) and collapses
the search. Keep it out of the way of the "Agregar familiares" button and the add-mode hint
(mind the mobile header spacing fixed in QA). Touch-friendly: ≥44px targets, persistent
underline on the action (no hover-to-discover).
**Verify**: `npm run build` → 0; manual: searching "mul" surfaces "Müller" and clicking it
focuses that card.

### Step 3: Gates
**Verify**: `npx tsc --noEmit` → 0; `npm run build` → 0; full unit suite green.

## Done criteria
- [ ] `matchPersons` is accent-insensitive and tested (`test/search.test.ts` passes)
- [ ] a discreet search affordance focuses the chosen person; it is NOT a permanent canvas toolbar
- [ ] `npx tsc --noEmit` 0; `npm run build` 0; unit suite green
- [ ] DESIGN.md voice + "no chrome" intent respected (≤ one quiet control at rest)

## STOP conditions
- The only way to fit the search is a persistent always-visible search bar on the canvas —
  that contradicts DESIGN.md; STOP and propose placement options instead of shipping it.

## Maintenance notes
- The result-row component and matcher are reusable by plan 010's "mint anchored link for
  whom?" picker — share them if 010 lands after this.
- Fuzzy ranking (Levenshtein) is a possible follow-up; substring is enough for V0.
</content>
