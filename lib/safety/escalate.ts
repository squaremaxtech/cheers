import { and, eq, gt, isNull, lte, ne, or } from "drizzle-orm";
import { db } from "@/db";
import {
  bookings,
  escalations,
  monitorShifts,
  safetyAlerts,
  safetySessions,
  trustedContacts,
  users,
  workers,
} from "@/db/schema";
import {
  ESCALATION_LADDER,
  safetyAlertLabel,
  smsEnabled,
  type EscalationAudience,
} from "@/lib/constants";
import { emailLayout, sendEmail } from "@/lib/mailer";
import { notify } from "@/lib/notify";
import { bookingEventNow, publishBooking, publishSafetyDesk } from "@/lib/realtime";
import { sendPush } from "@/lib/safety/push";
import { usersWithVerifiedPhone } from "@/lib/safety/risk";
import { MINUTE_MS, recordEvent } from "@/lib/safety/session";
import type { SafetyAlertKind, SafetyAlertRow } from "@/types";

// The ladder turns "something is wrong" into "a named human knows about it".
// Stage 0 fires immediately; later stages fire only while the alert remains
// UNACKNOWLEDGED. Acknowledging parks the ladder (someone owns it now);
// resolving closes it. Every attempt is written to `escalations` so that after
// an incident you can prove exactly who was told what, and when.

// --- Audience resolution --------------------------------------------------------

async function onDutyMonitors(now: Date): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: monitorShifts.userId })
    .from(monitorShifts)
    .innerJoin(users, eq(users.id, monitorShifts.userId))
    .where(
      and(
        lte(monitorShifts.startsAt, now),
        gt(monitorShifts.endsAt, now),
        eq(users.suspended, false)
      )
    );
  return rows.map((r) => r.userId);
}

async function allDeskStaff(): Promise<{ id: string; email: string }[]> {
  // Admins + every support account that is not a driver (desk support,
  // supervisors and safety monitors). Drivers transport; they do not respond.
  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(
      and(
        eq(users.suspended, false),
        or(
          eq(users.role, "admin"),
          and(
            eq(users.role, "support"),
            or(isNull(users.supportRole), ne(users.supportRole, "driver"))
          )
        )
      )
    );
}

async function admins(): Promise<{ id: string; email: string }[]> {
  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.suspended, false)));
}

// --- Alert creation ---------------------------------------------------------------

// Raises an alert and fires stage 0 immediately. Deduplicated per
// (session, kind) while an alert of that kind is still open, so a stuck
// condition — an unresponsive phone, say — pages the desk ONCE rather than
// every thirty seconds until someone screams.
export async function raiseAlert(opts: {
  bookingId: string;
  sessionId?: string | null;
  kind: SafetyAlertKind;
  message?: string | null;
  raisedByUserId?: string | null;
  covert?: boolean;
}): Promise<SafetyAlertRow | null> {
  if (opts.sessionId) {
    const [duplicate] = await db
      .select({ id: safetyAlerts.id })
      .from(safetyAlerts)
      .where(
        and(
          eq(safetyAlerts.sessionId, opts.sessionId),
          eq(safetyAlerts.kind, opts.kind),
          isNull(safetyAlerts.resolvedAt)
        )
      );
    if (duplicate) return null;
  }

  const now = new Date();
  const nextStage = ESCALATION_LADDER[1];
  const [alert] = await db
    .insert(safetyAlerts)
    .values({
      bookingId: opts.bookingId,
      sessionId: opts.sessionId ?? null,
      kind: opts.kind,
      message: opts.message ?? null,
      raisedByUserId: opts.raisedByUserId ?? null,
      covert: opts.covert ?? false,
      stage: 0,
      nextEscalationAt: nextStage
        ? new Date(now.getTime() + nextStage.afterMinutes * MINUTE_MS)
        : null,
    })
    .returning();

  await recordEvent({
    sessionId: opts.sessionId ?? null,
    bookingId: opts.bookingId,
    kind: "alert_raised",
    actorUserId: opts.raisedByUserId ?? null,
    payload: { alertId: alert.id, alertKind: opts.kind, covert: alert.covert },
  });

  // Push to the room and the desk BEFORE the (slow) email fan-out, so nobody
  // watching a screen waits on SMTP.
  publishBooking(opts.bookingId, bookingEventNow("alert"));
  publishSafetyDesk();
  void fireStage(alert, 0);
  return alert;
}

// --- Ladder execution ---------------------------------------------------------------

type AlertContext = {
  code: string;
  address: string;
  stageName: string;
  workerUserId: string | null;
  sessionId: string | null;
};

async function contextFor(alert: SafetyAlertRow): Promise<AlertContext> {
  const [row] = await db
    .select({
      code: bookings.code,
      address: bookings.address,
      stageName: workers.stageName,
      workerUserId: workers.userId,
    })
    .from(bookings)
    .innerJoin(workers, eq(bookings.workerId, workers.id))
    .where(eq(bookings.id, alert.bookingId));
  return {
    code: row?.code ?? "unknown",
    address: row?.address ?? "unknown address",
    stageName: row?.stageName ?? "A worker",
    workerUserId: row?.workerUserId ?? null,
    sessionId: alert.sessionId,
  };
}

async function logAttempts(
  alertId: string,
  stage: number,
  channel: "in_app" | "push" | "email" | "sms" | "voice",
  targets: { userId?: string; label?: string }[]
): Promise<void> {
  if (targets.length === 0) return;
  try {
    await db.insert(escalations).values(
      targets.map((t) => ({
        alertId,
        stage,
        channel,
        targetUserId: t.userId ?? null,
        targetLabel: t.label ?? null,
      }))
    );
  } catch (error) {
    console.error(
      "escalation log failed:",
      error instanceof Error ? error.message : error
    );
  }
}

// Fires one stage. Never throws: a channel that fails must not stop the
// remaining channels or the rest of the ladder.
export async function fireStage(
  alert: SafetyAlertRow,
  stage: number
): Promise<void> {
  const rung = ESCALATION_LADDER[stage];
  if (!rung) return;
  try {
    const ctx = await contextFor(alert);
    const label = safetyAlertLabel(alert.kind);
    const title = `${alert.kind === "duress" || alert.kind === "sos" ? "🚨" : "⚠"} ${label} — ${ctx.code}`;
    // Full detail for in-app rows and staff email.
    const body =
      `${ctx.stageName} · ${ctx.address}` +
      (alert.message ? ` · ${alert.message}` : "") +
      ` · stage ${stage + 1}: ${rung.label}`;
    // Push payloads transit a third-party push service and land on lock
    // screens anyone nearby can read — the customer's home address does NOT
    // go in them. Enough to know it's urgent; the desk has the rest.
    const pushBody =
      `${ctx.stageName} · booking ${ctx.code} · ${rung.label}` +
      " — open the safety desk.";
    const deskUrl = `/safety?alert=${alert.id}`;

    await dispatch(rung.audience, { alert, ctx, title, body, pushBody, deskUrl, stage });

    await recordEvent({
      sessionId: alert.sessionId,
      bookingId: alert.bookingId,
      kind: "escalation_fired",
      payload: { alertId: alert.id, stage, audience: rung.audience },
    });
  } catch (error) {
    console.error(
      "escalation stage failed:",
      error instanceof Error ? error.message : error
    );
  }
}

async function dispatch(
  audience: EscalationAudience,
  args: {
    alert: SafetyAlertRow;
    ctx: AlertContext;
    title: string;
    body: string;
    pushBody: string;
    deskUrl: string;
    stage: number;
  }
): Promise<void> {
  const { alert, ctx, title, body, pushBody, deskUrl, stage } = args;

  if (audience === "on_duty") {
    const monitors = await onDutyMonitors(new Date());
    // Nobody rostered? Do not swallow it — fall straight through to the whole
    // desk. An unstaffed rota must never mean an unanswered emergency.
    if (monitors.length === 0) {
      await dispatch("all_desk", args);
      return;
    }
    await Promise.all(
      monitors.map((userId) =>
        notify({ userId, type: "safety_alert", title, body, meta: { bookingId: alert.bookingId } })
      )
    );
    await sendPush(monitors, {
      title,
      body: pushBody,
      url: deskUrl,
      tag: `alert-${alert.id}`,
      urgent: true,
    });
    await logAttempts(alert.id, stage, "push", monitors.map((userId) => ({ userId })));
    await logAttempts(alert.id, stage, "in_app", monitors.map((userId) => ({ userId })));
    return;
  }

  if (audience === "all_desk" || audience === "admins") {
    const staff = audience === "admins" ? await admins() : await allDeskStaff();
    const ids = staff.map((s) => s.id);
    await Promise.all(
      staff.map((s) =>
        notify({
          userId: s.id,
          type: "safety_alert",
          title,
          body,
          meta: { bookingId: alert.bookingId },
        })
      )
    );
    await sendPush(ids, {
      title,
      body: pushBody,
      url: deskUrl,
      tag: `alert-${alert.id}`,
      urgent: true,
    });
    await logAttempts(alert.id, stage, "push", ids.map((userId) => ({ userId })));
    await logAttempts(alert.id, stage, "email", ids.map((userId) => ({ userId })));
    if (smsEnabled()) await sendSmsToUsers(ids, `${title} — ${body}`, alert.id, stage);
    return;
  }

  if (audience === "trusted_contacts") {
    if (!ctx.workerUserId) return;
    // NEVER for covert alerts. A duress alert means someone may be standing
    // over the worker — an outside contact told "try to reach them directly"
    // would ring the worker's phone at the worst possible moment. Covert
    // situations are handled by trained staff only; the ladder skips this
    // rung and proceeds to admins on schedule.
    if (alert.covert) return;
    const contacts = await db
      .select()
      .from(trustedContacts)
      .where(eq(trustedContacts.userId, ctx.workerUserId));
    const reachable = contacts.filter(
      (c) => c.verifiedAt && c.notifyOn.includes("alert")
    );
    if (reachable.length === 0) return;

    // Trusted contacts are NOT staff: they get the tracking link and a plain
    // statement of concern — never the customer's identity, never the address.
    const [session] = ctx.sessionId
      ? await db
          .select({ token: safetySessions.trackTokenHash })
          .from(safetySessions)
          .where(eq(safetySessions.id, ctx.sessionId))
      : [];
    const base = (process.env.NEXTAUTH_URL ?? "").replace(/\/$/, "");
    // The stored value is a hash; the live link is mailed at session start.
    // Here we point at the generic tracking entry so the contact can use the
    // link they already hold.
    const trackHint = session && base ? `${base}/track` : null;

    await Promise.all(
      reachable.map(async (contact) => {
        if (!contact.email) return;
        await sendEmail({
          to: contact.email,
          subject: `Cheers — please check on ${ctx.stageName}`,
          html: emailLayout(
            "Safety check requested",
            `<p>You are listed as a trusted contact for <strong>${ctx.stageName}</strong>.</p>
             <p>Our safety team has not been able to confirm they are OK during a booking, and is actively working on it.</p>
             <p>If you can reach them directly, please try now.</p>
             ${trackHint ? `<p>Your tracking link was sent when the visit began — open it to see their last known position.</p>` : ""}
             <p style="color:#6b6b6b;font-size:13px;">If you believe they are in immediate danger, call 119.</p>`
          ),
        });
      })
    );
    await logAttempts(
      alert.id,
      stage,
      "email",
      reachable.map((c) => ({ label: c.email ?? c.name }))
    );
    if (smsEnabled()) {
      await logAttempts(
        alert.id,
        stage,
        "sms",
        reachable.filter((c) => c.phone).map((c) => ({ label: c.phone ?? "" }))
      );
    }
  }
}

// SMS/voice go through a generic HTTP provider so the ladder does not hard-bind
// to one vendor. Disabled (and honestly absent) until configured.
async function sendSmsToUsers(
  userIds: string[],
  text: string,
  alertId: string,
  stage: number
): Promise<void> {
  const url = process.env.SMS_PROVIDER_URL;
  const token = process.env.SMS_PROVIDER_TOKEN;
  if (!url || !token || userIds.length === 0) return;
  try {
    // Only VERIFIED numbers are dialled. An unverified number is worse than no
    // number: it presents as a working escalation channel while going nowhere.
    const targets = await usersWithVerifiedPhone(userIds);
    if (targets.length === 0) return;
    await Promise.all(
      targets.map((t) =>
        fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ to: t.phone, text }),
        }).catch(() => undefined)
      )
    );
    await logAttempts(
      alertId,
      stage,
      "sms",
      targets.map((t) => ({ userId: t.id }))
    );
  } catch {
    // provider outage — the other channels already carried this stage
  }
}

// --- Ladder advancement (driven by the scheduler) -----------------------------------

// Advances every alert whose next stage is due. Acknowledged and resolved
// alerts are excluded by the query, so acknowledging really does stop the
// paging — the single most important property of the whole ladder.
export async function advanceDueLadders(now: Date): Promise<number> {
  const due = await db
    .select()
    .from(safetyAlerts)
    .where(
      and(
        isNull(safetyAlerts.resolvedAt),
        isNull(safetyAlerts.acknowledgedAt),
        lte(safetyAlerts.nextEscalationAt, now)
      )
    );

  let fired = 0;
  for (const alert of due) {
    const nextStage = alert.stage + 1;
    const rung = ESCALATION_LADDER[nextStage];
    const following = ESCALATION_LADDER[nextStage + 1];
    // CAS on stage: if a concurrent tick already advanced this alert, skip it
    // rather than paging the same people twice.
    const claimed = await db
      .update(safetyAlerts)
      .set({
        stage: nextStage,
        nextEscalationAt: following
          ? new Date(
              alert.createdAt.getTime() + following.afterMinutes * MINUTE_MS
            )
          : null,
      })
      .where(
        and(eq(safetyAlerts.id, alert.id), eq(safetyAlerts.stage, alert.stage))
      )
      .returning({ id: safetyAlerts.id });
    if (claimed.length === 0) continue;
    if (!rung) continue;
    await fireStage({ ...alert, stage: nextStage }, nextStage);
    fired++;
  }
  if (fired > 0) publishSafetyDesk();
  return fired;
}
