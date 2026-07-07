"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { openChatRoom } from "@/actions/chats";

// "Message <worker>" on the public profile: opens (or creates) the viewer's
// chat room with this worker and jumps into it.
export default function ChatButton({
  workerId,
  stageName,
  signedIn,
}: {
  workerId: string;
  stageName: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    setBusy(true);
    const res = await openChatRoom({ workerId });
    setBusy(false);
    if (res.ok) router.push(`/chats/${res.data.roomId}`);
    else toast.error(res.error);
  }

  return (
    <button
      type="button"
      className="btn-outline mt-3 w-full"
      disabled={busy}
      onClick={handleClick}
    >
      {busy ? "Opening…" : `💬 Message ${stageName}`}
    </button>
  );
}
