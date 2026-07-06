"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { submitReview } from "@/actions/reviews";

export default function ReviewForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const res = await submitReview({
      bookingId,
      rating,
      body: body || undefined,
      anonymous,
    });
    setBusy(false);
    if (res.ok) {
      toast.success("Review submitted — it will appear once approved.");
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-1 text-2xl">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            aria-label={`${star} stars`}
            className={star <= rating ? "text-gold" : "text-hairline"}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        rows={4}
        className="input"
        placeholder="How was your experience? (optional)"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="h-4 w-4 accent-[var(--color-gold)]"
        />
        Post anonymously
      </label>
      <button type="submit" className="btn-gold" disabled={busy}>
        {busy ? "Submitting…" : "Submit review"}
      </button>
    </form>
  );
}
