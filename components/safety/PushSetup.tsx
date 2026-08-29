"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { subscribeToPush, unsubscribeFromPush } from "@/actions/safety";

// VAPID public keys are base64url; PushManager wants raw bytes. Backed by an
// explicit ArrayBuffer so the result satisfies BufferSource (a plain
// Uint8Array may be backed by a SharedArrayBuffer, which it does not).
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

type State = "checking" | "unsupported" | "off" | "on" | "denied";

// Turning on push is the single most important thing a worker can do for
// their own safety: it is the only channel that reaches them once the browser
// is closed, and on iOS it works only after installing to the home screen.
// Both facts are stated plainly rather than buried in a settings toggle.
export default function PushSetup({ vapidKey }: { vapidKey: string | null }) {
  // Browser capabilities are read in lazy initialisers rather than an effect.
  // They are constant for the life of the page, and both branches render
  // nothing until the subscription lookup resolves, so there is no hydration
  // mismatch to worry about.
  const [state, setState] = useState<State>(() => {
    if (typeof window === "undefined") return "checking";
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return "unsupported";
    }
    if (Notification.permission === "denied") return "denied";
    return "checking";
  });
  const [busy, setBusy] = useState(false);
  const [isIOS] = useState(
    () =>
      typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent)
  );
  const [standalone] = useState(
    () =>
      typeof window !== "undefined" &&
      (window.matchMedia("(display-mode: standalone)").matches ||
        // iOS reports installed apps through a non-standard flag.
        (navigator as Navigator & { standalone?: boolean }).standalone === true)
  );

  useEffect(() => {
    if (state !== "checking") return;
    let cancelled = false;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        if (!cancelled) setState(sub ? "on" : "off");
      })
      .catch(() => {
        if (!cancelled) setState("unsupported");
      });
    return () => {
      cancelled = true;
    };
    // Runs once: `state` is only read to skip when capabilities already
    // decided the outcome.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enable = useCallback(async () => {
    if (!vapidKey) {
      toast.error("Push isn't configured on this server yet.");
      return;
    }
    setBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        // Required by Chrome: every push must show something to the user.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      const json = sub.toJSON() as {
        endpoint?: string;
        keys?: { p256dh?: string; auth?: string };
      };
      const res = await subscribeToPush({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      });
      if (res.ok) {
        setState("on");
        toast.success("Safety alerts on — you'll be reached even if the app is closed.");
      } else {
        await sub.unsubscribe().catch(() => undefined);
        toast.error(res.error);
      }
    } catch {
      toast.error("Couldn't turn on notifications.");
    } finally {
      setBusy(false);
    }
  }, [vapidKey]);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await unsubscribeFromPush({ endpoint: sub.endpoint });
        await sub.unsubscribe();
      }
      setState("off");
      toast("Safety alerts off");
    } catch {
      toast.error("Couldn't turn off notifications.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (state === "checking") return null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink">
            Safety alerts
            <span
              className={`ml-3 inline-flex items-center gap-1.5 text-xs ${state === "on" ? "text-success" : "text-warn"}`}
            >
              <span
                className={`h-2 w-2 rounded-full ${state === "on" ? "bg-success" : "bg-warn"}`}
              />
              {state === "on" ? "On" : "Off"}
            </span>
          </p>
          <p className="mt-1 text-xs text-muted">
            Check-in reminders and emergency alerts reach you even when the app
            is closed — and you can answer a check-in with one tap, straight
            from the notification.
          </p>
        </div>
        {state === "on" ? (
          <button type="button" className="btn-outline" disabled={busy} onClick={disable}>
            Turn off
          </button>
        ) : (
          state !== "unsupported" &&
          state !== "denied" && (
            <button type="button" className="btn-primary" disabled={busy} onClick={enable}>
              Turn on alerts
            </button>
          )
        )}
      </div>

      {state === "denied" && (
        <p className="rounded-xl border border-warn/40 bg-warn/5 p-3 text-xs text-warn">
          Notifications are blocked for this site in your browser settings.
          You&apos;ll need to allow them there before safety alerts can reach you.
        </p>
      )}

      {isIOS && !standalone && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-3 text-xs text-muted">
          <p className="font-medium text-gold-deep">Install CheersJA first</p>
          <p className="mt-1">
            On iPhone, notifications only work once CheersJA is on your home
            screen. Tap the Share button, then{" "}
            <strong className="text-ink">Add to Home Screen</strong>, and open
            CheersJA from there.
          </p>
        </div>
      )}

      {state === "unsupported" && (
        <p className="text-xs text-faint">
          This browser can&apos;t receive push notifications. Keep the booking
          screen open during a visit so monitoring stays active.
        </p>
      )}
    </div>
  );
}
