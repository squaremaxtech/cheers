import { eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications, users } from "@/db/schema";
import { emailLayout, sendEmail } from "@/lib/mailer";

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
        html: emailLayout(opts.title, `<p>${opts.body}</p>`),
      });
    }
  } catch (error) {
    console.error(
      "notify failed:",
      error instanceof Error ? error.message : error
    );
  }
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
    if (admins.length === 0) return;

    await db.insert(notifications).values(
      admins.map((a) => ({
        userId: a.id,
        type: opts.type,
        title: opts.title,
        body: opts.body,
        meta: opts.meta,
      }))
    );
    await Promise.all(
      admins.map((a) =>
        sendEmail({
          to: a.email,
          subject: `Cheers — ${opts.title}`,
          html: emailLayout(opts.title, `<p>${opts.body}</p>`),
        })
      )
    );
  } catch (error) {
    console.error(
      "notifyAdmins failed:",
      error instanceof Error ? error.message : error
    );
  }
}
