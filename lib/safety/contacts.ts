import { eq } from "drizzle-orm";
import { db } from "@/db";
import { trustedContacts } from "@/db/schema";
import { smsEnabled } from "@/lib/constants";
import { emailLayout, sendEmail } from "@/lib/mailer";
import { sendSms, smsLine } from "@/lib/safety/sms";
import type { TrustedContactRow } from "@/types";

// Everything the platform ever says to a worker's OWN people lives here.
//
// Trusted contacts are outside the platform. They are not staff, they have no
// account, and they have consented to exactly one thing: being told when the
// person who listed them might be in trouble. So the boundary is absolute —
// a trusted contact receives the worker's status and last known position, and
// NEVER the customer's identity, the customer's name, or the visit address.
// A safety link is not a licence to watch someone's working life.
//
// Keeping the fan-out in one module (rather than inline in the ladder and
// again in the actions) is what stops that boundary from drifting apart
// between surfaces.

// What a fan-out actually managed to deliver. The caller writes these to
// `escalations`, so the incident log records real attempts rather than
// intentions — see lib/safety/sms.ts.
export type ContactDelivery = {
  channel: "email" | "sms";
  label: string;
};

export type ContactTrigger = "session_start" | "overdue" | "alert";

// A contact can only be reached on a channel that is both present and working.
// SMS with no provider configured is not a channel — it is a promise we would
// silently break, so it does not count here or in the UI.
export function contactChannels(contact: {
  email: string | null;
  phone: string | null;
}): { email: boolean; sms: boolean } {
  return {
    email: Boolean(contact.email),
    sms: Boolean(contact.phone) && smsEnabled(),
  };
}

export function contactIsReachable(contact: {
  email: string | null;
  phone: string | null;
  verifiedAt: Date | null;
}): boolean {
  if (!contact.verifiedAt) return false;
  const channels = contactChannels(contact);
  return channels.email || channels.sms;
}

// Verified contacts who opted into this trigger. Unverified contacts are never
// included: consent is the whole point, and an unconfirmed number is exactly
// the kind of channel that looks like cover while going nowhere.
async function opted(
  workerUserId: string,
  trigger: ContactTrigger
): Promise<TrustedContactRow[]> {
  const rows = await db
    .select()
    .from(trustedContacts)
    .where(eq(trustedContacts.userId, workerUserId));
  return rows.filter(
    (c) => c.verifiedAt && c.notifyOn.includes(trigger) && contactIsReachable(c)
  );
}

// Sends one message to one contact across every channel they have, and reports
// what actually went out.
async function deliver(
  contact: TrustedContactRow,
  msg: { subject: string; heading: string; html: string; sms: string }
): Promise<ContactDelivery[]> {
  const channels = contactChannels(contact);
  const delivered: ContactDelivery[] = [];

  if (channels.email && contact.email) {
    await sendEmail({
      to: contact.email,
      subject: msg.subject,
      html: emailLayout(msg.heading, msg.html),
    });
    // sendEmail swallows its own failures by design (a failed notification must
    // never break the action that triggered it), so this records an attempt.
    delivered.push({ channel: "email", label: contact.email });
  }

  if (channels.sms && contact.phone) {
    const sent = await sendSms([{ to: contact.phone, label: contact.name }], msg.sms);
    // Only what the provider accepted — an unsent text is not a notification.
    for (const t of sent) delivered.push({ channel: "sms", label: t.to });
  }

  return delivered;
}

// --- Consent -----------------------------------------------------------------------

// Consent before contact: nobody gets woken at 3am about someone else's safety
// without having agreed to it first. The same single-use token goes out on
// every channel we have — consent is to being a contact, not to a channel.
export async function sendContactConfirmation(opts: {
  contactName: string;
  email: string | null;
  phone: string | null;
  workerName: string;
  token: string;
}): Promise<void> {
  const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
  const link = `${base}/track/confirm/${opts.token}`;

  if (opts.email) {
    await sendEmail({
      to: opts.email,
      subject: "Cheers — you've been added as a safety contact",
      html: emailLayout(
        "Confirm you're a safety contact",
        `<p><strong>${opts.workerName}</strong> listed you as a trusted safety contact.</p>
         <p>If they don't check in during a booking, our safety team may contact you and share a live tracking link.</p>
         <p style="margin-top:24px;">
           <a href="${link}" style="background:#d6b25e;color:#0c0a09;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:14px;">Confirm</a>
         </p>
         <p style="color:#6b6b6b;font-size:13px;">If this wasn't expected, ignore this email — you won't be contacted.</p>`
      ),
    });
  }

  if (opts.phone && smsEnabled()) {
    await sendSms(
      [{ to: opts.phone, label: opts.contactName }],
      smsLine(
        [
          `${opts.workerName} listed you as their Cheers safety contact.`,
          "Confirm to be reached if they don't check in during a booking:",
        ],
        link
      )
    );
  }
}

// --- Session start: the tracking link -------------------------------------------------

// The plaintext tracking token exists only on the call that creates the
// session, so this is the ONE moment a live link can be sent. Contacts who did
// not opt into `session_start` get no link — and the later concern messages
// know not to reference one they never received.
export async function sendTrackingLinks(
  workerUserId: string,
  ctx: { stageName: string; token: string | null }
): Promise<void> {
  try {
    if (!ctx.token) return;
    const targets = await opted(workerUserId, "session_start");
    if (targets.length === 0) return;

    const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
    const link = `${base}/track/${ctx.token}`;

    await Promise.all(
      targets.map((contact) =>
        deliver(contact, {
          subject: `Cheers — ${ctx.stageName} has started a booking`,
          heading: "Live tracking link",
          html: `<p><strong>${ctx.stageName}</strong> has started a monitored booking and listed you as a safety contact.</p>
             <p>You can follow their status and last known position here:</p>
             <p style="margin-top:24px;">
               <a href="${link}" style="background:#d6b25e;color:#0c0a09;padding:10px 22px;border-radius:8px;text-decoration:none;font-size:14px;">Open tracking</a>
             </p>
             <p style="color:#6b6b6b;font-size:13px;">This link expires shortly after the booking ends. Our safety team monitors every session; you'll only hear from us again if something needs attention.</p>`,
          sms: smsLine(
            [
              `${ctx.stageName} has started a monitored Cheers booking.`,
              "Follow their status:",
            ],
            link
          ),
        })
      )
    );
  } catch (error) {
    console.error(
      "trusted contact tracking link failed:",
      error instanceof Error ? error.message : error
    );
  }
}

// --- Concern: overdue, then genuine alarm ---------------------------------------------

// What an overdue alert is TOLD TO A FAMILY MEMBER, per kind.
//
// This map exists because five different alert kinds reach the overdue path
// (see OVERDUE_ALERT_KINDS) and they mean genuinely different things. Telling
// someone's mother "she missed a check-in" when in fact she left the visit and
// never confirmed getting home sends her looking in the wrong place. The desk
// gets `safetyAlertLabel`; the family gets this — plainer, and accurate.
//
// Still bound by the same rule as everything else in this file: the customer's
// name and the address appear in none of it.
const OVERDUE_COPY: Record<
  string,
  { subject: string; heading: string; sentence: string; sms: string }
> = {
  missed_checkin: {
    subject: "has missed a check-in",
    heading: "Missed check-in",
    sentence: "They have missed a safety check-in during a booking.",
    sms: "missed a Cheers safety check-in.",
  },
  unresponsive: {
    subject: "has missed a check-in, and their phone is quiet",
    heading: "Missed check-in — no signal",
    sentence:
      "They have missed a safety check-in during a booking, and their phone has stopped responding.",
    sms: "missed a Cheers safety check-in and their phone is not responding.",
  },
  no_arrival: {
    subject: "hasn't confirmed arriving",
    heading: "No arrival confirmed",
    sentence:
      "They haven't confirmed arriving at a booking they were travelling to.",
    sms: "hasn't confirmed arriving at a Cheers booking.",
  },
  // Phrased to read correctly after "<stage name> " — no possessives, or the
  // join produces "Maxx 's booking has run over".
  overrun: {
    subject: "hasn't checked out of a booking that has run over",
    heading: "Booking running over",
    sentence:
      "Their booking has run past its expected end and they haven't checked out.",
    sms: "hasn't checked out of a Cheers booking that has run over.",
  },
  get_home_overdue: {
    subject: "hasn't confirmed getting home",
    heading: "No get-home confirmation",
    sentence:
      "They left a booking but haven't confirmed getting home safely.",
    sms: "left a Cheers booking but hasn't confirmed getting home.",
  },
};

const OVERDUE_FALLBACK = {
  subject: "may need checking on",
  heading: "Safety check",
  sentence: "Something during their booking needs checking on.",
  sms: "may need checking on during a Cheers booking.",
};

// Two different moments, deliberately worded differently:
//
//   'overdue' fires the instant a check-in is actually missed. It is the
//   worker's own early warning — "they're late, we're already on it" — and it
//   goes only to contacts who asked for it.
//
//   'alert' is the escalation ladder's rung, minutes later, once staff have
//   failed to get an answer. That one asks the contact to actively try.
//
// Neither is ever sent for a covert alert: a duress PIN means someone may be
// standing over the worker, and an outside contact told to "reach them now"
// would ring that phone at the worst possible moment. Covert situations are
// handled by trained staff only — the caller enforces this.
export async function notifyContactsOfConcern(
  workerUserId: string,
  trigger: "overdue" | "alert",
  ctx: { stageName: string; kind: string }
): Promise<ContactDelivery[]> {
  try {
    const targets = await opted(workerUserId, trigger);
    if (targets.length === 0) return [];

    const copy = OVERDUE_COPY[ctx.kind] ?? OVERDUE_FALLBACK;

    const results = await Promise.all(
      targets.map((contact) => {
        // Only reference the tracking link if this contact was actually sent
        // one when the visit began. Telling someone to open a link they never
        // received wastes the seconds that matter.
        const hasLink = contact.notifyOn.includes("session_start");
        const linkNote = hasLink
          ? `<p>Open the tracking link we sent you when this visit began to see their last known position.</p>`
          : "";

        return trigger === "overdue"
          ? deliver(contact, {
              subject: `Cheers — ${ctx.stageName} ${copy.subject}`,
              heading: copy.heading,
              html: `<p>You are listed as a trusted contact for <strong>${ctx.stageName}</strong>.</p>
                 <p>${copy.sentence} Our safety team has already been alerted and is working on it.</p>
                 ${linkNote}
                 <p>There is nothing you need to do yet — we're telling you because you asked to know early.</p>
                 <p style="color:#6b6b6b;font-size:13px;">If you believe they are in immediate danger, call 119.</p>`,
              sms: smsLine([
                `${ctx.stageName} ${copy.sms}`,
                "Our safety team is on it — nothing for you to do yet.",
                "If you believe they are in danger, call 119.",
              ]),
            })
          : deliver(contact, {
              subject: `Cheers — please check on ${ctx.stageName}`,
              heading: "Safety check requested",
              html: `<p>You are listed as a trusted contact for <strong>${ctx.stageName}</strong>.</p>
                 <p>Our safety team has not been able to confirm they are OK during a booking, and is actively working on it.</p>
                 <p><strong>If you can reach them directly, please try now.</strong></p>
                 ${linkNote}
                 <p style="color:#6b6b6b;font-size:13px;">If you believe they are in immediate danger, call 119.</p>`,
              sms: smsLine([
                `Cheers safety: we cannot confirm ${ctx.stageName} is OK during a booking.`,
                "If you can reach them directly, please try now.",
                "If you believe they are in danger, call 119.",
              ]),
            });
      })
    );
    return results.flat();
  } catch (error) {
    console.error(
      "trusted contact concern notify failed:",
      error instanceof Error ? error.message : error
    );
    return [];
  }
}
