"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { setCancelPin } from "@/actions/safety";

export default function SafetySettings({ hasCancelPin }: { hasCancelPin: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [editing, setEditing] = useState(!hasCancelPin);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (pin !== confirm) {
      toast.error("The codes don't match.");
      return;
    }
    setBusy(true);
    const res = await setCancelPin({ cancelPin: pin });
    setBusy(false);
    if (res.ok) {
      toast.success("Cancel code saved");
      setPin("");
      setConfirm("");
      setEditing(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  if (!editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-success">✓ Cancel code set</p>
        <button type="button" className="btn-outline" onClick={() => setEditing(true)}>
          Change it
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="c-pin">
            4-digit code
          </label>
          <input
            id="c-pin"
            className="input tracking-[0.3em]"
            inputMode="numeric"
            maxLength={4}
            placeholder="0000"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="c-pin2">
            Confirm
          </label>
          <input
            id="c-pin2"
            className="input tracking-[0.3em]"
            inputMode="numeric"
            maxLength={4}
            placeholder="0000"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
            required
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary" disabled={busy || pin.length !== 4}>
          Save code
        </button>
        {hasCancelPin && (
          <button type="button" className="btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
      <p className="text-xs text-faint">
        Pick something you&apos;ll remember under pressure — but not your
        birthday or a booking PIN. Without a code you can still stop an alert by
        holding the cancel button for 3 seconds.
      </p>
    </form>
  );
}
