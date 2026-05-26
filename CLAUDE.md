# plurali

A collaborative family-tree archive. A family starts a tree and shares links
(one open "join" link + anchored per-person links); each branch fills in its own
people, no signup. Emotional core: a **living archive** — "facts are stewarded,
memory is collective."

Greenfield. Planned stack: Next.js (App Router) + TypeScript on Vercel, Neon
(Postgres) + Drizzle, capability-link auth (no accounts in V0). See the approved
design doc and eng-review in `~/.gstack/projects/plurali/`, and `TODOS.md`.

## Design System
Always read `DESIGN.md` before making any visual or UI decisions.
All font choices, colors, spacing, aesthetic direction, and the explorable-mesh
layout are defined there. Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match `DESIGN.md`.
