import type { Metadata } from "next";
import Badge from "@/components/ui/Badge";
import {
  formatCents,
  membershipPriceCents,
  PLATFORM_FEE_PERCENT,
  staffedSafetyDesk,
  stripeConfigured,
} from "@/lib/constants";
import { freeAccessActive } from "@/lib/membership";

export const metadata: Metadata = { title: "Settings — Admin" };

// Platform configuration is env-driven; this page surfaces the live values.
export default function AdminSettingsPage() {
  const settings = [
    {
      label: "Platform fee",
      value: `${PLATFORM_FEE_PERCENT}%`,
      env: "PLATFORM_FEE_PERCENT",
    },
    {
      label: "Online payments (Stripe)",
      value: stripeConfigured()
        ? "Live — card buttons and membership checkout shown"
        : "Not set — dormant (cash-first, card UI hidden)",
      env: "STRIPE_SECRET_KEY",
    },
    {
      label: "Stripe webhook",
      value: process.env.STRIPE_WEBHOOK_SECRET ? "Configured" : "Not set",
      env: "STRIPE_WEBHOOK_SECRET",
    },
    {
      label: "Cheers Membership (monthly)",
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
        : "Inactive — a Cheers Membership is required to message and book",
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
