# Plan 013: Mobile contribution view — DESIGN / SPIKE (not a build-everything plan)

> **Executor**: This is a SPIKE. The deliverable is a written design proposal + a minimal
> non-shipping prototype skeleton + open questions — NOT a finished, shipped mobile UX.
> Do NOT replace or restyle the desktop explorer. Read `DESIGN.md` in full first.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- src/components/ src/app/`.

## Status
- **Priority**: P2
- **Effort**: L (spike is S–M; the build it scopes is L)
- **Risk**: HIGH if mis-scoped as a full build — keep it a spike
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
The hard-requirement audience opens the tree on phones via WhatsApp, including
non-tech-fluent older relatives. `DESIGN.md` specifies a dedicated single-column mobile
contribution flow, but only the desktop React Flow mesh exists; on touch, contribution
works only via fragile sticky-hover taps (confirmed in QA). This is the product's biggest
gap. But it is design-led work the repo deliberately defers — building a whole mobile UX
blind risks landing something off-brand. So this plan SPECIFIES the work and prototypes the
interaction model for a `/design-review` pass; it does not ship the feature.

## Current state
- `src/components/TreeExplorer.tsx` is the only view: a React Flow canvas with hover-revealed
  directional add affordances (`PersonNode.tsx` `.pn-add`, opacity 0 until `:hover`). On
  touch, taps trigger sticky-hover to reveal them — works but fragile/cramped (QA finding).
- `src/components/AddRelative.tsx` already contains a single-column, guided add form
  (self/partner/child/parent, union step, validation, ≥44px targets) — this is reusable as
  the mobile contribution surface.
- `DESIGN.md` "Secondary surface = mobile contribution view (designed, lighter)" spells out
  the intended flow: warm anchored-link header, fieldbook add-person form (name = the only
  required field), `vive` toggle, relationship-to-anchor chips, sticky "guardar", a running
  "agregaste" list, and "the mesh on mobile is a lightweight read-only view."
- No viewport/touch detection exists today (`grep -n "matchMedia\|max-width\|innerWidth" src/`
  → only `page.module.css` media queries on the create-tree page).

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Typecheck (if any skeleton code added) | `npx tsc --noEmit` | exit 0 |
| Build | `npm run build` | exit 0 (skeleton must not break the build) |

## Scope
**In scope**:
- `plans/013-mobile-contribution-DESIGN.md` (or a `docs/` design note) — the written proposal.
- OPTIONAL, behind a clearly non-default path (e.g. a `?mobile=1` flag or a Storybook-less
  isolated route like `/m-preview`) — a minimal skeleton wiring `AddRelative` into a
  single-column layout, so reviewers can feel it. It must NOT change the default `/t/[treeId]`
  experience.
**Out of scope**: shipping the mobile view as the default for phones; touch-detection that
reroutes real users; restyling or replacing the desktop explorer; deleting hover affordances.

## Git workflow
- Commit: `docs(design): mobile contribution view spike + prototype skeleton`
- Body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Write the design proposal
Produce a written proposal covering:
1. **Detection & routing**: how a phone gets the mobile flow (server-side UA hint vs.
   client `matchMedia` vs. an explicit toggle) and what desktop keeps. Recommend one,
   with tradeoffs.
2. **Read vs. contribute**: per DESIGN.md, mobile mesh = lightweight read-only; contribution
   = the single-column form. Define how a recipient moves between "see the tree" and "add my
   family", and how anchored landing (plan 010) presents on mobile ("sos vos, {nombre}?").
3. **The add flow on touch**: reuse `AddRelative`'s guided form; specify relationship-to-anchor
   chips, the single required `name`, partial date, `vive`, sticky "guardar", the post-save
   "agregaste" list with "agregá otro", and fresh (terracotta + "recién") feedback.
4. **What NOT to do on mobile**: the desktop hover/directional model (no hover on touch).
5. **Open questions for `/design-review`**: e.g. does the mobile mesh need pan/zoom at all,
   or just a vertical list? How does search (plan 011) appear on mobile? One contributor
   session = one "tu nombre" label (ties to attribution, plan 012)?

### Step 2 (optional): minimal isolated skeleton
If — and only if — it clarifies the proposal, add a NON-default preview that renders
`AddRelative` (self mode) in a single-column mobile layout, reachable only via an explicit
non-default path. It must not touch the default explorer or auth. Keep it clearly labeled
as a prototype.
**Verify**: `npm run build` → 0; the default `/t/[treeId]?k=…` experience is unchanged.

### Step 3: Recommend the design pass
End the proposal by recommending the user run `/design-review` (or a design-shotgun) on the
mobile flow before a full build, and list the concrete decisions that pass must settle.

## Done criteria
- [ ] a written mobile-contribution design proposal exists (covering the 5 points in Step 1)
- [ ] if a skeleton was added, it is behind a non-default path and the default explorer is unchanged
- [ ] `npm run build` exits 0
- [ ] the proposal ends with explicit open questions for `/design-review`

## STOP conditions
- You find yourself building a production mobile UX (touch-detection that reroutes real
  users, restyling the explorer, deleting hover code) — STOP: that's beyond this spike and
  must go through design review first.

## Maintenance notes
- This plan deliberately stops at a proposal + optional skeleton. The full build is a
  separate, design-reviewed effort. Reuse `AddRelative` rather than inventing a new form.
</content>
