import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { emailLayout, sendEmail } from "@/lib/mailer";

// Booking-related emails deep-link to the live booking room.
function emailBody(opts: { body: string; meta?: Record<string, string> }): string {
  const base = process.env.NEXTAUTH_URL ?? "";
  if (!opts.meta?.bookingId || !base) return `<p>${opts.body}</p>`;
  const url = `${base.replace(/\/$/, "")}/bookings/${opts.meta.bookingId}`;
  return `<p>${opts.body}</p>
    <p style="margin-top:24px;">
      <a href="${url}" style="background:#d6b25e;color:#0c0a09;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:14px;">View booking</a>
    </p>`;
}

// Central notification dispatcher: writes an in-app notification row and
// mirrors it as an email. Never throws — a failed notification must not
// break the mutation that triggered it.
export async function notify(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  meta?: Record<string, string>;
}): Promise<void> {
  try {
    await db.insert(notifications).values({
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      meta: opts.meta,
    });
    const [user] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, opts.userId));
    if (user?.email) {
      await sendEmail({
        to: user.email,
        subject: `Cheers — ${opts.title}`,
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
  recipients: { id: string; email: string }[],
  opts: { type: string; title: string; body: string; meta?: Record<string, string> }
): Promise<void> {
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
  await Promise.all(
    recipients.map((a) =>
      sendEmail({
        to: a.email,
        subject: `Cheers — ${opts.title}`,
        html: emailLayout(opts.title, emailBody(opts)),
      })
    )
  );
}

// Notify every admin (new bookings, payments, new users, reviews).
// Batched: one select, one insert, parallel emails — not 2N+1 queries.
export async function notifyAdmins(opts: {
  type: string;
  title: string;
  body: string;
  meta?: Record<string, string>;
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
