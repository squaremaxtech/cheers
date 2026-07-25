import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { db } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { pushEnabled } from "@/lib/constants";

// Web Push is the only channel that reaches a phone whose browser is closed,
// which makes it the backbone of every safety escalation. On iOS it works only
// once the site is installed to the home screen — hence the install prompt in
// worker onboarding.

// Push endpoints arrive FROM THE CLIENT and are then fetched BY THE SERVER.
// That is a server-side request forgery primitive unless the host is checked:
// without this allowlist a caller could register `http://169.254.169.254/...`
// (or an internal address) and have our server POST to it on every alert.
const ALLOWED_PUSH_HOSTS = [
  "android.googleapis.com",
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "updates-autopush.stage.mozaws.net",
  "web.push.apple.com",
  "notify.windows.com",
  "wns2-*.notify.windows.com",
];

export function isAllowedPushEndpoint(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  // TLS only — a plaintext endpoint would leak the payload in transit.
  if (url.protocol !== "https:") return false;
  const host = url.hostname.toLowerCase();
  return ALLOWED_PUSH_HOSTS.some((allowed) => {
    if (allowed.includes("*")) {
      // Only a leading-label wildcard is supported, e.g. wns2-*.notify...
      const [prefix, suffix] = allowed.split("*");
      return host.startsWith(prefix) && host.endsWith(suffix);
    }
    return host === allowed || host.endsWith(`.${allowed}`);
  });
}

let configured = false;
function configure(): boolean {
  if (!pushEnabled()) return false;
  if (!configured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:general@cheersja.com",
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
      process.env.VAPID_PRIVATE_KEY ?? ""
    );
    configured = true;
  }
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  // Where a tap should land.
  url?: string;
  // Renders the one-tap "I'm OK" / "I need help" notification actions.
  checkin?: { bookingId: string };
  // Collapses supersedable notifications (a later check-in replaces an
  // earlier one) instead of stacking a wall of them on the lock screen.
  tag?: string;
  urgent?: boolean;
};

// Sends to every device a set of users has registered. Never throws — a push
// failure must not break the escalation that triggered it, and the ladder has
// other channels behind this one.
//
// NOTE: payloads travel through a third-party push service. Nothing sensitive
// goes in them — no addresses, no customer names, no PINs. Just enough for the
// recipient to know they must open the app.
export async function sendPush(
  userIds: string[],
  payload: PushPayload
): Promise<number> {
  if (userIds.length === 0) return 0;
  if (!configure()) return 0;

  let sent = 0;
  try {
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(inArray(pushSubscriptions.userId, userIds));

    const dead: string[] = [];
    await Promise.all(
      subs.map(async (sub) => {
        if (!isAllowedPushEndpoint(sub.endpoint)) {
          dead.push(sub.id);
          return;
        }
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload),
            { TTL: payload.urgent ? 300 : 3600, urgency: payload.urgent ? "high" : "normal" }
          );
          sent++;
        } catch (error) {
          // 404/410 mean the browser dropped the subscription — prune it so
          // the table does not fill with endpoints that can never deliver.
          const status =
            typeof error === "object" && error !== null && "statusCode" in error
              ? Number((error as { statusCode: unknown }).statusCode)
              : 0;
          if (status === 404 || status === 410) dead.push(sub.id);
        }
      })
    );

    if (dead.length > 0) {
      await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
    }
  } catch (error) {
    console.error(
      "sendPush failed:",
      error instanceof Error ? error.message : error
    );
  }
  return sent;
}

export async function removeSubscription(
  userId: string,
  endpoint: string
): Promise<void> {
  const [existing] = await db
    .select({ id: pushSubscriptions.id, userId: pushSubscriptions.userId })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
  // Ownership check: an endpoint is only removable by the account that owns
  // it, so one user cannot silence another's alerts.
  if (!existing || existing.userId !== userId) return;
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, existing.id));
}
