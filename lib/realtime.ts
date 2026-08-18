import type {
  BookingStreamEvent,
  ChatStreamEvent,
  DriverBoardStreamEvent,
  InboxStreamEvent,
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
