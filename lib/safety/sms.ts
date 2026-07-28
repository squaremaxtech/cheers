import { smsEnabled } from "@/lib/constants";

// One vendor-agnostic SMS sender for the whole safety system.
//
// Two rules live here, and they are the reason this is a module rather than an
// inline fetch:
//
// 1. A channel that silently fails is worse than one that is honestly absent.
//    With no provider configured this returns "delivered nothing" rather than
//    pretending. Callers log what came back, so `escalations` records what was
//    actually attempted instead of what we hoped would happen.
// 2. Escalation SMS is best-effort per recipient. One bad number must not stop
//    the other recipients, and no SMS failure may ever throw into the ladder.

export type SmsTarget = {
  to: string;
  // How this recipient appears in the escalation log: a userId for staff, a
  // name/number for an external contact.
  userId?: string;
  label?: string;
};

// Sends to every target and returns only those the provider accepted.
// Never throws.
export async function sendSms(
  targets: SmsTarget[],
  text: string
): Promise<SmsTarget[]> {
  const url = process.env.SMS_PROVIDER_URL;
  const token = process.env.SMS_PROVIDER_TOKEN;
  if (!smsEnabled() || !url || !token || targets.length === 0) return [];

  const results = await Promise.all(
    targets.map(async (target) => {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ to: target.to, text }),
        });
        return res.ok ? target : null;
      } catch {
        // Provider outage or a malformed number. The other channels on this
        // rung already carried the message; the ladder keeps climbing.
        return null;
      }
    })
  );
  return results.filter((t): t is SmsTarget => t !== null);
}

// Two SMS segments. Past this, providers split or reject.
const SMS_MAX = 300;

// SMS has no layout and a hard length budget, so every safety text is built
// here — one place to keep them short, unambiguous, and free of the customer's
// identity or address (a text lands on a lock screen anyone nearby can read).
//
// `keep` is a link, and it is NEVER truncated. Worker names are accepted up to
// 120 characters, which is long enough to push a confirmation or tracking URL
// past the cap; a URL cut off at the end is not a shorter message, it is a
// broken one, and for a confirmation link it means that contact can never be
// reached at all. So the prose gives way and the link always survives whole.
export function smsLine(parts: string[], keep?: string): string {
  const prose = parts.filter(Boolean).join(" ");
  if (!keep) return prose.slice(0, SMS_MAX);

  const budget = SMS_MAX - keep.length - 1; // -1 for the joining space
  if (budget <= 0) return keep; // a bare link still works; a cut one does not
  const trimmed =
    prose.length > budget
      ? `${prose.slice(0, budget - 1).trimEnd()}…`
      : prose;
  return `${trimmed} ${keep}`;
}
