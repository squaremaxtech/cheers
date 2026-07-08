import type {
  BookingStreamEvent,
  ChatStreamEvent,
  InboxStreamEvent,
} from "@/types";

// In-memory pub/sub for the live booking room and chat rooms. The app runs
// as a single process (pm2 fork mode, instances: 1) so an in-process bus is
// sufficient; swap for Redis pub/sub if the app ever scales horizontally.

type Listener = (event: BookingStreamEvent) => void;
type ChatListener = (event: ChatStreamEvent) => void;
type InboxListener = (event: InboxStreamEvent) => void;

// Stored on globalThis so dev-server hot reloads reuse one registry instead
// of stranding subscribers in an old module copy. The cast is unavoidable —
// globalThis has no typed slot for app state (same interop escape hatch as
// Readable.toWeb in the media route).
const globalStore = globalThis as unknown as {
  __bookingChannels?: Map<string, Set<Listener>>;
  __chatChannels?: Map<string, Set<ChatListener>>;
  __inboxChannels?: Map<string, Set<InboxListener>>;
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
