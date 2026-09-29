<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# You can sign in and use the app yourself — do it

Test accounts exist so that a change to a flow is **checked in the real app, signed in, before it is called done**. Do not rely on reading code when a flow can be run.

| `as=` | Account | What it is |
| --- | --- | --- |
| `customer` | `test.customer@cheersja.test` | Standard customer |
| `premium-customer` | `test.premium.customer@cheersja.test` | Customer with premium access + Verified ID |
| `worker` | `test.worker@cheersja.test` | Standard professional — Island Lens Studio |
| `premium-worker` | `test.premium.worker@cheersja.test` | Premium provider — Blue Mahoe Events |
| `driver` | `test.driver@cheersja.test` | Approved driver, with a vehicle |
| `admin` | `test.admin@cheersja.test` | Admin |
| `support` / `supervisor` / `monitor` | `test.<name>@cheersja.test` | The three support sub-roles |

- **Sign in:** `GET /api/test-login?as=<persona>&secret=<TEST_MODE_SECRET>&to=/some/path` on a dev server. Rules and guards are in `lib/test-mode.ts`: dev builds only (a production build answers 404), the secret is required, and only these personas can be signed into. The secret lives in `.env.local`; **`.env` and `.env.*` are off limits to read** (project permission settings) — the scripts pick the secret up themselves.
- **Accounts:** `npm run test:seed` (create / refresh, and rewrite `docs/TEST-ACCOUNTS.md`), `npm run test:status`, `npm run test:clean` (deletes every `@cheersja.test` account and everything it created).
- **Server:** `npm run test:dev` (port 3011, so it does not collide with anything on 3000).
- **See a screen:** `node scripts/test-browser.mjs <persona|public> [path] [--width=390 --height=844 --full]` — signs in with headless Chrome, prints horizontal overflow and console errors, saves a PNG to `.test-shots/` (git-ignored). Read the PNG to look at it.
- **Run a whole flow:** `scripts/test-walkthrough/` has them scripted across two signed-in browsers — `01-sign-in` (every role lands where it should), `02-booking` (chat → book → accept → confirm → PIN start → check-in → payment → complete → get home → review), `03-quotes-and-requests`, `04-cancel`, `05-rides-and-access` (a ride end to end, the premium rail, role boundaries). Import `openBrowser` from `scripts/test-browser.mjs` to write another.

## Ground rules for test runs

- The test accounts live in the **same database as real users**. The separation is in code (`lib/test-isolation.ts`): test and real accounts never see each other's job requests or ride requests, notifications caused by a test account reach test accounts only (`lib/notify.ts`), a test professional's safety alerts page test staff only (`lib/safety/escalate.ts`), and no email is ever sent to a test address (`lib/mailer.ts`). Never sign in as, or act on, a non-test account.
- **Never leave a safety session open.** A monitored booking that is started must be finished: *I've left the visit* → *I got home safely*. `npm run test:status` says if one is still running; `scripts/test-walkthrough/close-sessions.mjs` closes it.
- The demo professionals, their photos (`public/demo/`, sources in `CREDITS.md` there) and their **sample reviews** are dummy data for development and demo footage. They stay on dev: `npm run test:clean` before a database becomes production.
- In Git Bash, prefix commands that pass a path argument with `MSYS_NO_PATHCONV=1` — it rewrites `/bookings/…` into a Windows path otherwise.
- This is Chrome emulating a phone. Real iPhone / Android behaviour (keyboard, safe areas, touch scrolling) is not proven by it — say so.
