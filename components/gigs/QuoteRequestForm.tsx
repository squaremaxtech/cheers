"use client";

import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { requestQuote } from "@/actions/quotes";
import { QUOTE_DESCRIPTION_MAX_CHARS } from "@/lib/constants";

// The quote-mode doorway: the customer describes the job, the worker replies
// with ONE priced offer on the /quotes page. Deliberately no address field —
// the exact address is given at booking time like any other booking.
export default function QuoteRequestForm({
  gigId,
  stageName,
}: {
  gigId: string;
  stageName: string;
}) {
  const [description, setDescription] = useState("");
  const [preferredDate, setPreferredDate] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  if (sent) {
    return (
      <div className="mt-5 rounded-xl border border-success/40 bg-success/10 p-4 text-sm">
        <p className="text-ink">
          Request sent — {stageName} will reply with a priced offer.
        </p>
        <Link
          href="/quotes"
          className="mt-2 inline-block text-gold hover:text-gold-soft"
        >
          Track it on your quotes page →
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const res = await requestQuote({
      gigId,
      description,
      // Empty optionals must be omitted — the schema validates their format.
      preferredDate: preferredDate || undefined,
      preferredTime: preferredTime || undefined,
      locationNote: locationNote || undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      toast.success("Quote request sent");
      setSent(true);
    } else {
      toast.error(res.error);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-4">
      <div>
        <label className="label" htmlFor="q-description">
          Describe the job
        </label>
        <textarea
          id="q-description"
          rows={4}
          className="input"
          placeholder="What needs doing, roughly how big is the job, anything the worker should know…"
          required
          minLength={10}
          maxLength={QUOTE_DESCRIPTION_MAX_CHARS}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="q-date">
            Preferred date (optional)
          </label>
          <input
            id="q-date"
            type="date"
            className="input"
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="q-time">
            Preferred time (optional)
          </label>
          <input
            id="q-time"
            type="time"
            className="input"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="q-location">
          Area (optional)
        </label>
        <input
          id="q-location"
          className="input"
          placeholder="e.g. Half-Way Tree, Kingston"
          maxLength={200}
          value={locationNote}
          onChange={(e) => setLocationNote(e.target.value)}
        />
      </div>
      <button type="submit" className="btn-gold w-full" disabled={submitting}>
        {submitting ? "Sending…" : "Send quote request"}
      </button>
      <p className="text-xs text-faint">
        {stageName} replies with one priced offer — accept it from your quotes
        page to book.
      </p>
    </form>
  );
}
