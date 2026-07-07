import type { BookingStreamEvent } from "@/types";

// In-memory pub/sub for the live booking room. The app runs as a single
// process (pm2 fork mode, instances: 1) so an in-process bus is sufficient;
// swap for Redis pub/sub if the app ever scales horizontally.

type Listener = (event: BookingStreamEvent) => void;

// Stored on globalThis so dev-server hot reloads reuse one registry instead
// of stranding subscribers in an old module copy. The cast is unavoidable —
// globalThis has no typed slot for app state (same interop escape hatch as
// Readable.toWeb in the media route).
const globalStore = globalThis as unknown as {
  __bookingChannels?: Map<string, Set<Listener>>;
};
const channels = (globalStore.__bookingChannels ??= new Map<
  string,
  Set<Listener>
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
