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
