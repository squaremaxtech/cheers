import type { Role, SupportRole } from "@/types";

// TEST MODE — sign in as a seeded test account without Google or a magic link,
// so a whole flow (book → accept → pay → start → complete → review) can be
// walked end to end in the real app.
//
// It only ever works when ALL of these hold:
//   1. this is not a production build (`next start` / pm2 always run as
//      production, so the deployed site can never use it);
//   2. TEST_MODE_SECRET is set (16+ characters) and the request carries the
//      same value;
//   3. the account is one of the seeded test accounts — every one of them
//      lives on TEST_EMAIL_DOMAIN, and a real user can never be signed in
//      this way.
//
// set up:   npm run test:seed     (creates / refreshes the accounts)
// sign in:  /api/test-login?as=<persona>&secret=<TEST_MODE_SECRET>&to=/path
// remove:   npm run test:clean    (deletes them and everything they created)
//
// `.test` is a reserved top-level domain (RFC 2606): it can never be
// registered, so nobody can receive a magic link or hold a Google account at
// one of these addresses. That is what makes it safe for the accounts to sit
// in the same database as real users.
export const TEST_EMAIL_DOMAIN = "@cheersja.test";

export type TestPersona = {
  email: string;
  role: Role;
  supportRole: SupportRole | null;
  // Where the sign-in lands when no ?to= is given.
  home: string;
  // One line for the docs and for `npm run test:status`.
  summary: string;
};

function persona(
  local: string,
  role: Role,
  home: string,
  summary: string,
  supportRole: SupportRole | null = null
): TestPersona {
  return { email: `${local}${TEST_EMAIL_DOMAIN}`, role, supportRole, home, summary };
}

// One sign-in per hat. The keys are what `?as=` accepts, and these are the
// only accounts that can be signed into. The professionals seeded purely to
// populate Browse (db/test-professionals.ts) are test accounts too — same
// domain, same clean-up — but they are there to be looked at, not driven.
export const TEST_PERSONAS = {
  customer: persona(
    "test.customer",
    "customer",
    "/dashboard",
    "Standard customer — onboarded, no premium access"
  ),
  "premium-customer": persona(
    "test.premium.customer",
    "customer",
    "/dashboard",
    "Customer with admin-granted premium access and a Verified ID badge"
  ),
  worker: persona(
    "test.worker",
    "worker",
    "/worker",
    "Standard professional (Island Lens Studio) — no premium provider status"
  ),
  "premium-worker": persona(
    "test.premium.worker",
    "worker",
    "/worker",
    "Premium provider (Blue Mahoe Events) — publishes a premium service"
  ),
  driver: persona(
    "test.driver",
    "driver",
    "/driver",
    "Marketplace driver — approved, with a vehicle"
  ),
  admin: persona("test.admin", "admin", "/admin", "Admin — everything"),
  support: persona(
    "test.support",
    "support",
    "/admin",
    "Desk support (customer_support)",
    "customer_support"
  ),
  supervisor: persona(
    "test.supervisor",
    "support",
    "/admin",
    "Support supervisor — may also review ID verifications",
    "supervisor"
  ),
  monitor: persona(
    "test.monitor",
    "support",
    "/safety",
    "Safety monitor — the live safety board and nothing else",
    "safety_monitor"
  ),
} as const satisfies Record<string, TestPersona>;

export type TestPersonaKey = keyof typeof TEST_PERSONAS;

export const TEST_PERSONA_KEYS = Object.keys(TEST_PERSONAS) as TestPersonaKey[];

export function isTestPersonaKey(value: string): value is TestPersonaKey {
  return value in TEST_PERSONAS;
}

export function isTestEmail(email: string | null | undefined): boolean {
  return (
    typeof email === "string" &&
    email.toLowerCase().endsWith(TEST_EMAIL_DOMAIN)
  );
}

export function testModeEnabled(): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (process.env.TEST_MODE_SECRET ?? "").length >= 16
  );
}

// Test activity must never reach a real person's inbox or notification feed:
// when whoever caused a notification is a test account, only test accounts
// hear about it. Real activity is delivered to everyone as usual (a test
// address is then skipped at the mailer, because it cannot receive mail).
export function recipientsForActor<T extends { email: string }>(
  recipients: T[],
  actorIsTest: boolean
): T[] {
  return actorIsTest ? recipients.filter((r) => isTestEmail(r.email)) : recipients;
}
