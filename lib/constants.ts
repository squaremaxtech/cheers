// Customers may cancel up to this many hours before the booking start time.
export const CANCEL_MIN_HOURS = 5;

// Percent of the booking price (excluding tip) kept by the platform.
export const PLATFORM_FEE_PERCENT = Number(
  process.env.PLATFORM_FEE_PERCENT ?? 5
);

// Charge currency (Stripe); amounts stored as integer cents.
export const CURRENCY = "usd";

// Stripe is the online-payments layer and it is OPTIONAL: the platform is
// cash-first (Jamaica) and every flow works with no keys set. Card buttons,
// the Chat Pass checkout and Connect payouts appear only once this is true.
export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

// Chat Pass: the $5/month subscription that unlocks messaging any worker.
// Browsing is free; booking never requires it (flag below); a booked
// customer/worker pair can always chat regardless.
export const MEMBERSHIP_PERIOD_DAYS = 30;

export function chatPassPriceCents(): number {
  return Number(
    process.env.CHAT_PASS_PRICE_CENTS ?? process.env.MEMBERSHIP_PRICE_CENTS ?? 500
  );
}

// Owner's lever for after the launch year: when "on", creating a booking
// also requires an active Chat Pass. Default off — booking stays
// subscription-free.
export function bookingRequiresChatPass(): boolean {
  return process.env.BOOKING_REQUIRES_SUBSCRIPTION === "on";
}

// All booking dates/times are Jamaica wall-clock time (UTC-5, no DST).
// Parsing must pin this offset — server timezone must never matter.
export const JAMAICA_UTC_OFFSET = "-05:00";

export const JAMAICA_PARISHES = [
  "Kingston",
  "St. Andrew",
  "St. Thomas",
  "Portland",
  "St. Mary",
  "St. Ann",
  "Trelawny",
  "St. James",
  "Hanover",
  "Westmoreland",
  "St. Elizabeth",
  "Manchester",
  "Clarendon",
  "St. Catherine",
] as const;

export const BODY_TYPES = [
  "Slim",
  "Athletic",
  "Average",
  "Curvy",
  "Muscular",
  "Plus size",
] as const;

export const LANGUAGES = [
  "English",
  "Patois",
  "Spanish",
  "French",
  "German",
] as const;

export const BOOKING_DURATIONS_MINUTES = [60, 90, 120, 180, 240, 360] as const;

// ---------------------------------------------------------------------------
// Gigs & quotes
// ---------------------------------------------------------------------------

// A worker's listings. Generous for real portfolios, tight enough that one
// account cannot flood browse.
export const GIGS_PER_WORKER_MAX = 15;
export const GIG_TAGS_MAX = 8;
export const GIG_TITLE_MAX_CHARS = 80;
export const GIG_DESCRIPTION_MAX_CHARS = 2000;

// Quote requests (quote-mode gigs): the customer describes the job, the
// worker sends one priced offer, accepting it becomes a booking.
export const QUOTE_EXPIRY_DAYS = 14;
export const QUOTE_DESCRIPTION_MAX_CHARS = 2000;
// Anti-abuse: new quote requests per customer per day.
export const QUOTES_PER_DAY = 10;

// ---------------------------------------------------------------------------
// Rides (driver marketplace)
// ---------------------------------------------------------------------------

// Suggested fare = max(driver minimum, base + per-km × distance). When the
// driver has published no rates the platform defaults apply. The rider's
// offer is always free-form — the suggestion is guidance, not a floor.
export const RIDE_BASE_FARE_CENTS = Number(
  process.env.RIDE_BASE_FARE_CENTS ?? 300
);
export const RIDE_PER_KM_CENTS = Number(process.env.RIDE_PER_KM_CENTS ?? 150);

// An ASAP request stays open this long for drivers to bid before it expires;
// scheduled rides stay open until their pickup time.
export const RIDE_REQUEST_OPEN_HOURS = 2;

// Anti-abuse: ride requests per rider per day; offer updates per driver/min.
export const RIDES_PER_DAY = 20;
export const RIDE_OFFERS_PER_MINUTE = 10;

export const RIDE_STATUS_LABELS: Record<string, string> = {
  requested: "Finding a driver",
  accepted: "Driver confirmed",
  arriving: "Driver on the way",
  picked_up: "On the road",
  completed: "Completed",
  cancelled: "Cancelled",
  expired: "Expired",
};

export function rideStatusLabel(status: string): string {
  return RIDE_STATUS_LABELS[status] ?? status;
}

// ---------------------------------------------------------------------------
// Safety monitoring
// ---------------------------------------------------------------------------
// Every value below is a DEADLINE the safety scheduler enforces server-side
// (lib/safety/scheduler.ts). None of them depend on anyone having a page open:
// the whole point is that silence escalates on its own.

// Timings are env-overridable so they can be tuned without a redeploy — and
// so the whole time-based system can actually be DEMONSTRATED and TESTED. A
// 30-minute check-in cycle is right in production and useless in a demo; set
// SAFETY_CHECKIN_MINUTES=2 to watch the full escalation ladder run in a few
// minutes. See docs/DEMO-WALKTHROUGH.md.
function envMinutes(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
}

// While a booking is in progress the worker checks in on this cadence.
export const WELLNESS_CHECK_INTERVAL_MINUTES = envMinutes(
  "SAFETY_CHECKIN_MINUTES",
  30
);

// The safety screen pings this often while it is open. Missing heartbeats are
// the passive signal that shows the desk a phone has gone quiet.
export const HEARTBEAT_SECONDS = Number(process.env.SAFETY_HEARTBEAT_SECONDS) > 0
  ? Number(process.env.SAFETY_HEARTBEAT_SECONDS)
  : 45;

// Silence longer than this while a visit is live marks the session
// 'unresponsive' on the desk board (it does not page on its own — see
// lib/safety/scheduler.ts for why).
export const HEARTBEAT_GRACE_MINUTES = envMinutes("SAFETY_HEARTBEAT_GRACE_MINUTES", 3);

// A worker has this long to answer a due check-in before it counts as missed
// and the staff ladder starts. Reminders fire inside the window.
export const CHECKIN_GRACE_MINUTES = envMinutes("SAFETY_CHECKIN_GRACE_MINUTES", 5);

// Reminder nudges to the worker inside the grace window (minutes past due).
export const CHECKIN_REMINDER_MINUTES = [0, 2] as const;

// Slack past the booking's scheduled end before an un-closed session is an
// 'overrun'. Sessions legitimately run a little long.
export const OVERRUN_GRACE_MINUTES = envMinutes("SAFETY_OVERRUN_GRACE_MINUTES", 20);

// Travelling home is a real risk window. After a worker says they're out, they
// have this long to confirm they got home.
export const GET_HOME_SAFE_MINUTES = envMinutes("SAFETY_GET_HOME_MINUTES", 45);

// Grace past a declared ETA before 'no_arrival' is raised.
export const ARRIVAL_GRACE_MINUTES = envMinutes("SAFETY_ARRIVAL_GRACE_MINUTES", 20);

// How long the trusted-contact tracking link stays live after a session ends.
export const TRACK_LINK_GRACE_MINUTES = 120;

// The SOS is armed by holding, then runs a countdown that must be actively
// cancelled — so a snatched phone cannot silently stop an alert already begun.
export const SOS_HOLD_MS = 800;
export const SOS_COUNTDOWN_SECONDS = 10;

// Server-side floor between stored breadcrumbs, so a chatty or hostile client
// cannot flood location_pings.
export const LOCATION_PING_MIN_SECONDS = 20;

// Anti-abuse limits for safety endpoints. Generous for real use, tight enough
// that a stolen session cannot brute-force a PIN or flood the safety desk.
export const PIN_ATTEMPTS_PER_MINUTE = 3;
// Consecutive wrong PINs at the door before staff are alerted and the booking
// is locked out of PIN entry for the cooloff.
export const PIN_FAILURES_BEFORE_ALERT = 5;
export const PIN_LOCKOUT_MINUTES = 15;
export const SOS_PER_HOUR = 5;
export const HEARTBEAT_PER_MINUTE = 6;
export const CHECKIN_RESPONSES_PER_MINUTE = 10;
export const PUSH_SUBSCRIBES_PER_HOUR = 10;
// Global cap across ALL tracking-page views (the limiter cannot be keyed per
// token — an attacker's whole method is a fresh token per request). It exists
// purely as a DB-abuse backstop; guessing a 32-byte token is infeasible. Sized
// so a busy night of legitimate contacts (each page polls twice a minute)
// cannot starve a real contact into a 404 mid-crisis.
export const TRACK_VIEWS_PER_MINUTE = 240;
export const TRUSTED_CONTACTS_PER_DAY = 10;
export const MAX_TRUSTED_CONTACTS = 3;

// The escalation ladder. Stage 0 fires the moment an alert is raised; each
// later stage fires `afterMinutes` after the alert unless someone
// acknowledges first. Acknowledging parks the ladder — resolving closes it.
//
// The ladder has two shapes, because a paging system that pages an empty room
// is worse than none (it looks like cover while being none):
//
// UNSTAFFED (default — no hired safety desk): the worker's own trusted
// contacts are the first responders, the owner/admins are paged in the same
// breath, and any staff accounts that do exist are swept in as a late rung.
//
// STAFFED (SAFETY_STAFFED_DESK=on, once real monitors are rostered): on-duty
// monitors first, whole desk next, contacts and admins after — trained staff
// take point and families are only pulled in when staff cannot resolve it.
//
// SAFETY_LADDER_SCALE compresses every rung by the same factor for demos and
// tests (0.1 turns 3/7/11 minutes into ~18/42/66 seconds). Production leaves
// it at 1.
const LADDER_SCALE =
  Number(process.env.SAFETY_LADDER_SCALE) > 0
    ? Number(process.env.SAFETY_LADDER_SCALE)
    : 1;

export type EscalationAudience =
  | "on_duty"
  | "all_desk"
  | "trusted_contacts"
  | "admins";

export type EscalationRung = {
  afterMinutes: number;
  audience: EscalationAudience;
  label: string;
};

export function staffedSafetyDesk(): boolean {
  return process.env.SAFETY_STAFFED_DESK === "on";
}

const STAFFED_LADDER: EscalationRung[] = [
  {
    afterMinutes: 0,
    audience: "on_duty",
    label: "On-duty safety monitors paged",
  },
  {
    afterMinutes: 3 * LADDER_SCALE,
    audience: "all_desk",
    label: "All desk support + supervisors paged",
  },
  {
    afterMinutes: 7 * LADDER_SCALE,
    audience: "trusted_contacts",
    label: "Worker's trusted contacts notified",
  },
  {
    afterMinutes: 11 * LADDER_SCALE,
    audience: "admins",
    label: "Admins paged; driver dispatch and breadcrumbs surfaced",
  },
];

const UNSTAFFED_LADDER: EscalationRung[] = [
  {
    afterMinutes: 0,
    audience: "trusted_contacts",
    label: "Worker's trusted contacts notified",
  },
  {
    // Fires on the next scheduler tick (~30s) — covert alerts skip the
    // contacts rung entirely, so this is also their first real page.
    afterMinutes: 0,
    audience: "admins",
    label: "Platform owner paged",
  },
  {
    afterMinutes: 10 * LADDER_SCALE,
    audience: "all_desk",
    label: "Every staff account paged",
  },
];

export function escalationLadder(): EscalationRung[] {
  return staffedSafetyDesk() ? STAFFED_LADDER : UNSTAFFED_LADDER;
}

// SMS and voice stages stay dark until a provider is configured — a channel
// that silently fails is worse than one that is honestly absent.
export function smsEnabled(): boolean {
  return Boolean(process.env.SMS_PROVIDER_URL && process.env.SMS_PROVIDER_TOKEN);
}

export function pushEnabled(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
  );
}

// Human label for an alert kind — shared by the booking room, the desk board
// and every notification, so one incident is never described two ways.
export const SAFETY_ALERT_LABELS: Record<string, string> = {
  sos: "Emergency SOS",
  wellness_help: "Worker requested help",
  other: "Safety alert",
  missed_checkin: "Missed check-in",
  unresponsive: "Unresponsive — heartbeat lost",
  overrun: "Session overrun",
  no_arrival: "Never arrived",
  get_home_overdue: "No get-home-safe confirmation",
  duress: "DURESS PIN USED",
  pin_failures: "Repeated wrong PINs at the door",
};

export function safetyAlertLabel(kind: string): string {
  return SAFETY_ALERT_LABELS[kind] ?? "Safety alert";
}

// "Overdue-shaped" alerts: the worker was expected to do something by a certain
// time and didn't. These are the ones a worker's own trusted contacts can ask
// to hear about IMMEDIATELY, rather than waiting for the staff ladder to reach
// them — the "if I'm late checking in, tell my people" option.
//
// The other kinds (sos, duress, wellness_help, pin_failures) are live
// emergencies handled by staff first; contacts hear about those through the
// ladder's trusted_contacts rung, and never at all when the alert is covert.
export const OVERDUE_ALERT_KINDS = [
  "missed_checkin",
  "unresponsive",
  "no_arrival",
  "overrun",
  "get_home_overdue",
] as const;

export function isOverdueAlertKind(kind: string): boolean {
  return (OVERDUE_ALERT_KINDS as readonly string[]).includes(kind);
}

// Chat rules: each text message is capped, and each room keeps at most
// CHAT_ROOM_MESSAGE_CAP messages. Pruning runs in batches — once a room
// overflows by CHAT_PRUNE_BATCH, the oldest overflow is deleted — so new
// messages replace old ones ~10 at a time instead of on every send.
export const CHAT_MESSAGE_MAX_CHARS = 1000;
export const CHAT_ROOM_MESSAGE_CAP = 1000;
export const CHAT_PRUNE_BATCH = 10;

// Anti-abuse rate limits (lib/rate-limit.ts). Generous for real users, tight
// enough to stop floods: sends per minute per room, image uploads per hour,
// and brand-new conversations per day.
export const CHAT_SEND_PER_MINUTE = 25;
export const CHAT_IMAGES_PER_HOUR = 20;
export const CHAT_NEW_ROOMS_PER_DAY = 15;

// Where would-be workers apply — worker signup itself is invite-only.
export const WORKER_CONTACT_EMAIL = "general@cheersja.com";

// ID documents accepted for customer identity verification.
export const ID_DOCUMENT_TYPES = [
  { value: "drivers_license", label: "Driver's licence" },
  { value: "passport", label: "Passport" },
  { value: "national_id", label: "National ID card" },
] as const;

export function idDocumentLabel(value: string): string {
  return ID_DOCUMENT_TYPES.find((t) => t.value === value)?.label ?? value;
}

// Today's date in Jamaica (UTC-5, no DST). new Date().toISOString() is UTC,
// which runs a day ahead of Jamaica every evening — never use it for "today".
export function jamaicaTodayISO(): string {
  return new Date(Date.now() - 5 * 3_600_000).toISOString().slice(0, 10);
}

export function platformFeeCents(priceCents: number): number {
  return Math.round((priceCents * PLATFORM_FEE_PERCENT) / 100);
}

// Negative amounts render as "-$5.00" (worker owes platform — cash weeks).
export function formatCents(cents: number): string {
  return `${cents < 0 ? "-" : ""}$${(Math.abs(cents) / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatStars(avgRatingX100: number): string {
  return (avgRatingX100 / 100).toFixed(1);
}

// "18:30" (or "18:30:00") → "6:30 PM". Customers think in 12-hour time.
export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
