import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, notifications } from "@/db/schema";
import AcceptTermsBanner from "@/components/ui/AcceptTermsBanner";
import Badge from "@/components/ui/Badge";
import NotificationsList from "@/components/customer/NotificationsList";
import ProfileForm from "@/components/customer/ProfileForm";
import VerificationCard from "@/components/customer/VerificationCard";
import { getUserRow } from "@/lib/auth";
import { isSafetyMonitor } from "@/lib/guards";
import { freeAccessActive, getMembership } from "@/lib/membership";
import { needsTermsAcceptance } from "@/lib/onboarding";
import { hasPremiumAccess } from "@/lib/premium";
import { statusTone } from "@/lib/status";
import { getIdentityVerification } from "@/lib/verification";

export const metadata: Metadata = { title: "Dashboard" };

export default async function CustomerDashboard() {
  const user = await getUserRow();
  if (!user) redirect("/login");
  // Role-based home: this route is the shared post-login landing spot.
  // Driver is a first-class marketplace role now; the support sub-role
  // "driver" is retired (safety monitors go to their desk, the rest to admin).
  if (user.role === "worker") redirect("/worker");
  if (user.role === "driver") redirect("/driver");
  if (user.role === "support") {
    redirect(isSafetyMonitor(user) ? "/safety" : "/admin");
  }
  if (user.role === "admin") redirect("/admin");

  const [recentBookings, recentNotifications, membership, verification] =
    await Promise.all([
      db
        .select()
        .from(bookings)
        .where(eq(bookings.customerId, user.id))
        .orderBy(desc(bookings.createdAt))
        .limit(3),
      db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, user.id))
        .orderBy(desc(notifications.createdAt))
        .limit(8),
      getMembership(user.id),
      getIdentityVerification(user.id),
    ]);

  const membershipLabel = freeAccessActive()
    ? "Free access"
    : membership?.status === "active" &&
        membership.currentPeriodEnd !== null &&
        membership.currentPeriodEnd > new Date()
      ? "Active"
      : "Not a member";

  return (
    <div className="space-y-8">
      {needsTermsAcceptance(user) && (
        <AcceptTermsBanner updated={user.termsAcceptedAt !== null} />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">
            Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted">{user.email}</p>
        </div>
        <Link href="/membership">
          <Badge tone={membershipLabel === "Not a member" ? "neutral" : "gold"}>
            Membership: {membershipLabel}
          </Badge>
        </Link>
      </div>

      {/* Premium access (admin-granted — plan §1.5) */}
      {hasPremiumAccess(user) && (
        <section className="card border-gold/40 p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
                Premium access
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                Your account can see and book premium services — listings that
                are invisible to everyone else. They carry a{" "}
                <span className="text-gold-deep">Premium</span> badge wherever they
                appear, and you can filter for them on Browse.
              </p>
            </div>
            <Link href="/browse?premium=1" className="btn-primary shrink-0">
              Browse premium
            </Link>
          </div>
        </section>
      )}

      {/* Verified ID badge — optional, gates nothing (plan §2.2) */}
      <section className="card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Get your Verified ID badge (optional)
        </h2>
        <div className="mt-4">
          <VerificationCard
            verification={verification}
            userName={user.name ?? ""}
          />
        </div>
      </section>

      {/* Recent bookings */}
      <section className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Recent bookings
          </h2>
          <Link href="/bookings" className="text-sm text-brand hover:text-brand-soft">
            View all →
          </Link>
        </div>
        {recentBookings.length === 0 ? (
          <p className="mt-4 text-sm text-faint">
            No bookings yet.{" "}
            <Link href="/browse" className="text-brand hover:text-brand-soft">
              Browse professionals
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline">
            {recentBookings.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/bookings/${b.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:text-brand-soft"
                >
                  <span className="text-ink">
                    {b.serviceName}
                    <span className="ml-2 text-faint">{b.code}</span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-muted">{b.date}</span>
                    <Badge tone={statusTone(b.status)}>{b.status}</Badge>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="card p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Profile
          </h2>
          <div className="mt-4">
            <ProfileForm name={user.name ?? ""} phone={user.phone ?? ""} />
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            Notifications
          </h2>
          <div className="mt-4">
            <NotificationsList notifications={recentNotifications} />
          </div>
        </section>
      </div>
    </div>
  );
}
