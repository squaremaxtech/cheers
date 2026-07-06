"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { toggleFavorite } from "@/actions/favorites";

export default function FavoriteButton({
  workerId,
  signedIn,
  initialFavorited = false,
}: {
  workerId: string;
  signedIn: boolean;
  initialFavorited?: boolean;
}) {
  const router = useRouter();
  const [favorited, setFavorited] = useState(initialFavorited);

  async function handleClick() {
    if (!signedIn) {
      router.push("/login");
      return;
    }
    const res = await toggleFavorite(workerId);
    if (res.ok) {
      setFavorited(res.data.favorited);
      toast.success(res.data.favorited ? "Saved to favorites" : "Removed");
    } else {
      toast.error(res.error);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={favorited ? "Remove from favorites" : "Save to favorites"}
      className={`text-xl transition-colors ${
        favorited ? "text-gold" : "text-faint hover:text-gold"
      }`}
    >
      {favorited ? "♥" : "♡"}
    </button>
  );
}
