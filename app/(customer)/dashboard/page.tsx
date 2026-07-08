import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { bookings, notifications } from "@/db/schema";
import Badge from "@/components/ui/Badge";
import NotificationsList from "@/components/customer/NotificationsList";
import ProfileForm from "@/components/customer/ProfileForm";
import VerificationCard from "@/components/customer/VerificationCard";
import { getUserRow } from "@/lib/auth";
import { isDriver } from "@/lib/guards";
import { freeAccessActive, getMembership } from "@/lib/membership";
import { statusTone } from "@/lib/status";
import { getCustomerVerification } from "@/lib/verification";

export const metadata: Metadata = { title: "Dashboard" };

export default async function CustomerDashboard() {
  const user = await getUserRow();
  if (!user) redirect("/login");
  // Role-based home: this route is the shared post-login landing spot.
  if (user.role === "worker") redirect("/worker");
  if (user.role === "support") redirect(isDriver(user) ? "/driver" : "/admin");
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
      getCustomerVerification(user.id),
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

      {/* Identity verification status (booking is gated on approval) */}
      <section className="card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Identity verification
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
          <Link href="/bookings" className="text-sm text-gold hover:text-gold-soft">
            View all →
          </Link>
        </div>
        {recentBookings.length === 0 ? (
          <p className="mt-4 text-sm text-faint">
            No bookings yet.{" "}
            <Link href="/browse" className="text-gold">
              Browse workers
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-hairline">
            {recentBookings.map((b) => (
              <li key={b.id}>
                <Link
                  href={`/bookings/${b.id}`}
                  className="flex items-center justify-between gap-3 py-3 text-sm hover:text-gold-soft"
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
