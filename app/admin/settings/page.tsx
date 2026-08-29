import type { Metadata } from "next";
import Badge from "@/components/ui/Badge";
import {
  formatCents,
  membershipPriceCents,
  PLATFORM_FEE_PERCENT,
  staffedSafetyDesk,
} from "@/lib/constants";
import { freeAccessActive, freeAccessStatus } from "@/lib/membership";
import { paymentsConfigured } from "@/lib/payments/powertranz";

export const metadata: Metadata = { title: "Settings — Admin" };

// Platform configuration is env-driven; this page surfaces the live values.
export default function AdminSettingsPage() {
  const cardsLive = paymentsConfigured();
  const freeAccess = freeAccessStatus(cardsLive);
  const settings = [
    {
      label: "Platform fee",
      value: `${PLATFORM_FEE_PERCENT}%`,
      env: "PLATFORM_FEE_PERCENT",
    },
    {
      label: "Card payments (PowerTranz)",
      value: cardsLive
        ? "Live — memberships and commission statements can be charged"
        : "Not set — dormant. Jobs are still paid directly to professionals; only platform billing is inactive.",
      env: "POWERTRANZ_MERCHANT_ID",
    },
    {
      label: "CheersJA Membership (monthly)",
      value: `${formatCents(membershipPriceCents())}/month`,
      env: "MEMBERSHIP_PRICE_CENTS",
    },
    {
      // The launch window is the ONLY switch on the membership gate — there is
      // no separate lever for booking any more. Membership gates messaging and
      // booking together.
      label: "Launch free-access window",
      value: freeAccessActive()
        ? `Active until ${process.env.FREE_ACCESS_UNTIL} — while active, membership (messaging and booking) is free for everyone`
        : "Inactive — a CheersJA Membership is required to message and book",
      env: "FREE_ACCESS_UNTIL",
    },
    {
      label: "Safety desk staffing",
      value: staffedSafetyDesk()
        ? "Staffed — monitors paged first"
        : "Unstaffed — trusted contacts + owner paged first",
      env: "SAFETY_STAFFED_DESK",
    },
    {
      label: "Google Maps",
      value: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        ? "Configured"
        : "Not set (plain address input)",
      env: "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY",
    },
    {
      label: "Email (SMTP)",
      value: process.env.EMAIL_SERVER_HOST ? "Configured" : "Not set",
      env: "EMAIL_SERVER_*",
    },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Settings</h1>

      {/* The membership gate covers chat AND booking. While card payments are
          dormant the launch window is the only way through it, so a lapse
          closes the whole funnel — warn while there is time to change it. */}
      {freeAccess.needsAttention && (
        <div className="card mt-4 border-danger/60 bg-danger/5 p-5">
          <p className="text-sm font-medium text-ink">
            {freeAccess.until === null
              ? "FREE_ACCESS_UNTIL is not set — nobody can message or book"
              : freeAccess.active
                ? `Free access ends in ${freeAccess.daysLeft} day${freeAccess.daysLeft === 1 ? "" : "s"}`
                : "Free access has ended — nobody can message or book"}
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            A CheersJA Membership is required to message a professional and to
            book one, and online payments are not configured — so the launch
            window is the only thing granting access. When it lapses, every
            booking, quote request and job post stops platform-wide and no
            customer can pay to get through it.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Push <span className="text-ink">FREE_ACCESS_UNTIL</span> forward in{" "}
            <span className="text-ink">.env</span> and restart, or configure
            PowerTranz so memberships can actually be bought.
          </p>
        </div>
      )}
      
      <p className="mt-1 text-sm text-muted">
        Values come from environment variables on the server — change them in
        `.env` and restart. Admin accounts are granted via the seed script
        (`ADMIN_EMAIL` + `npm run db:seed`).
      </p>
      <div className="card mt-6 divide-y divide-hairline">
        {settings.map((s) => (
          <div key={s.label} className="flex flex-wrap items-center justify-between gap-2 p-4">
            <div>
              <p className="text-sm text-ink">{s.label}</p>
              <p className="text-xs text-faint">{s.env}</p>
            </div>
            <Badge tone={s.value.startsWith("Not set") ? "warn" : "gold"}>
              {s.value}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
