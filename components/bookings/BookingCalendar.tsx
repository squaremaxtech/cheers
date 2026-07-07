"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getBookingDates } from "@/actions/bookings";
import { jamaicaTodayISO } from "@/lib/constants";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// How many months ahead the calendar can page (mirrors BOOKING_HORIZON_DAYS).
const MAX_MONTHS_AHEAD = 6;

function monthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

// Month-grid date picker that only lets customers pick days with at least
// one open slot — everything else renders greyed out, so there's no
// clicking around to discover availability.
export default function BookingCalendar({
  workerId,
  durationMinutes,
  excludeBookingId,
  value,
  onSelect,
}: {
  workerId: string;
  durationMinutes: number;
  excludeBookingId?: string;
  value: string;
  onSelect: (date: string) => void;
}) {
  const today = jamaicaTodayISO();
  const todayYear = Number(today.slice(0, 4));
  const todayMonth = Number(today.slice(5, 7)) - 1;

  const [year, setYear] = useState(todayYear);
  const [monthIndex, setMonthIndex] = useState(todayMonth);
  // cache: "<YYYY-MM>|<duration>" → dates with an open slot
  const [openByMonth, setOpenByMonth] = useState<Map<string, string[]>>(
    new Map()
  );
  const [loading, setLoading] = useState(false);

  const month = monthKey(year, monthIndex);
  const cacheKey = `${month}|${durationMinutes}`;
  const openDates = useMemo(
    () => new Set(openByMonth.get(cacheKey) ?? []),
    [openByMonth, cacheKey]
  );

  useEffect(() => {
    if (openByMonth.has(cacheKey)) return;
    let cancelled = false;
    setLoading(true);
    getBookingDates({ workerId, month, durationMinutes, excludeBookingId })
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setOpenByMonth((m) => new Map(m).set(cacheKey, res.data.dates));
        } else {
          toast.error(res.error);
          setOpenByMonth((m) => new Map(m).set(cacheKey, []));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [workerId, month, durationMinutes, excludeBookingId, cacheKey, openByMonth]);

  const monthsFromToday = (year - todayYear) * 12 + (monthIndex - todayMonth);
  const canPrev = monthsFromToday > 0;
  const canNext = monthsFromToday < MAX_MONTHS_AHEAD;

  function shiftMonth(delta: number) {
    const next = new Date(Date.UTC(year, monthIndex + delta, 1));
    setYear(next.getUTCFullYear());
    setMonthIndex(next.getUTCMonth());
  }

  const firstDow = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstDow }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = String(i + 1).padStart(2, "0");
      return `${month}-${d}`;
    }),
  ];

  return (
    <div className="rounded-xl border border-hairline p-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          disabled={!canPrev}
          aria-label="Previous month"
          className="btn-ghost px-3 py-1 text-sm disabled:opacity-30"
        >
          ‹
        </button>
        <p className="text-sm font-medium text-ink">
          {MONTH_NAMES[monthIndex]} {year}
          {loading && <span className="ml-2 text-xs text-faint">checking…</span>}
        </p>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          disabled={!canNext}
          aria-label="Next month"
          className="btn-ghost px-3 py-1 text-sm disabled:opacity-30"
        >
          ›
        </button>
      </div>

      <div className="mt-2 grid grid-cols-7 gap-1 text-center">
        {DAY_LABELS.map((d, i) => (
          <span key={`${d}${i}`} className="py-1 text-[11px] uppercase text-faint">
            {d}
          </span>
        ))}
        {cells.map((date, i) => {
          if (!date) return <span key={`pad-${i}`} />;
          const open = openDates.has(date) && date >= today;
          const selected = value === date;
          if (!open) {
            return (
              <span
                key={date}
                title={loading ? undefined : "No open times"}
                className="cursor-not-allowed rounded-lg py-2 text-sm text-faint/50 line-through"
              >
                {Number(date.slice(8, 10))}
              </span>
            );
          }
          return (
            <button
              key={date}
              type="button"
              onClick={() => onSelect(date)}
              className={`rounded-lg py-2 text-sm transition-colors ${
                selected
                  ? "bg-gold font-medium text-base"
                  : "text-ink hover:bg-raised"
              }`}
            >
              {Number(date.slice(8, 10))}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-faint">
        Greyed-out days have no open times for the selected duration.
      </p>
    </div>
  );
}
