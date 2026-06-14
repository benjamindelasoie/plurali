# Plan 002: Remove the unused `d3-force` dependency

> **Executor**: Follow step by step, verify each step. STOP and report on any STOP condition.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- package.json package-lock.json`
> and `grep -rn "d3-force" src/`. If `src/` now imports `d3-force`, STOP — the dep is in
> use and must not be removed.

## Status
- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (if run alongside 001, sequence: both edit package.json)
- **Category**: deps
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
`d3-force` is listed in `package.json` dependencies but never imported anywhere in
`src/`. The layout engine pivoted to dagre (see the decision in `DESIGN.md` and the
comment in `src/lib/flow.ts:14` referencing "the old d3-force problem"). Carrying an
unused dependency muddies the dependency surface — a future contributor may assume
it's live. Removing it is purely subtractive.

## Current state
- `package.json` dependencies include: `"d3-force": "^3.0.0",`
- `grep -rn "d3-force" src/` returns ONE hit: a comment in `src/lib/flow.ts:14`
  ("the old d3-force problem"). No `import` of `d3-force` exists.
- The active layout engine is `@dagrejs/dagre` (used in `src/lib/flow.ts`).

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Confirm no import | `grep -rn "from \"d3-force\"\|require('d3-force')" src/` | no matches |
| Install (refresh lockfile) | `npm install` | exit 0 |
| Build | `npm run build` | exit 0, compiles |

## Scope
**In scope**: `package.json`, `package-lock.json` (updated by `npm install`)
**Out of scope**: `src/lib/flow.ts` (the comment may stay; do not edit code). Do not
remove `@dagrejs/dagre` or `@xyflow/react`.

## Git workflow
- Commit message: `chore: drop unused d3-force dependency`
- Body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Remove the dependency line
Delete `"d3-force": "^3.0.0",` from the `dependencies` object in `package.json`.

**Verify**: `grep '"d3-force"' package.json` → no matches.

### Step 2: Refresh the lockfile
Run `npm install`.

**Verify**: `npm install` exits 0; `git diff --stat package-lock.json` shows it changed.

### Step 3: Confirm the app still builds
Run `npm run build`.

**Verify**: exit 0, build completes (dagre is the layout engine; d3-force was dead).

## Done criteria
- [ ] `grep "d3-force" package.json` returns nothing
- [ ] `grep -rn "import .*d3-force" src/` returns nothing (only the comment remains)
- [ ] `npm run build` exits 0
- [ ] Only `package.json` and `package-lock.json` are modified

## STOP conditions
- `grep -rn "d3-force" src/` shows an actual import (not just the comment) — the dep is
  in use; do not remove it; report.
- `npm run build` fails after removal — report the error.

## Maintenance notes
- d3-force / d3-dag remain candidates for an optional "organic" layout toggle later
  (per `DESIGN.md`); re-add deliberately if that work starts.
</content>
