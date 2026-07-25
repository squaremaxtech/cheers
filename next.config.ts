import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Baseline hardening on every response.
        source: "/(.*)",
        headers: [
          // Stop the browser guessing content types on uploaded media.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No framing: the booking room holds one-tap safety controls, so
          // clickjacking them into an invisible iframe must be impossible.
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Geolocation and wake lock are needed by the safety screen; nothing
          // needs the camera, mic, or payment APIs.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), payment=(), geolocation=(self)",
          },
        ],
      },
      {
        // The tracking token IS the credential, and it sits in the URL. Any
        // outbound click from these pages must not carry it in a Referer
        // header (the links also set rel="noreferrer" — this is the backstop),
        // and nothing here may be cached by a shared proxy.
        source: "/track/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Cache-Control", value: "no-store, max-age=0" },
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
      {
        // The service worker must never be served stale: it is the delivery
        // path for safety notifications, and a cached old copy would keep
        // handling pushes with outdated logic.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
