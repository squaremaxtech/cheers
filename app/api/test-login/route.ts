import { randomUUID, timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import {
  TEST_PERSONAS,
  TEST_PERSONA_KEYS,
  isTestEmail,
  isTestPersonaKey,
  testModeEnabled,
} from "@/lib/test-mode";

const SESSION_HOURS = 12;

// Looks like any other missing page unless test mode is on and the secret
// matches — the route must not even confirm that it exists.
function notFound(): NextResponse {
  return new NextResponse("Not found", { status: 404 });
}

// Dev-only sign in for the seeded test accounts — see lib/test-mode.ts for the
// rules. Auth uses database sessions (lib/auth.ts), so "signing in" is just a
// sessions row plus the cookie NextAuth itself would have set.
//
//   ?as=<persona>          one of TEST_PERSONAS (customer, premium-worker, …)
//   ?secret=<TEST_MODE_SECRET>
//   ?to=/worker/bookings   land on a specific page (same-site paths only)
//
// Only the personas can be signed into. The professionals seeded to populate
// Browse are there to be looked at, not driven.
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!testModeEnabled()) return notFound();

  const query = request.nextUrl.searchParams;
  const given = Buffer.from(query.get("secret") ?? "");
  const expected = Buffer.from(process.env.TEST_MODE_SECRET ?? "");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return notFound();
  }

  const as = query.get("as") ?? "";
  if (!isTestPersonaKey(as)) {
    return NextResponse.json(
      { error: `as must be one of: ${TEST_PERSONA_KEYS.join(", ")}` },
      { status: 400 }
    );
  }
  const persona = TEST_PERSONAS[as];

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, persona.email));
  if (!user) {
    return NextResponse.json(
      { error: "Test accounts are not seeded — run: npm run test:seed" },
      { status: 404 }
    );
  }

  // Belt and braces: never hand out a session for anything but a test account,
  // and never in a role other than the one that was asked for.
  if (
    !isTestEmail(user.email) ||
    user.role !== persona.role ||
    user.supportRole !== persona.supportRole ||
    user.suspended
  ) {
    return NextResponse.json(
      { error: "Test account is out of shape — run: npm run test:seed" },
      { status: 409 }
    );
  }

  const sessionToken = randomUUID();
  const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
  await db.insert(sessions).values({ sessionToken, userId: user.id, expires });

  const to = query.get("to") ?? "";
  const destination =
    to.startsWith("/") && !to.startsWith("//") ? to : persona.home;

  // The same cookie name NextAuth v4 reads: prefixed and Secure only when the
  // site itself is served over https (core/lib/cookie.js defaultCookies).
  const secure = (process.env.NEXTAUTH_URL ?? "").startsWith("https://");
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.cookies.set(
    `${secure ? "__Secure-" : ""}next-auth.session-token`,
    sessionToken,
    { httpOnly: true, sameSite: "lax", path: "/", secure, expires }
  );
  return response;
}
