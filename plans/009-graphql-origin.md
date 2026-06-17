# Plan 009: Stop trusting the Host header for the GraphQL self-fetch origin

> **Executor**: Follow step by step, verify each step. STOP and report on any STOP condition.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- src/app/t/[treeId]/page.tsx src/lib/graphqlClient.ts`.

## Status
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
The optional GraphQL read path (`?gql=1`) makes a SERVER-SIDE fetch to the app's own
`/api/graphql`, building the origin from the inbound `Host` header and sending the
capability token in the `Authorization` header. A poisoned `Host` header would redirect
that token-bearing request to an attacker-controlled origin. It's the disposable learning
path (default reads go through `getTreeAction`), and Vercel normalizes Host, but trusting
an attacker-controllable header to build a URL we send a credential to is the wrong
pattern. Pin the origin to a trusted source.

## Current state
`src/app/t/[treeId]/page.tsx` (the `gql` branch, ~lines 20-33):
```ts
const h = await headers();
const host = h.get("host") ?? "localhost:3000";
const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
data = await fetchTreeViaGraphQL(token, `${proto}://${host}`);
```
`src/lib/graphqlClient.ts:25` then does `fetch(`${origin}/api/graphql`, { headers: { authorization: \`Bearer ${token}\` }, ... })`.

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Build | `npm run build` | exit 0 |
| Default path still works | load `/t/<id>?k=<token>` (no `gql`) in a running dev server | tree renders |
| GraphQL path still works | load `/t/<id>?k=<token>&gql=1` | tree renders identically |

## Scope
**In scope**: `src/app/t/[treeId]/page.tsx` (the origin construction in the `gql` branch).
Optionally `.env.example` (document the new optional var).
**Out of scope**: `src/lib/graphqlClient.ts` signature (keep `fetchTreeViaGraphQL(token, origin)`),
the default `getTreeAction` path, the GraphQL server.

## Git workflow
- Commit message: `fix(security): pin GraphQL self-fetch origin, don't trust Host header`
- Body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Build the origin from a trusted source, not the Host header
Replace the Host-derived origin with a pinned one. Order of preference:
1. `process.env.APP_ORIGIN` (explicit, e.g. `https://plurali.example`) if set.
2. `process.env.VERCEL_PROJECT_PRODUCTION_URL` / `process.env.VERCEL_URL` (Vercel-injected,
   trusted) → prefix with `https://`.
3. `http://localhost:3000` dev fallback.

Example:
```ts
const origin =
  process.env.APP_ORIGIN ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
data = await fetchTreeViaGraphQL(token, origin);
```
Remove the `headers()`/`host`/`proto` lines used only for this. (If `headers()` is used
elsewhere in the file, keep that usage.)

**Verify**: `npx tsc --noEmit` → 0; `npm run build` → 0.

### Step 2: Confirm both read paths still render
With a dev server and a valid tree link: open `/t/<id>?k=<token>` (default) and
`/t/<id>?k=<token>&gql=1` (GraphQL). Both must render the same tree. In local dev the
fallback origin `http://localhost:3000` is used, so the `gql` path resolves to the local
server.

**Verify**: both pages render the mesh with the same people.

### Step 3 (optional): document the env var
If you used `APP_ORIGIN`, add a commented line to `.env.example`:
`# APP_ORIGIN=https://your-domain  # optional; origin for the server-side GraphQL self-fetch (?gql=1)`

## Done criteria
- [ ] `page.tsx` no longer derives the fetch origin from `h.get("host")`
- [ ] `npx tsc --noEmit` exits 0; `npm run build` exits 0
- [ ] both `?gql=1` and default reads render the tree in local dev
- [ ] only `page.tsx` (and optionally `.env.example`) modified

## STOP conditions
- The `gql=1` path can't resolve the origin in local dev (fetch fails) — report; do not
  fall back to reading the Host header.

## Maintenance notes
- A stronger end state (per TODOS.md #5) is to retire the HTTP self-fetch entirely and
  have the server component call the read layer directly; this plan only removes the
  header-trust smell on the existing disposable path.
</content>
