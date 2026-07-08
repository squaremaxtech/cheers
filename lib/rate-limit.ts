// In-memory sliding-window rate limiter. Single pm2 fork (like the SSE bus
// in lib/realtime.ts) so in-process state is authoritative; counters reset
// on deploy, which is acceptable slack for anti-abuse limits.

const globalStore = globalThis as unknown as {
  __rateBuckets?: Map<string, number[]>;
  __rateLastSweep?: number;
};
const buckets = (globalStore.__rateBuckets ??= new Map<string, number[]>());

// Longest window any caller uses (new-rooms-per-day) — entries idle past it
// are dead for every limit and safe to drop.
const SWEEP_INTERVAL_MS = 10 * 60_000;
const MAX_WINDOW_MS = 24 * 3_600_000;

// The map would otherwise grow one key per user (and per user×room for chat
// sends) forever; a periodic opportunistic sweep keeps it flat.
function sweep(now: number): void {
  if (now - (globalStore.__rateLastSweep ?? 0) < SWEEP_INTERVAL_MS) return;
  globalStore.__rateLastSweep = now;
  for (const [key, timestamps] of buckets) {
    const newest = timestamps[timestamps.length - 1];
    if (newest === undefined || now - newest > MAX_WINDOW_MS) {
      buckets.delete(key);
    }
  }
}

// True = allowed (and the attempt is recorded). False = over the limit.
export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): boolean {
  const now = Date.now();
  sweep(now);
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}
