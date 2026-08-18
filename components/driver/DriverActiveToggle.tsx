"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { setDriverActive } from "@/actions/drivers";

// The driver's own availability switch. Off = hidden from the public
// directory and no new requests; existing matched rides are unaffected.
export default function DriverActiveToggle({ active }: { active: boolean }) {
  const router = useRouter();
  const [working, setWorking] = useState(false);

  async function toggle() {
    setWorking(true);
    const res = await setDriverActive(!active);
    setWorking(false);
    if (res.ok) {
      toast.success(active ? "You're offline" : "You're online — requests will appear on your board");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 rounded-full ${active ? "bg-success" : "bg-hairline"}`}
        />
        <p className="text-sm text-ink">
          {active ? "Taking rides" : "Offline"}
        </p>
      </div>
      <button
        type="button"
        className={active ? "btn-outline" : "btn-gold"}
        disabled={working}
        onClick={toggle}
      >
        {working ? "Switching…" : active ? "Go offline" : "Go online"}
      </button>
    </div>
  );
}
