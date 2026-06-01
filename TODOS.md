# plurali — TODOS

Deferred work captured during /plan-eng-review (2026-05-25). V0 stays small; these
are the next things once the 48-hour one-cousin thesis test passes.

## 1. "Find yourself / claim your spot" onboarding — MOSTLY COVERED by anchored links (V0)
- **What:** A way for a contributor to locate themselves in the tree (search by name) and
  a "this is me / add me under X" affordance.
- **Status:** Largely solved in V0 by **anchored links** — a link generated from a person's
  card deep-links the recipient straight to that card. The remaining slice is onboarding for
  the **open (un-anchored)** WhatsApp link, where the recipient lands at the root with no
  anchor and may not recognize owner-spelled names (Müller/Mueller, maiden vs married).
- **Why:** Open-link recipients still need a "find/claim yourself" search.
- **Context:** eng-review outside voice; reduced in scope after the two-link-flavor decision.
- **Depends on:** the open link + search over persons.

## 2. Attribution + edit history
- **What:** Record who entered/changed each fact, and allow undoing one contributor's
  changes. Full history/undo UI is the large version.
- **Why:** With no accounts and whole-tree edit (V0 Option C), you currently can't tell
  which cousin entered a wrong fact or roll it back. For an archive meant to last,
  that's the one genuinely irreversible omission.
- **Cheap early slice (recommended before real data lands):** add
  `created_by_link_id`, `created_at`, `updated_at` columns to nodes from day one —
  near-free because the token guard already holds the link id. Retrofitting
  attribution *after* data exists is painful/impossible.
- **Pros:** "who wrote this" stays answerable; foundation for undo later.
- **Cons:** Full history/undo UI is real work (V1).
- **Context:** eng-review outside voice. Columns now, UI later.
- **Depends on:** the capability-link table (link id exists).

## 3b. Graph keyboard + screen-reader accessibility (deferred from design review)
- **What:** A semantic linear/nested view of the tree (DOM-ordered, tab + Enter to focus a
  person, ARIA landmarks, generation headings) that serves as the accessibility backbone
  under the force-directed mesh — and doubles as the no-JS + mobile read view.
- **Why:** V0 ships the mesh mouse/touch-only. Keyboard and screen-reader users currently
  cannot navigate the family graph at all — they're excluded from the core experience.
- **Pros:** WCAG-conformant; one semantic backbone also covers mobile + no-JS.
- **Cons:** Real build work; needs ARIA-correct tree semantics.
- **Context:** plan-design-review flagged this; user chose to defer to V1 (V0 = mouse-only).
  Build the backbone first when you pick it up — retrofitting a11y onto a canvas graph is hard.
- **Depends on:** the person/relationship data model (exists).

## 3. Duplicate detection + cross-branch merge (the headline V1 problem)
- **What:** Detect when two contributors entered the same person (match on name +
  approximate dates), surface "these might be the same person," let the owner confirm
  a merge. This is also where per-branch stewardship returns.
- **Why:** Two branches entering the same shared ancestor from two sides creates
  duplicate nodes. It's the core deferred problem — the reason V0 dropped per-branch
  scope and uses whole-tree edit instead.
- **Pros:** Unlocks true multi-cousin collaboration without a messy tree.
- **Cons:** Genuinely hard (fuzzy matching, merge UX, conflicting facts).
- **Context:** eng-review + `docs/ideas/true-federation.md`. Pairs with real accounts
  and stewardship in V1.
- **Depends on:** accounts (V1), the graph data model (already in V0).

## 4. DataLoader exploration on the GraphQL read layer (deferred learning)
- **What:** Replace the GraphQL read layer's "load whole tree into context" resolution with
  per-field resolvers backed by **DataLoader** batch loaders (`parentsByChildId`,
  `childrenByParentId`, `couplesByPersonId`), and add a test asserting the batched query
  count is 1, not N.
- **Why:** The current GraphQL slice (built parallel to `getTreeAction`) resolves everything
  in-memory from one `getTree` call, so there is **no N+1 to fix** — which means the
  DataLoader lesson (watch N+1 collapse) is currently skipped. This TODO captures it as a
  deliberate future exercise. At family scale DataLoader is not needed for performance; the
  value is purely learning.
- **Pros:** Hands-on with the canonical GraphQL N+1/batching pattern, on real data.
- **Cons:** More moving parts than load-all; zero product benefit at family scale.
- **Context:** plan-eng-review 2026-06-01, decision C1→b (load-all now, DataLoader later).
- **Depends on:** the GraphQL read layer existing first.

## 5. Promote GraphQL to the sole read path (retire getTreeAction)
- **What:** Once the parallel GraphQL read layer is proven at parity, flip the explore view
  to read via GraphQL only and remove `getTreeAction` + the server-component `getTree` read
  from the page path. Re-point the post-mutation refresh (currently `router.refresh()` →
  `getTreeAction`) at the GraphQL read.
- **Why:** T1 chose to build GraphQL **parallel** (keep `getTreeAction`) so the learning
  layer stays disposable. The project isn't live, so the eventual full switch is cheap — but
  it should be a deliberate, tracked step (parity check + post-mutation refresh re-point),
  not silent drift.
- **Pros:** One read path; the learning layer becomes the real one.
- **Cons:** Couples a supported screen to GraphQL — only do it after parity + depth/complexity
  limits + observability are solid (see the eng-review fold-ins).
- **Context:** plan-eng-review 2026-06-01, decision T1→a; Codex outside voice flagged that
  retiring `getTreeAction` prematurely couples the post-mutation refresh shape.
- **Depends on:** the parallel GraphQL read layer + its tests being green.
