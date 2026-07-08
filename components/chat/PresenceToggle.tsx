"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { setChatPresenceVisibility } from "@/actions/chats";

// Worker-only switch on the chat inbox: show or hide their "Online" dot
// from customers.
export default function PresenceToggle({ show }: { show: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
      <input
        type="checkbox"
        checked={show}
        disabled={busy}
        onChange={async (e) => {
          setBusy(true);
          const res = await setChatPresenceVisibility({
            show: e.target.checked,
          });
          setBusy(false);
          if (res.ok) router.refresh();
          else toast.error(res.error);
        }}
        className="h-4 w-4 accent-[var(--color-gold)]"
      />
      Show customers when I&apos;m online
    </label>
  );
}
