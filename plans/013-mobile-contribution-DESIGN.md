# Mobile contribution view — design proposal (spike deliverable for plan 013)

> Status: SPIKE OUTPUT. This is a proposal to take into `/design-review`, NOT an
> approved build. No production mobile UX is shipped from this document. The full
> build is a separate, design-reviewed effort. Written 2026-06-14 against `c06b7ab`.

## The problem (grounded)
The hard-requirement audience opens the tree on phones via WhatsApp, including
non-tech-fluent older relatives. Today the only view is the desktop React Flow mesh
with hover-revealed directional add buttons (`PersonNode.tsx` `.pn-add`, opacity 0 until
`:hover`). On touch, taps trigger sticky-hover to reveal them — it works but is fragile
and cramped (confirmed in QA). `DESIGN.md` already specifies a dedicated single-column
mobile contribution flow; it just isn't built. This is the product's biggest gap.

What we already have to build on (don't reinvent):
- `src/components/AddRelative.tsx` — a complete single-column guided add form
  (self / partner / child / parent, the union step for 2+ marriages, validation, ≥44px
  targets, optimistic "fresh" feedback). This is the mobile contribution surface.
- Anchored-link landing (plan 010) already focuses the recipient's own card on load and
  is the natural mobile entry ("sos vos, {nombre}?").
- The find-yourself search (plan 011) already lets open-link recipients locate themselves.
- Attribution (plan 012) gives every card a "de la mano de …" line.

## Proposal

### 1. Detection & routing
**Recommend: CSS-first, with a server hint as progressive enhancement.**
- Render one page; branch layout on viewport. Use a CSS breakpoint (`max-width: 600px`,
  matching the existing `page.module.css` query) so there's no flash and no UA sniffing
  as the source of truth.
- For the parts that must differ structurally (mesh vs. single-column), gate on a
  client `matchMedia("(max-width: 600px)")` hook read AFTER mount (avoid hydration
  mismatch — render a neutral shell first, then resolve). A server UA hint can set the
  initial guess to cut layout shift, but never as the only signal.
- Desktop is unchanged. No touch-detection that reroutes real desktop users.

### 2. Read vs. contribute on mobile
Per `DESIGN.md`: "the mesh on mobile is a lightweight read-only view." Proposal:
- **Read** = a vertical, generation-ordered list of cards (reuse the node-card styling
  from `PersonNode`, no pan/zoom canvas). Tapping a card opens the same `DetailCard`
  content as a full-width sheet. This doubles as the accessibility backbone (TODOS #3b).
- **Contribute** = the `AddRelative` guided form as a full-screen sheet, reached from
  (a) a card's "+ agregar familiar" action, or (b) a sticky "agregar familiar" button.
- Anchored landing on mobile opens directly on the recipient's card sheet with the warm
  "¿sos vos, {nombre}? sumá tu familia" header.

### 3. The add flow on touch
Reuse `AddRelative` verbatim where possible:
- relationship-to-anchor as chips (pareja / hijo-a / madre-padre) — already built;
- single required `name` (large Fraunces input), partial date, `vive` toggle;
- sticky "guardar" at the bottom of the sheet;
- after save: the new person appears fresh (terracotta + "recién"), and a running
  "agregaste …" list with "agregá otro" (per `DESIGN.md`). This running-list affordance
  is the one piece `AddRelative` doesn't have yet — small addition.
- The desktop hover/directional model is NOT used on mobile.

### 4. What NOT to do on mobile
- No hover affordances (no hover on touch).
- No React Flow pan/zoom canvas as the primary surface.
- No shrinking the desktop mesh to fit — it's a different view, not a responsive squeeze.

### 5. Open questions for `/design-review`
1. Does the mobile **read** view need the graph shape at all, or is a generation-grouped
   list enough for V0? (Leaning: list — simpler, accessible, and the desktop mesh remains
   the "explore" experience.)
2. How does find-yourself search (plan 011) present on mobile — a persistent top field, or
   the same expand-on-tap affordance?
3. Should one contribution session capture a one-time "tu nombre" label so attribution
   (plan 012) becomes rich for open-link contributors? (This is the real lever for "many
   hands" — most contribution is via the label-less open link today.)
4. Sheet vs. full-page route for the add flow (back-button behavior on Android/iOS).
5. Exact breakpoint and whether tablets get mesh or list.

## Recommended next step
Run `/design-review` (or a `/design-shotgun`) on this proposal to settle the open
questions, then write a build plan (`plans/014-mobile-build.md`) scoped from the agreed
interaction model. Reuse `AddRelative`; add only the running "agregaste" list + the
mobile read-list + the routing hook. Estimated build after design sign-off: ~L.

## Why this stayed a spike (not auto-built)
plurali is design-led (the `DESIGN.md` decisions log, the plan-design-review history).
Auto-generating a whole mobile UX without a design pass risks landing something
off-brand that would need rework. The interaction model above is the cheap, high-value
artifact; the pixels come after design review.
</content>
