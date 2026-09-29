import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { getUserRow } from "@/lib/auth";
import { emailLayout, sendEmail } from "@/lib/mailer";
import {
  isTestEmail,
  recipientsForActor,
  testModeEnabled,
} from "@/lib/test-mode";

// Was this notification caused by a test account (lib/test-mode.ts)? If so it
// may only reach other test accounts — a scripted run must never land in a
// real person's feed or inbox.
//
// A caller that knows the subject says so (`testActivity` — the safety ladder
// does, it runs off a clock with nobody signed in). Otherwise the signed-in
// user is asked, and only where a test session can exist at all: a dev build
// with test mode on. Production never pays for the lookup.
async function causedByTestAccount(explicit?: boolean): Promise<boolean> {
  if (explicit !== undefined) return explicit;
  if (!testModeEnabled()) return false;
  try {
    const actor = await getUserRow();
    return actor !== null && isTestEmail(actor.email);
  } catch {
    // Outside a request there is no session to read.
    return false;
  }
}

// Emails deep-link to the thing they are about: an explicit in-app path in
// meta.url (job requests, boards), else the live booking room for
// booking-related mail.
function emailBody(opts: { body: string; meta?: Record<string, string> }): string {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  if (!base) return `<p>${opts.body}</p>`;
  let url: string | null = null;
  let label = "View";
  if (opts.meta?.url && opts.meta.url.startsWith("/")) {
    url = `${base}${opts.meta.url}`;
  } else if (opts.meta?.bookingId) {
    url = `${base}/bookings/${opts.meta.bookingId}`;
    label = "View booking";
  }
  if (!url) return `<p>${opts.body}</p>`;
  return `<p>${opts.body}</p>
    <p style="margin-top:24px;">
      <a href="${url}" style="background:#d6b25e;color:#0c0a09;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:bold;">${label}</a>
    </p>`;
}

// Central notification dispatcher: writes an in-app notification row and
// mirrors it as an email. Never throws — a failed notification must not
// break the mutation that triggered it. Pass email: false to record the
// in-app row only (e.g. chat messages to a recipient who is online).
export async function notify(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  meta?: Record<string, string>;
  email?: boolean;
  // Set by callers with no signed-in user to ask (see causedByTestAccount).
  testActivity?: boolean;
}): Promise<void> {
  try {
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, opts.userId));
    if (
      user &&
      !isTestEmail(user.email) &&
      (await causedByTestAccount(opts.testActivity))
    ) {
      return;
    }
    await db.insert(notifications).values({
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      meta: opts.meta,
    });
    if (opts.email === false) return;
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: `CheersJA — ${opts.title}`,
        html: emailLayout(opts.title, emailBody(opts)),
      });
    }
  } catch (error) {
    console.error(
      "notify failed:",
      error instanceof Error ? error.message : error
    );
  }
}

async function notifyMany(
  everyone: { id: string; email: string }[],
  opts: {
    type: string;
    title: string;
    body: string;
    meta?: Record<string, string>;
    email?: boolean;
  }
): Promise<void> {
  if (everyone.length === 0) return;
  const recipients = recipientsForActor(everyone, await causedByTestAccount());
  if (recipients.length === 0) return;
  await db.insert(notifications).values(
    recipients.map((a) => ({
      userId: a.id,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      meta: opts.meta,
    }))
  );
  if (opts.email === false) return;
  await Promise.all(
    recipients.map((a) =>
      sendEmail({
        to: a.email,
        subject: `CheersJA — ${opts.title}`,
        html: emailLayout(opts.title, emailBody(opts)),
      })
    )
  );
}

// Notify every admin (new bookings, payments, new users, reviews).
// Batched: one select, one insert, parallel emails — not 2N+1 queries.
// email: false records the in-app row only — for FYI notices (a new
// professional joined) that must never fill the owner's inbox.
export async function notifyAdmins(opts: {
  type: string;
  title: string;
  body: string;
  meta?: Record<string, string>;
  email?: boolean;
}): Promise<void> {
  try {
    const admins = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.role, "admin"));
    await notifyMany(admins, opts);
  } catch (error) {
    console.error(
      "notifyAdmins failed:",
      error instanceof Error ? error.message : error
    );
  }
}

// Identity verifications (the optional Verified ID badge) are reviewed by
// admins and supervisors — the same set that may approve them
// (actions/verification.ts). Plain customer support and drivers are not
// notified.
export async function notifyVerificationTeam(opts: {
  type: string;
  title: string;
  body: string;
  meta?: Record<string, string>;
}): Promise<void> {
  try {
    const team = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        or(
          eq(users.role, "admin"),
          and(eq(users.role, "support"), eq(users.supportRole, "supervisor"))
        )
      );
    await notifyMany(team, opts);
  } catch (error) {
    console.error(
      "notifyVerificationTeam failed:",
      error instanceof Error ? error.message : error
    );
  }
}

// Safety escalations go wider than notifyAdmins: admins plus desk support
// (customer_support/supervisor). Drivers are excluded — they transport
// workers, they don't work the safety desk.
export async function notifyStaff(opts: {
  type: string;
  title: string;
  body: string;
  meta?: Record<string, string>;
}): Promise<void> {
  try {
    // "Desk support" = any support account that is not a driver — including
    // NULL supportRole, so an account created before a sub-role is assigned
    // still receives emergencies (mirrors isDeskSupport in lib/guards.ts).
    const staff = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        or(
          eq(users.role, "admin"),
          and(
            eq(users.role, "support"),
            or(isNull(users.supportRole), ne(users.supportRole, "driver"))
          )
        )
      );
    await notifyMany(staff, opts);
  } catch (error) {
    console.error(
      "notifyStaff failed:",
      error instanceof Error ? error.message : error
    );
  }
}
