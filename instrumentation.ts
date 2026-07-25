// Server startup hook (Next.js `instrumentation.ts` convention): `register`
// runs exactly once per server instance, before the first request is served.
//
// This is where the safety clock is booted. Everything time-based in the
// safety system — overdue check-ins, lost heartbeats, session overruns, the
// escalation ladder — is driven by that ticker. Without it the platform can
// only react to buttons a worker in trouble may be unable to press.
export async function register(): Promise<void> {
  // The scheduler is Node-only: it holds a pg connection and an interval,
  // neither of which exist in the edge runtime.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Build-time prerendering also calls register(); starting a ticker there
  // would fire escalations from a build machine.
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { startSafetySchedulerSafely } = await import("./lib/safety/boot");
  startSafetySchedulerSafely();
}
