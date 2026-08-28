# Agent MIG — migration v4, seeds, env (2026-08-27)

Scope: REFACTOR-PLAN.md §4 (migration), §3 (categories), §6 seeds bullet,
§1.1/§2.4/§2.5 data, plus the env reference. **Nothing was run against the
database and nothing was committed.**

Exit criteria met: `npx tsc --noEmit | grep "^db/"` prints nothing, `npx eslint
db` is clean. (The rest of the tree still fails tsc — other agents' files.)

## 1. Files changed

| File | What |
|---|---|
| `db/migrate-v4.ts` | **New.** The v3 migration (steps below). |
| `package.json` | One line: `"db:migrate-v4": "tsx db/migrate-v4.ts"`. |
| `db/seed.ts` | Category seed replaced with the 15 categories of §3, now an **upsert by slug** (insert / refresh copy / reactivate) instead of insert-if-missing. Admin seeding untouched. |
| `db/seed-accounts.ts` | New schema + §6 demo data (below). |
| `env.example` | `MEMBERSHIP_PRICE_CENTS` added, `BOOKING_REQUIRES_SUBSCRIPTION` removed, `FREE_ACCESS_UNTIL` comment rewritten, "Chat Pass" wording gone, header now says v3. |

Nothing else was touched. `db/schema.ts`, `lib/`, `actions/`, `app/`,
`components/`, `types.ts` are other agents' files.

## 2. `db/migrate-v4.ts` — what it does

One transaction, `IF NOT EXISTS` / `IF EXISTS` / `to_regclass` guards
throughout, one summary log line per step, and a final
`migrate-v4 complete — run \`npm run db:push\` to confirm no drift`.
It does **not** depend on whether `migrate-v3` deleted or merely deactivated
the retired categories, or on whether it ran at all.

1. **`users`** — adds `premium_access_at timestamp`, `terms_accepted_at
   timestamp`, `terms_version text`, `id_verified_at timestamp` (all nullable,
   matching `db/schema.ts`).
2. **`workers`** — adds `premium_provider_at timestamp`, `headline text`,
   `skills text[] NOT NULL DEFAULT '{}'`, `years_experience smallint`; drops
   `age`, `height_cm`, `body_type`, `verified`. Before dropping `verified` it
   counts the rows with `verified = false` and logs how many workers become
   publicly visible, with the reminder that they can be suspended from
   `/admin/workers` if any should not be.
3. **`gigs.premium` / `job_requests.premium`** — `boolean NOT NULL DEFAULT
   false`. `job_requests` is guarded with `to_regclass`: if migrate-v3 has not
   run, the step is skipped with a message telling the owner to run it and
   re-run this migration (the rest of the migration still applies).
4. **`customer_verifications` → `identity_verifications`** —
   - rename guarded with `to_regclass` on both names; if *both* tables exist
     the migration touches neither and prints a `!` line telling the owner to
     merge by hand (identity documents are deleted after review, so an
     unattended merge is unrecoverable);
   - every constraint and index on the table whose name still starts with
     `customer_verifications_` is renamed to the same suffix under
     `identity_verifications_`, skipping any name already taken. That covers
     `customer_verifications_pkey`, the two drizzle FKs
     (`..._user_id_users_id_fk`, `..._reviewed_by_user_id_users_id_fk`), the
     unique index `..._user_idx` and `..._status_idx` — i.e. exactly the names
     `db/schema.ts` expects, so `db:push` reports no drift. Constraints are
     renamed first (`ALTER TABLE … RENAME CONSTRAINT`), then the remaining
     plain indexes (`ALTER INDEX … RENAME TO`);
   - **backfill**: `users.id_verified_at = COALESCE(v.reviewed_at,
     v.updated_at, v.created_at)` for every `status = 'approved'` row where the
     user's badge is still null. `reviewed_at` is nullable, hence the fallback
     to the row's own timestamps.
5. **Categories (§3)** — `cleaning-errands` first:
   - if it exists and `cleaning` does not → its **slug is renamed** to
     `cleaning` (keeps the id, so gigs and job requests keep pointing at it);
   - if **both** exist → the `cleaning` row survives; the gigs and job requests
     tagged to `cleaning-errands` are re-pointed at it and the duplicate row is
     deleted. `gigs.category_id` and `job_requests.category_id` are the only
     FKs into `gig_categories` (both RESTRICT), so the delete is safe once they
     have moved. Logged with the row counts.
   Then all 15 rows are upserted by slug: `INSERT … ON CONFLICT (slug) DO
   UPDATE SET name, blurb, sort_order = <index in the §3 list>, active = true`.
   Missing rows are inserted, present rows get the v3 copy and are reactivated
   (this is what undoes migrate-v3's retirement of `food-catering`), and any
   category the admin added is left alone. Summary line reports
   created / updated / reactivated.

### Judgement calls
- **Index/constraint renaming is discovery-based**, not a hard-coded list: the
  migration reads `pg_constraint` / `pg_class` for names with the old prefix
  and rewrites the prefix. That survives any table created by an older
  `db:push` whose auto-generated names differ from what I'd have guessed. Names
  coming back out of the catalog are checked against `/^[a-z0-9_]+$/` before
  they go into DDL (query parameters cannot carry identifiers).
- **Both-tables-exist is a no-op with a warning**, not an automatic merge — see
  above. This only happens if someone ran `db:push` before `db:migrate-v4`.
- **`cleaning-errands` merge repoints rather than deactivates.** The plan
  allowed either; repointing keeps the gigs live and browsable under the
  category customers will actually see, and leaves no confusing inactive
  duplicate in `/admin/gigs`.
- **Category `sort_order` is set to the §3 list position (0–14).** Admin-added
  categories keep whatever sort order they have, so they can interleave.
- `ADD COLUMN IF NOT EXISTS` is already idempotent; the extra
  `information_schema` pre-check exists only so the run can log what it
  actually changed.

## 3. Seeded demo data (`db/seed-accounts.ts`)

Every seeded account now gets `terms_accepted_at` + `terms_version` =
`TERMS_VERSION` (imported from `lib/constants.ts`). Stamped columns are only
ever **filled in**, never moved: a re-run does not rewrite an acceptance date
or a premium grant already recorded, and it re-stamps terms only when
`TERMS_VERSION` has changed.

| Account | Role | v3 additions |
|---|---|---|
| `squaremaxtech@gmail.com` — Max Admin | admin | terms |
| `uncommonfavour32@gmail.com` — Favour Customer | customer | **`premium_access_at` set** (sees premium gigs), approved ID verification + `id_verified_at` |
| `maxwellwedderburn32@gmail.com` — Maxwell Worker | worker | approved ID verification + `id_verified_at`; profile below |
| `managestorymaker@gmail.com` — Tanya Cust Support | support / customer_support | terms |
| `maxwellwedderburn@outlook.com` — Devon Driver | driver | terms. **Driver profile unchanged, `verified: true` kept** — drivers are untouched by v3. |

**Worker profile** — "Maxx" becomes **"Maxx Events"**, slug `maxx-events`,
headline "Event DJ & MC · Kingston", 8 skills (DJ, MC & hosting, Wedding
receptions, Corporate events, Sound engineering, Event lighting, Dancehall,
Soca), `yearsExperience: 8`, bio rewritten to the professional voice,
`premiumProviderAt` set (so the premium gig is legal to publish),
`baseRateCents` **computed** from the gig list the same way
`lib/gigs.ts syncWorkerBaseRate` does (cheapest live, priced, fixed,
**non-premium** gig → $200).

**Gigs** (upserted by `(workerId, slug)`):

| slug | title | category | mode | price | premium |
|---|---|---|---|---|---|
| `wedding-party-dj-set` | Wedding & Party DJ Set | events-entertainment | fixed | 30 000 | no |
| `mc-host-corporate-events` | MC / Host for corporate events | events-entertainment | fixed | 20 000 | no |
| `sound-system-rental-setup` | Sound system rental & setup | music-performance | quote (from 12 000, unmonitored) | 12 000 | no |
| `premium-event-package` | Premium event package | events-entertainment | fixed | 90 000 | **yes** |

All four category slugs are in the §3 list. Add-ons are seeded per gig
(unchanged mechanism, matched by `(gigId, name)`); weekly availability and the
Devon driver profile are unchanged.

### Judgement calls in the seed
- **The worker profile and gigs are now REFRESHED on a re-run**, not just
  created-if-missing. A database seeded before v3 would otherwise keep the old
  display name, bio and gig copy forever — the schema change alone does not fix
  copy. Add-ons and availability keep the old create-if-missing behaviour.
- **The stage name slug changes `maxx` → `maxx-events`.** `/workers/maxx` stops
  resolving on an already-seeded database. It is a demo account; the alternative
  was a display name and a URL that disagree.
- **The four pre-v3 demo gigs** (`deep-tissue-massage`,
  `private-party-hosting`, `party-dj-set`, `home-electrical-repairs`) are
  **deactivated** on a re-run, never deleted — bookings, quotes and reviews may
  reference them. Without this, an existing demo database would still show the
  old positioning on the marketplace.
- **Approved ID verifications are seeded** for the customer and the worker
  (`identity_verifications` + `users.id_verified_at`), reviewed by the admin
  account, `document_url` left null (documents are deleted at review time).
  This is what makes the optional "Verified ID" badge visible in the demo — it
  gates nothing. If a real submission already exists in another status
  (pending / rejected) the seed leaves it alone and logs it, rather than
  deciding a review on the reviewer's behalf.

## 4. `env.example`

- `MEMBERSHIP_PRICE_CENTS=500` — comment notes it replaces
  `CHAT_PASS_PRICE_CENTS`, which `lib/constants.ts membershipPriceCents()`
  still reads as a legacy fallback. An existing `.env` keeps working untouched.
- `BOOKING_REQUIRES_SUBSCRIPTION` **removed** — the lever is deleted.
- `FREE_ACCESS_UNTIL` comment: "while this date is in the future, Cheers
  Membership — chat AND booking — is free for everyone; the only switch on the
  membership gate."
- Remaining "Chat Pass" mention in the Stripe block → "Cheers Membership";
  header now reads "v3 freelance platform, 2026-08-27".

## 5. Before the owner runs anything

Run order, one database at a time:

```
npm run db:backup
npm run db:migrate-v3      # only if it has not run on this database yet
npm run db:migrate-v4
npm run db:push            # must report NO changes
npm run db:seed
npm run db:seed-accounts
```

Things to know:

1. **Do not run `db:push` before `db:migrate-v4`.** Push would create a fresh
   empty `identity_verifications` alongside the real `customer_verifications`;
   migrate-v4 then refuses to touch either and asks you to merge by hand.
2. **`db:migrate-v3` must have run** (or run it now) — v4 skips the
   `job_requests.premium` column if that table is missing and tells you so. Its
   other steps still apply, and v4 is safe to re-run afterwards.
3. **Workers hidden by `verified = false` go live** the moment v4 runs. The
   migration prints the count. If any of them should not be public, suspend
   them from `/admin/workers` right after.
4. **`workers.age`, `height_cm`, `body_type` and `verified` are dropped** —
   the data is gone. `npm run db:backup` first; that is what it is for.
5. `db:seed` now **updates** existing category rows (name, blurb, sort order,
   `active = true`). Copy edits made by hand to the 15 seeded categories will be
   overwritten; categories added by the admin are untouched.
6. `db:seed-accounts` **refreshes the demo worker profile and its gigs**, moves
   `/workers/maxx` to `/workers/maxx-events`, and deactivates the four pre-v3
   demo gigs. It does not touch bookings, reviews, payments or the driver.
7. The app code must be finished before the migration is worth running: at the
   time of writing, files outside `db/` still read `workers.verified` and the
   old membership/verification helpers, so the tree does not build yet.
