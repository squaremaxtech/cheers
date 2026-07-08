// In-memory presence: who is on the platform right now. Two signals —
// open SSE streams (exact: chat rooms + chat inbox register connections)
// and a recent-activity window (any authenticated request touches it via
// getUserRow). Single pm2 fork, same in-process pattern as lib/realtime.ts.
// Used to skip chat email notifications for online users and to show the
// "Online" dot (workers can hide theirs via workers.showOnlineStatus).

// Exported so presence consumers (chat stream) can schedule a re-check for
// when a just-disconnected user's activity window lapses.
export const PRESENCE_ONLINE_WINDOW_MS = 3 * 60_000;

const globalStore = globalThis as unknown as {
  __presenceLastSeen?: Map<string, number>;
  __presenceStreams?: Map<string, number>;
};
const lastSeen = (globalStore.__presenceLastSeen ??= new Map<string, number>());
const streams = (globalStore.__presenceStreams ??= new Map<string, number>());

export function touchPresence(userId: string): void {
  lastSeen.set(userId, Date.now());
}

export function presenceConnect(userId: string): void {
  streams.set(userId, (streams.get(userId) ?? 0) + 1);
  touchPresence(userId);
}

export function presenceDisconnect(userId: string): void {
  const n = (streams.get(userId) ?? 1) - 1;
  if (n <= 0) streams.delete(userId);
  else streams.set(userId, n);
  touchPresence(userId);
}

export function isOnline(userId: string): boolean {
  if ((streams.get(userId) ?? 0) > 0) return true;
  const seen = lastSeen.get(userId);
  return seen !== undefined && Date.now() - seen < PRESENCE_ONLINE_WINDOW_MS;
}
