module.exports = {
  apps: [
    {
      name: "cheers",
      // Run the Next binary directly (not via npm) so pm2 supervises the real
      // server process — memory stats, max_memory_restart, and signals work.
      script: "node_modules/next/dist/bin/next",
      args: "start --port 3010",
      cwd: __dirname,
      exec_mode: "fork",        // cluster is fine for Next, but 1 fork suits a small VPS
      // MUST stay 1: the in-process realtime bus (lib/realtime.ts) and rate
      // limiter are per-process, and the safety scheduler assumes one clock.
      // (The scheduler also takes a pg advisory lock per tick, so a stray
      // second process degrades to a no-op rather than double-paging.)
      instances: 1,
      autorestart: true,
      max_memory_restart: "1G", // restart on leak; sized for a 2GB VPS
      restart_delay: 5000,      // 5s backoff so a crash-loop doesn't spin the CPU
      max_restarts: 10,         // give up after 10 rapid crashes (pm2 resets on stability)
      time: true,               // timestamp every log line
      env: { NODE_ENV: "production" },
    },
  ],
};