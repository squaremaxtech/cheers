"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { createWorkerInvite, deleteWorkerInvite } from "@/actions/admin";
import Badge from "@/components/ui/Badge";

export type WorkerInviteItem = {
  id: string;
  code: string;
  note: string | null;
  status: "active" | "used" | "expired";
  usedByLabel: string | null;
  expiresAt: string;
};

// Worker signup is invite-only: generate a single-use code here and share
// the onboarding link privately with a vetted candidate.
export default function WorkerInvites({
  invites,
}: {
  invites: WorkerInviteItem[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  function inviteLink(code: string): string {
    return `${window.location.origin}/worker/onboarding?invite=${code}`;
  }

  async function generate() {
    setBusy(true);
    const res = await createWorkerInvite({ note });
    setBusy(false);
    if (res.ok) {
      setNote("");
      try {
        await navigator.clipboard.writeText(inviteLink(res.data.code));
        toast.success(`Invite ${res.data.code} created — link copied`);
      } catch {
        toast.success(`Invite ${res.data.code} created`);
      }
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function copy(code: string) {
    try {
      await navigator.clipboard.writeText(inviteLink(code));
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy — copy the code manually.");
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this unused invite?")) return;
    const res = await deleteWorkerInvite(id);
    if (res.ok) router.refresh();
    else toast.error(res.error);
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
        Worker invites
      </h2>
      <p className="mt-1 text-xs leading-5 text-faint">
        Signup is invite-only. Generate a single-use link (valid 30 days) and
        share it privately with a vetted candidate — their profile still needs
        your approval after they sign up.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1">
          <label className="label" htmlFor="wi-note">
            For (your reference)
          </label>
          <input
            id="wi-note"
            className="input py-1.5"
            placeholder="e.g. Alicia — referred by Maxx"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="btn-gold py-2 text-xs"
          disabled={busy}
          onClick={generate}
        >
          {busy ? "Generating…" : "Generate invite link"}
        </button>
      </div>

      {invites.length > 0 && (
        <ul className="mt-4 divide-y divide-hairline text-sm">
          {invites.map((invite) => (
            <li
              key={invite.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2.5"
            >
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-ink">{invite.code}</span>
                {invite.note && (
                  <span className="text-faint">{invite.note}</span>
                )}
                <Badge
                  tone={
                    invite.status === "used"
                      ? "success"
                      : invite.status === "expired"
                        ? "danger"
                        : "gold"
                  }
                >
                  {invite.status === "used"
                    ? `Used${invite.usedByLabel ? ` — ${invite.usedByLabel}` : ""}`
                    : invite.status === "expired"
                      ? "Expired"
                      : `Active until ${invite.expiresAt}`}
                </Badge>
              </span>
              <span className="flex gap-2">
                {invite.status === "active" && (
                  <>
                    <button
                      type="button"
                      className="btn-ghost py-1 text-xs"
                      onClick={() => copy(invite.code)}
                    >
                      Copy link
                    </button>
                    <button
                      type="button"
                      className="btn-ghost py-1 text-xs text-danger"
                      onClick={() => remove(invite.id)}
                    >
                      Delete
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
