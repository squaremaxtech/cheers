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
//
// Providers are pluggable because the owner is in Jamaica and will most likely
// run Twilio, whose API is form-encoded with HTTP basic auth — a shape the
// original generic {to,text}+bearer sender simply cannot speak. Adding an
// adapter must never change the four guarantees above.

export type SmsTarget = {
  to: string;
  // How this recipient appears in the escalation log: a userId for staff, a
  // name/number for an external contact.
  userId?: string;
  label?: string;
};

export type SmsProvider = "twilio" | "generic";

// Which adapter is in play. Default is `generic` on purpose: an existing
// deployment that only ever set SMS_PROVIDER_URL/_TOKEN keeps working
// byte-for-byte after this change.
export function smsProvider(): SmsProvider {
  return process.env.SMS_PROVIDER?.trim().toLowerCase() === "twilio"
    ? "twilio"
    : "generic";
}

// Is SMS actually sendable right now?
//
// `smsEnabled()` (lib/constants.ts) is the GENERIC provider's gate and is left
// exactly as it was. The provider-shaped check lives here so that constants
// stays a values file and adding a third provider never touches it. Everything
// in the safety system asks this function, never smsEnabled() directly.
export function smsConfigured(): boolean {
  if (smsProvider() === "twilio") {
    return Boolean(
      process.env.TWILIO_ACCOUNT_SID &&
        process.env.TWILIO_AUTH_TOKEN &&
        process.env.TWILIO_FROM_NUMBER
    );
  }
  return smsEnabled();
}

// --- Jamaican number normalisation ------------------------------------------------
//
// Numbers are typed by humans into a free-text box: "876-555-0123",
// "(876) 555 0123", "5550123", "+1 876 555 0123". Every provider wants E.164
// ("+18765550123") and quietly rejects anything else — which in this system
// means a trusted contact who looks configured and is never actually reached.
//
// Jamaica is NANP country code 1 with TWO area codes: 876 (original) and 658
// (the 2018 overlay). Both are dialled as +1<area><7 digits>.
//
// A bare 7-digit local number is genuinely ambiguous between the two overlaid
// codes, so it is assumed to be 876 — the code that carries the overwhelming
// majority of Jamaican lines. Anyone on a 658 line must type the area code,
// which is what overlay dialling requires of them locally anyway.
//
// Returns null when the input cannot be made into a plausible E.164 number.
// Null means "do not send" — never "send it and hope".
export function toE164(raw: string): string | null {
  const trimmed = raw.trim();
  const explicitPlus = trimmed.startsWith("+");
  let digits = trimmed.replace(/\D/g, "");
  // "00" is the international access prefix in most of the world; treat
  // 001876… the same as +1876….
  if (!explicitPlus && digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 0) return null;

  if (explicitPlus) {
    // Already international — trust it, but only if it is a sane length.
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }
  // 7 digits: a Jamaican local number. 876 assumed (see above).
  if (digits.length === 7) return `+1876${digits}`;
  // 10 digits: a NANP number without the country code — 876/658 included.
  if (digits.length === 10) return `+1${digits}`;
  // 11 digits starting 1: NANP with the country code, no plus.
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // 12–15 digits: an international number typed without its plus.
  if (digits.length >= 12 && digits.length <= 15) return `+${digits}`;
  // 8–9 digits is neither a JM local number nor a NANP one. Refuse rather
  // than invent a country code for it.
  return null;
}

// --- Sending -----------------------------------------------------------------------

// A provider call that never throws and never hangs the ladder. Returns true
// only when the provider accepted the message.
const SEND_TIMEOUT_MS = 8_000;

async function sendGeneric(to: string, text: string): Promise<boolean> {
  const url = process.env.SMS_PROVIDER_URL;
  const token = process.env.SMS_PROVIDER_TOKEN;
  if (!url || !token) return false;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, text }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  return res.ok;
}

// Twilio's Messages resource: form-encoded body, HTTP basic auth of
// AccountSid:AuthToken, and a 201 on acceptance.
async function sendTwilio(to: string, text: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) return false;

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      },
      body: new URLSearchParams({ To: to, From: from, Body: text }).toString(),
      signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
    }
  );
  return res.ok;
}

// Sends to every target and returns only those the provider accepted, with
// `to` rewritten to the number that was actually dialled — the incident log
// should record what left the building, not what someone typed.
// Never throws.
export async function sendSms(
  targets: SmsTarget[],
  text: string
): Promise<SmsTarget[]> {
  if (!smsConfigured() || targets.length === 0) return [];
  const provider = smsProvider();

  const results = await Promise.all(
    targets.map(async (target) => {
      const to = toE164(target.to);
      // An unusable number is not a delivery failure to retry — it is a
      // number we can never reach. Say nothing went out for it.
      if (!to) return null;
      try {
        const accepted =
          provider === "twilio"
            ? await sendTwilio(to, text)
            : await sendGeneric(to, text);
        return accepted ? { ...target, to } : null;
      } catch {
        // Provider outage, timeout, or a rejected number. The other channels
        // on this rung already carried the message; the ladder keeps climbing.
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
