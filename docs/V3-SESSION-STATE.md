# v3 Refocus — Session Handoff (2026-08-27, session interrupted)

> Read this, then `docs/REFACTOR-PLAN.md` (the authoritative architecture), then
> `docs/HANDOFF.md` §1–2 and `AGENTS.md`. This file records where the build
> was when the owner had to stop the session mid-flight.

## What happened this session
1. An Opus agent read all 282 source files and wrote a complete map of the
   current codebase (scratchpad, session-local — may be gone; the same facts
   are summarised in `docs/REFACTOR-PLAN.md` §0 and in HANDOFF.md).
2. The owner made four decisions (recorded in REFACTOR-PLAN.md §0 table):
   keep drivers/rides as-is; keep job requests; ID verification becomes an
   optional badge with NO gates (workers go live instantly); keep the 5% fee
   on everything.
3. `docs/REFACTOR-PLAN.md` was written — premium tier, autonomy, categories,
   migration v4, theme, copy voice, legal, agent boundaries.
4. Two Opus build agents were launched and then **interrupted**:
   - **Agent A — Data & logic** (REFACTOR-PLAN §8 step 1: schema, `db/migrate-v4.ts`,
     seeds, `types.ts`, `lib/premium.ts`, premium gating everywhere in §1.3, autonomy
     gate removals §2, membership rename, terms acceptance, profile fields, admin
     Promote page, GigsEditor premium toggle, browse premium chip, worker
     `/worker/verification`, etc.). It was told to write
     `docs/v3-progress/agent-a.md` before stopping — **if that file exists, trust it;
     if not, the working tree is partially edited and `git status` / `git diff` is
     the only record.**
   - **Agent C1 — Legal drafter** (`docs/LEGAL-POLICY.md`, rewrite `/terms` and
     `/privacy`, create `/guidelines`). Progress file: `docs/v3-progress/agent-c1.md`.
5. Memory files in the Claude memory dir were updated (design language → light
   professional theme; project state → v3).

## Resume procedure for the next session
1. `git status` and `git diff --stat` — nothing is committed (owner commits manually;
   never auto-commit). Read `docs/v3-progress/*.md` if present.
2. `npx tsc --noEmit`. Expect errors if Agent A was mid-edit. Fix forward toward the
   plan, never by reverting the plan's decisions.
3. Finish **Agent A's scope** first (REFACTOR-PLAN §8 step 1). The §1.3 checklist is the
   security boundary of the premium tier — verify each item is enforced server-side.
4. Then run **Agent B — Theme & copy** (REFACTOR-PLAN §5 + §6). Tell it NOT to touch
   `app/(public)/terms`, `privacy`, `guidelines` pages (legal agent owns those) and to
   replace every `btn-gold` with `btn-primary`.
5. Then **Agent C2 — Docs**: HANDOFF.md v3 update block + §1 rewrite; USER-GUIDE.md
   rewrite for v3; DEMO-WALKTHROUGH.md "v3 changes" preface; reconcile
   `docs/LEGAL-POLICY.md` + the three legal pages with what was actually built.
6. Verify: `npx tsc --noEmit`, `npm run build`, `npm run lint`; independent review pass.
7. Owner: `npm run db:backup` → `npm run db:migrate-v3` (never run on prod yet) →
   `npm run db:migrate-v4` → `npm run db:push` → `npm run db:seed` → `db:seed-accounts`.

## Key facts a fresh session must not lose
- Modified Next.js 16.2.10: `await params`, `proxy.ts` not middleware (none exists),
  `unstable_retry` in error.tsx, SSE not WebSockets. Read `node_modules/next/dist/docs/`.
- House style: no `any`, no type assertions, shared types in root `types.ts`, Zod
  `.safeParse`, `ActionResult`, logic in `lib/`, side effects never throw, every admin
  mutation audited, `realName`/worker `userId` never on public paths.
- `pm2 instances: 1` is load-bearing (in-process SSE bus, presence, rate limits, scheduler).
- Theme tokens are semantic (`base/surface/raised/hairline/ink/muted/faint/gold`) — the
  light theme is done by changing values in `app/globals.css`, not by touching 100 files.
- Copy words banned in v3: seductive, discreet, private parties, night/nightlife, VIP
  table, club appearance, talent, 18+ only, companion, escort, indulge, relaxation massage.
