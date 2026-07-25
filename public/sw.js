// Cheers service worker — safety notifications only.
//
// This deliberately does NOT cache pages or assets. An offline-cached copy of
// a safety screen showing stale "you're monitored" state would be actively
// dangerous, and every safety read must hit the server. The only jobs here
// are: show push notifications, and let a worker answer a check-in in ONE TAP
// without unlocking, navigating, or waiting for the app to boot.

self.addEventListener("install", (event) => {
  // Take over immediately: a worker who just installed must be reachable now,
  // not after they close every other tab.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }

  // Check-in notifications carry inline actions — this is the fast path that
  // makes answering possible from a locked screen.
  const actions = data.checkin
    ? [
        { action: "checkin-ok", title: "✓ I'm OK" },
        { action: "checkin-help", title: "I need help" },
      ]
    : [];

  const options = {
    body: data.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    // A distinctive double-buzz for safety prompts.
    vibrate: data.urgent ? [200, 80, 200, 80, 200] : [100, 50, 100],
    // Urgent prompts stay on screen until acted on rather than auto-dismissing.
    requireInteraction: Boolean(data.urgent),
    // Same tag replaces an earlier notification instead of stacking a wall of
    // them: the worker should see one live prompt, not a history of them.
    tag: data.tag,
    renotify: Boolean(data.tag),
    actions,
    data: {
      url: data.url || "/",
      checkin: data.checkin || null,
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  const { action, notification } = event;
  const data = notification.data || {};
  notification.close();

  // One-tap check-in. Cookies ride along with credentials: "include", so the
  // normal session authenticates this and every server-side guard still runs —
  // the booking id in a push payload is treated as untrusted client input.
  if (action === "checkin-ok" || action === "checkin-help") {
    if (!data.checkin || !data.checkin.bookingId) return;
    event.waitUntil(
      fetch("/api/safety/checkin", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bookingId: data.checkin.bookingId,
          status: action === "checkin-ok" ? "ok" : "help",
          method: "push_action",
        }),
      })
        .then((res) => {
          if (res.ok) {
            return self.registration.showNotification(
              action === "checkin-ok" ? "Check-in recorded" : "Help is coming",
              {
                body:
                  action === "checkin-ok"
                    ? "Thanks — stay safe."
                    : "Our safety team has been alerted.",
                icon: "/icon-192.png",
                tag: data.checkin.bookingId + "-ack",
              }
            );
          }
          // The tap failed (offline, expired session). Say so plainly and send
          // them into the app rather than letting them believe they answered.
          return openApp(data.url);
        })
        .catch(() => openApp(data.url))
    );
    return;
  }

  event.waitUntil(openApp(data.url));
});

// Focus an existing window if one is open, otherwise open a new one.
function openApp(url) {
  const target = url || "/";
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) {
            return client.navigate(target).then((c) => (c ? c.focus() : null));
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    });
}
