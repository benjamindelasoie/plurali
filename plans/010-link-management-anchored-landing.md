# Plan 010: Owner link management + anchored-link landing

> **Executor**: Follow step by step, verify each step. STOP and report on any STOP
> condition. Read `DESIGN.md` before any UI work — match the fieldbook system.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- src/app/actions.ts src/lib/links.ts src/components/TreeExplorer.tsx src/app/t/[treeId]/page.tsx`.

## Status
- **Priority**: P2
- **Effort**: M
- **Risk**: MED (touches the main screen + a server action)
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
The capability-link model is the product, but the backend is only half-surfaced:
`mintContributeLink` (anchored), `listLinks`, and `revokeLink` exist in `src/lib/links.ts`
and `mintLinkAction`/`revokeLinkAction` in `src/app/actions.ts`, yet there is **no UI** to
mint an anchored link, list links, or revoke one — even though `DESIGN.md` calls revoke
"the leak defense — make it prominent in UI." And the page reads the token but ignores the
link's `seedPersonId`, so an anchored-link recipient lands at the root instead of on their
own card ("sos vos? agregá tu familia"). This plan completes the link loop: anchored
landing + an owner-only link manager + the small `seedPersonId` validation hardening.

## Current state
- `src/lib/auth.ts` `requireTreeContext(token)` returns `{ treeId, linkId, kind, isOwner, seedPersonId }`.
- `src/lib/links.ts`: `mintContributeLink(treeId, {kind, seedPersonId?, label?})` stores
  `seedPersonId` for anchored links WITHOUT validating it belongs to `treeId` (the hardening);
  `listLinks(treeId)` returns `{id, kind, seedPersonId, label, revokedAt, createdAt}[]`;
  `revokeLink(treeId, linkId)`.
- `src/app/actions.ts`: `mintLinkAction(token,{kind,seedPersonId?,label?})` (owner-only),
  `revokeLinkAction(token, linkId)` (owner-only). There is NO `listLinksAction` yet.
- `src/app/t/[treeId]/page.tsx` resolves the tree via `getTreeAction(token)` and renders
  `<TreeExplorer tree=… treeName=… token=… />`. It does not pass `seedPersonId` or `isOwner`.
- `src/components/TreeExplorer.tsx` manages `selected` (defaults `null`); a `DetailCard`
  shows for the selected person; the only owner action surfaced is the create-time reveal
  in `CreateTree.tsx`. The "Agregar familiares" button lives top-right.
- `DESIGN.md` voice: vine primary buttons (`.pl-btn`), quiet underlined text actions
  (`.pl-act`), the dashed link slip (`.pl-slip`), terracotta is freshness-only.

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Build | `npm run build` | exit 0 |
| Unit suite | `npx vitest run --exclude '**/*.live.test.ts'` | all pass |
| Manual: anchored landing | mint an anchored link for person X, open it | X's card is focused on load |
| Manual: link manager | as owner, open the manager, mint + revoke a link | list updates; revoked shows revoked |

## Scope
**In scope**: `src/lib/links.ts` (validate seedPersonId), `src/app/actions.ts` (add
`listLinksAction`; pass seedPersonId/isOwner where needed), `src/app/t/[treeId]/page.tsx`
(thread `seedPersonId` + `isOwner` to TreeExplorer), `src/components/TreeExplorer.tsx`
(accept `initialSelected` + `isOwner`; focus seed on mount; render an owner-only link
manager), a new `src/components/LinkManager.tsx`, and a unit test in `test/persons.test.ts`
or a new `test/links.test.ts` for the seedPersonId validation.
**Out of scope**: changing the auth model, the GraphQL layer, the mobile view (plan 013).

## Git workflow
- Commit in logical units, e.g.:
  1. `fix(security): validate anchored seedPersonId belongs to the tree`
  2. `feat: anchored links land on the seeded person's card`
  3. `feat: owner link manager (mint anchored / list / revoke)`
- Each body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Validate `seedPersonId` in `mintContributeLink` (SECURITY-02)
In `src/lib/links.ts`, for `kind === "anchored"`, before inserting, verify the
`seedPersonId` exists in `treeId` (select from `persons` where id + treeId); throw a clear
error otherwise. Add a unit test asserting an anchored mint with a foreign/nonexistent
person id rejects.
**Verify**: `npx vitest run --exclude '**/*.live.test.ts'` → pass incl. new test.

### Step 2: Add `listLinksAction`
In `src/app/actions.ts` add `listLinksAction(token)` that calls `requireOwner(token)` then
`listLinks(ctx.treeId)`, returning the `ActionResult` shape used by the other actions.
**Verify**: `npx tsc --noEmit` → 0.

### Step 3: Thread `seedPersonId` + `isOwner` to TreeExplorer and focus the seed
In `page.tsx`, after resolving the tree, also resolve the link context (call
`requireTreeContext(token)` — it returns `seedPersonId` and `isOwner`) and pass
`initialSelected={seedPersonId}` and `isOwner={isOwner}` to `<TreeExplorer>`. In
`TreeExplorer.tsx`, initialize `selected` from `initialSelected` (when present and the
person exists), so the anchored person's `DetailCard` shows on load and the existing
fit/focus behavior centers it. Guard: if the seed person isn't in the tree, fall back to
`null` (no crash).
**Verify**: minting an anchored link for a person and opening it focuses that person.

### Step 4: Owner link manager UI
Create `src/components/LinkManager.tsx` (client). Owner-only (rendered only when
`isOwner`). It:
- lists links via `listLinksAction` (kind, label, revoked state, created date) in the
  fieldbook voice;
- mints an anchored link for a chosen person (reuse the focused person, or a small picker)
  via `mintLinkAction({kind:"anchored", seedPersonId, label})`, then shows the URL in a
  `.pl-slip` with a copy action and a WhatsApp share (mirror `CreateTree.tsx`'s reveal);
- revokes a link via `revokeLinkAction` with a confirm, then refreshes the list.
Surface it from a quiet owner-only entry (e.g. a "compartir / enlaces" text action near
the header or on the focused card — NOT terracotta, NOT permanent canvas chrome beyond a
single quiet control, per DESIGN.md). Reuse `.pl-btn`, `.pl-act`, `.pl-slip`, `.pl-toast`.
**Verify**: `npm run build` → 0; manual: mint + revoke as owner works and the list updates.

### Step 5: Gates
**Verify**: `npx tsc --noEmit` → 0; `npm run build` → 0; full unit suite green.

## Done criteria
- [ ] anchored mint with a foreign/nonexistent `seedPersonId` rejects (test passes)
- [ ] opening an anchored link focuses the seeded person's card on load
- [ ] owner sees a link manager that lists, mints anchored links, and revokes; non-owner does not
- [ ] `npx tsc --noEmit` 0; `npm run build` 0; unit suite green
- [ ] DESIGN.md system respected (vine buttons, no terracotta misuse, no heavy canvas chrome)

## STOP conditions
- Resolving link context in `page.tsx` would duplicate/contradict how `getTreeAction`
  authenticates (e.g. double token errors) — STOP and report; the two reads should agree.
- The link manager would require a permanent search/toolbar on the canvas that contradicts
  DESIGN.md's "no chrome" rule — STOP and propose the placement instead of forcing it.

## Maintenance notes
- A person picker for "mint anchored link for whom?" overlaps plan 011's search; if 011
  lands first, reuse its picker. Note the coupling in the PR.
- Attribution (plan 012) also reads link rows; keep `listLinks`'s shape stable.
</content>
