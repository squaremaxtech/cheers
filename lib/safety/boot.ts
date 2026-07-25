import { startSafetyScheduler } from "@/lib/safety/scheduler";

// Thin, failure-tolerant wrapper around the scheduler start-up.
//
// `register()` in instrumentation.ts must complete before the server accepts
// requests, so anything that throws here would take the whole site down. A
// site that is up with a broken clock is recoverable; a site that will not
// boot is not — so this logs loudly and lets the server come up either way.
//
// Opt out with SAFETY_SCHEDULER=off (useful when running a one-off script or
// a second instance that must not drive escalations).
export function startSafetySchedulerSafely(): void {
  if (process.env.SAFETY_SCHEDULER === "off") {
    console.warn("[safety] scheduler disabled by SAFETY_SCHEDULER=off");
    return;
  }
  try {
    startSafetyScheduler();
  } catch (error) {
    console.error(
      "[safety] scheduler failed to start — TIME-BASED ESCALATION IS OFF:",
      error instanceof Error ? error.message : error
    );
  }
}
