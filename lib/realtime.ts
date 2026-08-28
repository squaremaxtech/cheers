import type {
  BookingStreamEvent,
  ChatStreamEvent,
  DriverBoardStreamEvent,
  InboxStreamEvent,
  JobBoardStreamEvent,
  JobRequestStreamEvent,
  RideStreamEvent,
  SafetyDeskStreamEvent,
} from "@/types";

// In-memory pub/sub for the live booking room, chat rooms and rides. The app
// runs as a single process (pm2 fork mode, instances: 1) so an in-process bus
// is sufficient; swap for Redis pub/sub if the app ever scales horizontally.

type Listener = (event: BookingStreamEvent) => void;
type ChatListener = (event: ChatStreamEvent) => void;
type InboxListener = (event: InboxStreamEvent) => void;
type SafetyDeskListener = (event: SafetyDeskStreamEvent) => void;
type RideListener = (event: RideStreamEvent) => void;
type DriverBoardListener = (event: DriverBoardStreamEvent) => void;
// The second argument is the premium rail of the request that changed —
// the stream route drops premium wake-ups for non-provider workers, so a
// premium request leaves no trace (not even a timing one) on a standard
// board. It never reaches the client.
type JobBoardListener = (
  event: JobBoardStreamEvent,
  premium: boolean
) => void;
type JobRequestListener = (event: JobRequestStreamEvent) => void;

// Stored on globalThis so dev-server hot reloads reuse one registry instead
// of stranding subscribers in an old module copy. The cast is unavoidable —
// globalThis has no typed slot for app state (same interop escape hatch as
// Readable.toWeb in the media route).
const globalStore = globalThis as unknown as {
  __bookingChannels?: Map<string, Set<Listener>>;
  __chatChannels?: Map<string, Set<ChatListener>>;
  __inboxChannels?: Map<string, Set<InboxListener>>;
  __safetyDeskListeners?: Set<SafetyDeskListener>;
  __rideChannels?: Map<string, Set<RideListener>>;
  __driverBoardListeners?: Set<DriverBoardListener>;
  __jobBoardListeners?: Set<JobBoardListener>;
  __jobRequestChannels?: Map<string, Set<JobRequestListener>>;
};
const channels = (globalStore.__bookingChannels ??= new Map<
  string,
  Set<Listener>
>());
const chatChannels = (globalStore.__chatChannels ??= new Map<
  string,
  Set<ChatListener>
>());
const inboxChannels = (globalStore.__inboxChannels ??= new Map<
  string,
  Set<InboxListener>
>());
const rideChannels = (globalStore.__rideChannels ??= new Map<
  string,
  Set<RideListener>
>());

export function subscribeBooking(
  bookingId: string,
  listener: Listener
): () => void {
  let set = channels.get(bookingId);
  if (!set) {
    set = new Set();
    channels.set(bookingId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) channels.delete(bookingId);
  };
}

// Fire-and-forget: a dead listener must never break the mutation that
// published the event.
export function publishBooking(
  bookingId: string,
  event: BookingStreamEvent
): void {
  const set = channels.get(bookingId);
  if (!set) return;
  for (const listener of [...set]) {
    try {
      listener(event);
    } catch {
      set.delete(listener);
    }
  }
}

export function bookingEventNow(
  kind: Exclude<BookingStreamEvent["kind"], "location">
): BookingStreamEvent {
  return { kind, at: new Date().toISOString() };
}

// --- Chat rooms (same bus pattern, separate channel space) -------------------

export function subscribeChat(
  roomId: string,
  listener: ChatListener
): () => void {
  let set = chatChannels.get(roomId);
  if (!set) {
    set = new Set();
    chatChannels.set(roomId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) chatChannels.delete(roomId);
  };
}

export function publishChat(roomId: string, event: ChatStreamEvent): void {
  const set = chatChannels.get(roomId);
  if (!set) return;
  for (const listener of [...set]) {
    try {
      listener(event);
    } catch {
      set.delete(listener);
    }
  }
}

// --- Per-user chat inbox (live unread badges on /chats) ----------------------

export function subscribeInbox(
  userId: string,
  listener: InboxListener
): () => void {
  let set = inboxChannels.get(userId);
  if (!set) {
    set = new Set();
    inboxChannels.set(userId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) inboxChannels.delete(userId);
  };
}

export function publishInbox(userId: string): void {
  const set = inboxChannels.get(userId);
  if (!set) return;
  const event: InboxStreamEvent = { kind: "inbox", at: new Date().toISOString() };
  for (const listener of [...set]) {
    try {
      listener(event);
    } catch {
      set.delete(listener);
    }
  }
}

// --- Safety desk (one global channel, not per-entity) ------------------------
// The desk watches every live session at once, so there is a single broadcast
// channel rather than one per booking: any safety state change re-reads the
// whole board. Volume is low (a handful of events per session) and correctness
// beats granularity when someone may be in danger.

const safetyDeskListeners = (globalStore.__safetyDeskListeners ??=
  new Set<SafetyDeskListener>());

export function subscribeSafetyDesk(listener: SafetyDeskListener): () => void {
  safetyDeskListeners.add(listener);
  return () => {
    safetyDeskListeners.delete(listener);
  };
}

export function publishSafetyDesk(): void {
  const event: SafetyDeskStreamEvent = {
    kind: "safety",
    at: new Date().toISOString(),
  };
  for (const listener of [...safetyDeskListeners]) {
    try {
      listener(event);
    } catch {
      safetyDeskListeners.delete(listener);
    }
  }
}

// --- Rides (same per-entity bus pattern as bookings) --------------------------

export function subscribeRide(rideId: string, listener: RideListener): () => void {
  let set = rideChannels.get(rideId);
  if (!set) {
    set = new Set();
    rideChannels.set(rideId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) rideChannels.delete(rideId);
  };
}

export function publishRide(rideId: string, event: RideStreamEvent): void {
  const set = rideChannels.get(rideId);
  if (!set) return;
  for (const listener of [...set]) {
    try {
      listener(event);
    } catch {
      set.delete(listener);
    }
  }
}

export function rideEventNow(
  kind: Exclude<RideStreamEvent["kind"], "location">
): RideStreamEvent {
  return { kind, at: new Date().toISOString() };
}

// --- Driver request board (one global channel, like the safety desk) ----------
// Every online driver watches the same pool of open requests; any change
// re-reads the board. Low volume, and drivers filter client-side by parish.

const driverBoardListeners = (globalStore.__driverBoardListeners ??=
  new Set<DriverBoardListener>());

export function subscribeDriverBoard(
  listener: DriverBoardListener
): () => void {
  driverBoardListeners.add(listener);
  return () => {
    driverBoardListeners.delete(listener);
  };
}

export function publishDriverBoard(): void {
  const event: DriverBoardStreamEvent = {
    kind: "requests",
    at: new Date().toISOString(),
  };
  for (const listener of [...driverBoardListeners]) {
    try {
      listener(event);
    } catch {
      driverBoardListeners.delete(listener);
    }
  }
}

// --- Worker job board (global channel, like the driver board) -----------------
// Every worker with the board open watches the same pool of open requests;
// any change re-reads it. Workers filter by category/parish client-side.

const jobBoardListeners = (globalStore.__jobBoardListeners ??=
  new Set<JobBoardListener>());

export function subscribeJobBoard(listener: JobBoardListener): () => void {
  jobBoardListeners.add(listener);
  return () => {
    jobBoardListeners.delete(listener);
  };
}

// premium = the request that changed is on the premium rail; only premium
// providers are woken for it (see app/api/jobs/board/stream/route.ts).
export function publishJobBoard(premium = false): void {
  const event: JobBoardStreamEvent = { kind: "jobs", at: new Date().toISOString() };
  for (const listener of [...jobBoardListeners]) {
    try {
      listener(event, premium);
    } catch {
      jobBoardListeners.delete(listener);
    }
  }
}

// --- Per-request channel (the customer's request room) -----------------------

const jobRequestChannels = (globalStore.__jobRequestChannels ??= new Map<
  string,
  Set<JobRequestListener>
>());

export function subscribeJobRequest(
  jobRequestId: string,
  listener: JobRequestListener
): () => void {
  let set = jobRequestChannels.get(jobRequestId);
  if (!set) {
    set = new Set();
    jobRequestChannels.set(jobRequestId, set);
  }
  set.add(listener);
  return () => {
    set.delete(listener);
    if (set.size === 0) jobRequestChannels.delete(jobRequestId);
  };
}

export function publishJobRequest(
  jobRequestId: string,
  kind: JobRequestStreamEvent["kind"]
): void {
  const set = jobRequestChannels.get(jobRequestId);
  if (!set) return;
  const event: JobRequestStreamEvent = { kind, at: new Date().toISOString() };
  for (const listener of [...set]) {
    try {
      listener(event);
    } catch {
      set.delete(listener);
    }
  }
}
