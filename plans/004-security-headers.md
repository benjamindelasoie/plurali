# Plan 004: Add baseline security response headers

> **Executor**: Follow step by step, verify each step. STOP and report on any STOP condition.
>
> **Drift check (run first)**: `git diff --stat c06b7ab..HEAD -- next.config.ts`. If it
> changed, read it before editing — it may already define `headers()`.

## Status
- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `c06b7ab`, 2026-06-14

## Why this matters
`next.config.ts` is empty, so the app emits no baseline security headers. Cheap
defense-in-depth: `X-Frame-Options` (clickjacking), `X-Content-Type-Options` (MIME
sniffing), and `Referrer-Policy`. The Referrer-Policy one is the most relevant here:
the capability token rides in the URL (`?k=…`), so a permissive referrer could leak
that token to any third party the page navigates to. (Fonts are self-hosted via
`next/font/google`, so there is no Google-Fonts referer vector — but outbound links and
future external resources are covered by setting the policy now.)

## Current state
`next.config.ts` in full:
```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
```
No `headers` key. The app serves all routes under `/`.

## Commands you will need
| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | exit 0 |
| Build | `npm run build` | exit 0 |
| Verify headers (dev) | `curl -sI http://localhost:3000/ \| grep -i "x-frame-options\|referrer-policy\|x-content-type"` | three header lines present |

## Scope
**In scope**: `next.config.ts`
**Out of scope**: every other file. Do NOT add a `Content-Security-Policy` in this plan
— a correct CSP for a React Flow + inline-style app needs its own testing pass; adding a
loose CSP is worse than none. Note it as deferred in Maintenance.

## Git workflow
- Commit message: `chore(security): baseline response headers (frame, nosniff, referrer)`
- Body ends with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

## Steps
### Step 1: Add an async `headers()` to the config
Edit `next.config.ts` so `nextConfig` includes:
```ts
async headers() {
  return [
    {
      source: "/:path*",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ];
},
```
Keep the existing `NextConfig` typing.

**Verify**: `npx tsc --noEmit` → exit 0; `npm run build` → exit 0.

### Step 2: Confirm headers are emitted
If a dev server is available on :3000, run the curl check. If not, the build passing is
sufficient for this plan (the config is statically valid).

**Verify**: curl shows the three headers (when a server is running).

## Done criteria
- [ ] `npx tsc --noEmit` exits 0
- [ ] `npm run build` exits 0
- [ ] `grep -c "X-Frame-Options\|Referrer-Policy\|X-Content-Type-Options" next.config.ts` == 3
- [ ] Only `next.config.ts` is modified

## STOP conditions
- The build fails after adding `headers()` — report the error; do not work around it by
  touching other files.

## Maintenance notes
- A real `Content-Security-Policy` is deferred (needs a dedicated test pass against the
  React Flow canvas and inline styles). Track it separately.
- `Strict-Transport-Security` is best set at the platform (Vercel) level; not added here.
</content>
