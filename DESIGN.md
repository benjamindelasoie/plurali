# Design System — plurali

> "The living fieldbook." A family-tree archive that feels written in many hands,
> with the ink still drying — not a database you search, not a diagram you draw.

## Product Context
- **What this is:** a collaborative family-tree archive. A family starts a tree and
  sends shareable links to relatives (one open "join" link for the WhatsApp group;
  anchored per-person links); each branch fills in its own people, no signup.
- **Who it's for:** families documenting their lineage together — driven by one
  organizer, contributed to by many cousins.
- **Space/industry:** genealogy / heritage. Peers (Ancestry, MyHeritage, FamilySearch)
  feel like enterprise database funnels optimized for *scale*. plurali optimizes for the
  opposite: **intimacy and aliveness at family scale.**
- **Project type:** web app. Desktop-first exploration; mobile contribution.
- **The one feeling:** *a living thing* — warm, alive, collaboratively grown, many
  hands, freshness over formality. Every decision below serves this.

## Aesthetic Direction
- **Direction:** Living fieldbook — warm botanical fieldbook on cream paper, ink-on-paper,
  hand-made, intimate. All-serif. Rejects the enterprise/database visual language wholesale.
- **Decoration level:** intentional — paper warmth, hand-weight strokes, generous air. No
  ornament for its own sake.
- **Mood:** like someone left the family book open to your page and the ink is still drying.
- **Anti-slop guardrails:** no sans-serif, no boxes/cards-with-borders as default chrome,
  no avatars/photo-circles (V0), no purple gradients, no centered-everything, no gradient
  buttons, no bubble-radius, no toolbar/search chrome on the canvas.

## Typography
All serif, zero sans — the category is aggressively gridded sans; going all-serif signals
"a document people wrote," not "data we store." Both fonts are free (Google Fonts).
- **Display / names:** **Fraunces** (variable; warm, high-contrast, soft optical axis) —
  the painted-on-the-winery-wall feel. Used for person names and headings.
- **Body + metadata:** **Literata** (built for long-form screen reading). Its **italic**
  carries all metadata — dates, birthplaces, and authorship marginalia
  (*"de la mano de Tía Marta · martes"*) — like a note in the margin.
- **No monospace, no sans.** Risk acknowledged: small-label legibility needs care; Literata
  is built for it. Keep UI labels ≥ 12.5px.
- **Loading:** Google Fonts —
  `Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..600` and
  `Literata:ital,opsz,wght@0,7..72,400..600;1,7..72,400..500`.
- **Scale (suggested):** display 30–40px, name 16–18px, body 16px, meta/caption 12.5–13.5px.

## Color — "cellar light & cream paper"
Warm and alive, deliberately NOT sepia (which reads dead). Discipline: green is the
structural/alive color; **terracotta is hoarded — used ONLY for freshness.** One hot color
that always means something.
- **Paper (background):** `#F4EEE2`
- **Surface (focused card):** `#FBF8F0`
- **Ink (primary text):** `#22201B` (iron-gall near-black, never pure black)
- **Muted (secondary):** `#6B6453` (faded pencil) — ~4.6:1 on paper, clears WCAG AA, so it
  can safely carry secondary *content* (dates, birthplaces), not just decoration.
  *(Darkened from #8A8273, which was ~3.1:1 and failed AA — plan-design-review fix.)*
- **Vine (structural/alive accent):** `#5C6B3E` — edges, the "agregar a alguien aquí" link
- **Fresh (freshness only):** `#C2451E` — see drying-ink rule below
- **Hairline:** `#e3dccb`
- **Dark mode:** "cellar at night" — deferred to V1; invert to a deep warm near-black ground
  with cream ink, keep vine/terracotta, reduce saturation ~15%.

### The drying-ink rule (the signature device)
Freshly added/edited people render in **terracotta `#C2451E`** and "dry" down to ink
`#22201B` over ~48h, driven by `updated_at`. No counters, no badges — you *see* where the
family has been working, like wet paint. (Cheap: the attribution columns from the eng-review
TODO already provide the timestamp.)

**Color-blind safety (required):** color is never the *only* freshness signal. Fresh
node-cards in the mesh also carry a small italic text tag (e.g. *"recién · martes"*, in the
marginalia voice) so ~8% of red-green color-blind users perceive freshness from the text,
not the hue. The focused card already has the *"de la mano de …"* line for this. Never rely
on the terracotta hue alone. *(plan-design-review fix.)*

## Spacing
- **Base unit:** 8px. **Density:** spacious — air is the luxury, like margins in a good book.
- **Scale:** 2xs(2) xs(4) sm(8) md(16) lg(24) xl(32) 2xl(48) 3xl(64).

## Layout
- **Primary experience (desktop-first): an explorable force-directed family graph/mesh.**
  People are nodes on the cream canvas; relationships are hand-weight olive edges. Pan/drag
  to explore. The graph uses **light generational gravity** (weak upward pull on older
  generations) and **persisted node positions** (seeded from last layout) so it feels alive
  and springy without re-scrambling every visit or losing the ancestors-up reading. Pure
  physics (no gravity) is a fallback if the bias ever fights the feel.
- **Nodes:** small **paper index-cards** (surface `#FBF8F0` + hairline + soft lift), name in
  Fraunces, birth place/year in Literata italic. This is the one intentional exception to the
  "no boxes" rule — on a graph, bounded cards make edges legible (you can see what connects to
  what). Keep them light and paper-like, never heavy SaaS cards. Fresh nodes get a
  terracotta-tinted card; the focused node lifts forward; the rest dim (~0.32).
- **Renderer (production):** **React Flow (`@xyflow/react`)** for the node-cards, edge
  anchoring (edges attach to node handles — no manual coordinate math), pan/zoom, and
  focus/selection; **d3-force** as the layout engine that positions nodes and recomputes when
  a member is added (the organic "living" feel). This resolves the open renderer question from
  eng-review (which had pencilled "simple view / family-chart-or-d3-dag"). The static reference
  at `~/.gstack/projects/plurali/designs/tree-20260525/finalized.html` is the visual target,
  not the implementation — the hand-rolled SVG there is replaced by React Flow.
  - **Structured-layout fallback/toggle = `d3-dag`** (NOT d3-hierarchy). Genealogy is a DAG
    (two parents per child); d3-dag lays out DAGs correctly where d3-hierarchy assumes a strict
    tree and breaks. Offer it as a "tidy" toggle beside the organic d3-force default.
  - **Graph algorithms = `graphology`** — for ancestor/descendant traversals, the cycle guard
    (would replace the hand-rolled BFS in `src/lib/persons.ts`), and the V1 merge.
  - **`elkjs`** — layered-layout option for the V1 accessible hierarchical backbone view.
  - *(Sources vetted from xyflow/awesome-node-based-uis.)*
- **Edges:** olive hand-weight strokes, gently curved. Couple links heavier (~2.4px);
  parent-child thinner (~1.6px); **unknown/missing parent = dotted** = an invitation
  (*"alguien la recuerda — agregá lo que sepas"*).
- **Click-to-focus:** clicking a person fixes/centers them and brings their **detail card**
  to the front (surface `#FBF8F0`, hairline, soft shadow) with name, relationship,
  place/dates, authorship marginalia, relationship chips, and an add-relative prompt; the
  rest of the mesh dims (~0.32 opacity). No modal that leaves the canvas.
- **Primary contribution surface = desktop.** Most contribution happens on desktop, inline on
  the graph: the focused person's detail card is editable (name/dates/place) and carries the
  "agregar familiar" prompts. The graph + focused card IS the contribution UI; no separate
  "edit mode." *(Corrected in plan-design-review — earlier this doc called mobile "the
  contribution surface"; contribution is desktop-primary.)*
- **Secondary surface = mobile contribution view (designed, lighter).** A cousin opening a
  link on a phone gets a focused, single-column flow — not the mesh. Anchored-link landing:
  warm header *"Estás en el árbol de la Familia Müller — ¿sos Lucía? Agregá tu familia."*
  Then a fieldbook-style add-person form: **name** (large Fraunces input, the only required
  field), birthplace, **partial birth date** (year/month/day each optional), a *"vive"* toggle,
  and **relationship-to-anchor** (pareja / hijo-a / madre-padre). One person at a time, ≥44px
  tap targets, single column, sticky *"guardar"*; after saving, the person appears fresh
  (terracotta + "recién" tag) in a running *"agregaste"* list with *"agregá otro."* The mesh on
  mobile is a lightweight read-only view.
- **Accessibility:** muted text now clears AA (see Color). **Graph keyboard/screen-reader
  navigation is deferred to V1** — V0 ships the mesh mouse/touch-only (tracked in TODOS.md as
  a known gap; the planned fix is a semantic linear/nested view as the backbone). Tap targets
  ≥44px. Respect `prefers-reduced-motion` (no graph draw-in / pulses).
- **No chrome:** no persistent toolbar, no search bar on the canvas (open-link "find
  yourself" search is a tracked TODO). The only persistent action is a quiet olive
  "agregar a alguien aquí."
- **Max content width (forms/cards):** ~640px. **Border radius:** card 14px, chips 999px.

## Motion
- **Approach:** intentional, in service of "alive."
- **Graph:** gentle settle/drift physics; new connections **draw in** (stroke reveal);
  on first load the mesh eases into place once.
- **Focus:** clicked node animates to front/center, card eases in, background dims.
- **Drying ink:** slow color transition terracotta → ink over ~48h (data-driven, not an
  animation loop).
- **Easing:** enter(ease-out) exit(ease-in) move(ease-in-out). **Duration:** micro 50–100ms,
  short 150–250ms, medium 250–400ms, settle/long 400–700ms.

## Interaction States (added in plan-design-review)
Every state in the fieldbook voice — no cold `"No se encontró nada."` defaults.

| Surface | Loading | Empty | Error | Saving / partial |
|---|---|---|---|---|
| Open a link | "cargando el árbol…" + faint vine draws in | (n/a) | invalid/revoked/expired → warm page: *"este enlace ya no funciona — pedile uno nuevo a quien te invitó"* | — |
| Tree / mesh | skeleton stems fade in | owner's first run → *"empezá agregándote a vos y a tus padres"* + primary action | load failed → *"no pudimos cargar el árbol"* + Reintentar | — |
| Add / edit a person | — | unknown parent → existing invitation *"alguien la recuerda — agregá lo que sepas"* | save failed → form stays filled, *"no se pudo guardar — reintentá"* (no data lost) | optimistic: node appears immediately, fresh (terracotta + "recién"); reconciles on save |

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-25 | Initial design system created | /design-consultation. Brief: "a living thing." |
| 2026-05-25 | Aesthetic = "living fieldbook," all-serif | Rejects the dated genealogy-database look; serves intimacy/aliveness (EUREKA: category optimizes for scale; plurali for family-scale intimacy). |
| 2026-05-25 | Fraunces + Literata (free) over premium foundry fonts | Outside voice proposed Ogg/Untitled/Alpina (paid); swapped to free equivalents capturing the same warm all-serif spirit for an open-source project. |
| 2026-05-25 | Palette "cellar light & cream paper"; terracotta hoarded for freshness | Warm-not-sepia; one hot color that always means something. |
| 2026-05-25 | Drying-ink freshness (terracotta → ink over ~48h) | Makes "a living thing" literal with zero badges; reuses attribution timestamp. |
| 2026-05-25 | Layout = desktop-first explorable force-directed graph/mesh, click-to-focus card | User direction: "like a mesh, exploring a graph." Force-directed chosen over radial/banded for the most-alive feel. |
| 2026-05-25 | Refinement: light generational gravity + persisted positions | Keeps the force-directed mesh legible (ancestors-up) and stable across visits without losing the springy feel. |
| 2026-05-25 | Mobile = secondary contribution form; exploration desktop-first | User chose desktop-first. NOTE: this reverses the eng-review "mobile-first" requirement and pulls in the interactive graph that eng-review deferred to V1 (the #2 technical risk). Build-sequencing call at implementation: ship the explorable graph in V0 (more build/risk) OR ship a simple view first with the graph as the V1 target. The mobile contribution form must stay usable regardless. |
| 2026-05-25 | Nodes are paper index-cards (not plain text) | User: plain text made the graph hard to read / edges ambiguous. Bounded paper cards make edges land on shapes. One intentional exception to "no boxes," kept light/paper-like. |
| 2026-05-25 | Renderer = React Flow (@xyflow/react) + d3-force | Hand-rolled SVG hit manual edge-anchoring failure. React Flow owns node-cards + edge handles + pan/zoom; d3-force recomputes positions when members are added. Resolves eng-review's open renderer question. |
| 2026-05-25 | Muted token darkened #8A8273 → #6B6453 (a11y) | Old muted was ~3.1:1 on cream, failed WCAG AA for the dates/places it carries. New tone clears 4.5:1, still reads as faded pencil. |
| 2026-05-25 | Non-color freshness cue required | Drying-ink terracotta is invisible to red-green color-blind users; fresh node-cards also carry a "recién · {day}" text tag. Never color-alone. |
| 2026-05-25 | Full interaction-state spec adopted | Loading/empty/error/save-failure specified in fieldbook voice (see Interaction States) so no cold defaults ship. |
| 2026-05-25 | Contribution is desktop-primary; mobile = lighter secondary view | Corrects earlier "mobile = the contribution surface." Desktop graph + editable focused card is the main contribution UI; mobile gets a designed single-column add-person form. |
| 2026-05-25 | Graph keyboard/screen-reader a11y deferred to V1 | User chose to ship the mesh mouse/touch-only in V0; semantic linear/nested backbone is the V1 fix (tracked in TODOS.md). Known accessibility gap. |
| 2026-05-25 | Union-first child model (remarriage / half-siblings) | Prompted by the founder being a child of his father's 2nd marriage. Add a child to a CHOSEN marriage (couple) → both parents linked + which-union explicit; `connectParent` links existing/2nd/unknown parents. Half-siblings derive naturally. Schema unchanged (already a graph); built addChildToCouple + connectParent + tests. UI implication: the add-child form must let you pick WHICH marriage when a parent has more than one. |
