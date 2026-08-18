"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { submitRideReview } from "@/actions/rides";

// Rider rates the driver after a completed ride. One review per ride; the
// action refreshes the driver's denormalized rating cache.
export default function RideReviewForm({ rideId }: { rideId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (rating < 1) {
      toast.error("Pick a star rating first.");
      return;
    }
    setSaving(true);
    const res = await submitRideReview({
      rideId,
      rating,
      body: body.trim() || undefined,
    });
    setSaving(false);
    if (res.ok) {
      toast.success("Thanks — your rating helps other riders.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <p className="label">Your rating</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              className={`text-3xl leading-none transition-colors ${
                star <= rating ? "text-gold" : "text-hairline hover:text-gold-soft"
              }`}
              onClick={() => setRating(star)}
            >
              ★
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="label" htmlFor="ride-review-body">
          Anything to add? (optional)
        </label>
        <textarea
          id="ride-review-body"
          rows={3}
          className="input"
          placeholder="Clean car, safe driving, easy to find…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </div>
      <button type="submit" className="btn-gold" disabled={saving}>
        {saving ? "Submitting…" : "Submit rating"}
      </button>
    </form>
  );
}
