import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { trustedContacts, workers } from "@/db/schema";
import PushSetup from "@/components/safety/PushSetup";
import SafetySettings from "@/components/safety/SafetySettings";
import TrustedContacts from "@/components/safety/TrustedContacts";
import {
  CHECKIN_GRACE_MINUTES,
  CHECKIN_INTERVAL_OPTIONS,
  CHECKIN_SNOOZE_MINUTES,
  CHECKIN_SNOOZES_PER_SESSION,
  GET_HOME_SAFE_MINUTES,
  HEARTBEAT_GRACE_MINUTES,
  WELLNESS_CHECK_INTERVAL_MINUTES,
} from "@/lib/constants";
import { smsConfigured } from "@/lib/safety/sms";
import { getWorkerContext } from "@/lib/worker-context";

export const metadata: Metadata = { title: "Safety" };

// The worker's own safety control panel. Deliberately explains WHAT HAPPENS IF
// THEY GO QUIET, because that is the part of the system that protects them
// when they cannot act — and a protection nobody knows about is one they
// cannot rely on.
export default async function WorkerSafetyPage() {
  const { user, worker } = await getWorkerContext();

  const [contacts, workerRow] = await Promise.all([
    db.select().from(trustedContacts).where(eq(trustedContacts.userId, user.id)),
    db
      .select({ cancelPinHash: workers.cancelPinHash })
      .from(workers)
      .where(eq(workers.id, worker.id))
      .then((rows) => rows[0] ?? null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-ink">Safety</h1>
        <p className="mt-1 text-sm text-muted">
          How we look after you during a visit — and what happens if we
          don&apos;t hear from you.
        </p>
      </div>

      {/* Plain-language explanation of the automatic protection. */}
      <section className="card space-y-3 border-gold/30 p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gold-deep">
          What happens automatically
        </h2>
        <ul className="space-y-2 text-sm text-muted">
          <li>
            <strong className="text-ink">On the cadence you chose</strong> we ask
            you to tap &ldquo;I&apos;m OK&rdquo;. You can answer straight from
            the notification. Each of your gigs sets its own rhythm — you
            can&apos;t answer a prompt mid-set, and you shouldn&apos;t have to.
          </li>
          <li>
            <strong className="text-ink">
              Mid-job you can snooze {CHECKIN_SNOOZE_MINUTES / 60} hours
            </strong>{" "}
            — up to {CHECKIN_SNOOZES_PER_SESSION} times a visit. It moves the
            next check-in only. Everything below still runs on time.
          </li>
          <li>
            <strong className="text-ink">
              If you don&apos;t answer within {CHECKIN_GRACE_MINUTES} minutes
            </strong>
            , our safety desk is alerted and someone starts working on it.
          </li>
          <li>
            <strong className="text-ink">
              If your phone goes silent for {HEARTBEAT_GRACE_MINUTES} minutes
            </strong>{" "}
            — switched off, out of battery, out of signal, or taken from you —
            we treat that as an emergency on its own. You don&apos;t have to
            press anything.
          </li>
          <li>
            <strong className="text-ink">When you say you&apos;ve left</strong>,
            we check you got home within {GET_HOME_SAFE_MINUTES} minutes.
          </li>
        </ul>
        <p className="text-xs text-faint">
          You never have to reach a button for us to notice something is wrong.
          Silence is enough.
        </p>
      </section>

      {/* The cadence is a per-GIG setting, edited on the gig itself. This
          panel exists so a professional can see every option and what each
          one costs them in interruptions before they go and pick one. */}
      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            How often we check in
          </h2>
          <p className="mt-1 text-xs text-faint">
            Set per gig, on the gig itself — a six-hour stage set and a
            one-to-one house call should not be interrupted at the same rate.
            Gigs with nothing chosen use the platform default of{" "}
            {WELLNESS_CHECK_INTERVAL_MINUTES} minutes. The cadence is copied
            onto each booking when it is made, so changing a gig never re-times
            a job already on your calendar.
          </p>
        </div>
        <ul className="space-y-2">
          {CHECKIN_INTERVAL_OPTIONS.map((option) => (
            <li
              key={option.minutes}
              className="rounded-xl border border-hairline p-3"
            >
              <p className="text-sm text-ink">{option.label}</p>
              <p className="mt-0.5 text-xs text-faint">{option.hint}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-faint">
          Whatever you choose, the parts that save lives never switch off: the
          PIN-verified start, your emergency PIN, the SOS, your phone&apos;s
          heartbeat, the arrival and overrun deadlines and the get-home-safe
          check all run on every monitored booking.
        </p>
      </section>

      <section className="card p-6">
        <PushSetup vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Emergency cancel code
          </h2>
          <p className="mt-1 text-xs text-faint">
            When you trigger an emergency, a countdown starts and the alert
            sends itself. Only this code stops it — so if someone takes your
            phone, they can&apos;t cancel it.
          </p>
        </div>
        <SafetySettings hasCancelPin={Boolean(workerRow?.cancelPinHash)} />
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Trusted contacts
          </h2>
          <p className="mt-1 text-xs text-faint">
            Your own people — up to three. Choose what reaches them: a live
            tracking link when a visit starts, a heads-up the moment you miss a
            check-in, and a request to try you directly if our team still
            can&apos;t reach you. They never see the customer&apos;s name or the
            address — only where you are and whether you&apos;re OK.
          </p>
        </div>
        <TrustedContacts
          smsEnabled={smsConfigured()}
          contacts={contacts.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            phone: c.phone,
            verified: c.verifiedAt !== null,
            notifyOn: c.notifyOn,
          }))}
        />
      </section>
    </div>
  );
}
