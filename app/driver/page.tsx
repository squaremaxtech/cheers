import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Badge from "@/components/ui/Badge";
import DriverActiveToggle from "@/components/driver/DriverActiveToggle";
import DriverOnboarding from "@/components/driver/DriverOnboarding";
import DriverProfileForm from "@/components/driver/DriverProfileForm";
import DriverVerificationForm from "@/components/driver/DriverVerificationForm";
import { getMyDriverVerification } from "@/actions/drivers";
import { getUserRow } from "@/lib/auth";
import { driverForUser } from "@/lib/drivers";

export const metadata: Metadata = { title: "Driver Hub" };

// The driver dashboard (marketplace drivers — the old staff transport
// schedule moved to the booking rooms). No profile yet → onboarding; profile
// pending review → docs status; approved → the working dashboard.
export default async function DriverDashboardPage() {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");

  const driver = await driverForUser(user.id);
  if (!driver) {
    return <DriverOnboarding userName={user.name ?? ""} />;
  }

  const verification = await getMyDriverVerification();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">
            Welcome, {driver.displayName}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {driver.verified
              ? "You're approved — set yourself online and watch the request board."
              : "Your profile is registered but not yet live."}
          </p>
        </div>
        {driver.verified && !driver.suspended && (
          <Link href={`/drivers/${driver.slug}`} className="btn-ghost text-sm">
            View public profile →
          </Link>
        )}
      </div>

      {/* Admin override notice */}
      {driver.suspended && (
        <div className="card border-danger/60 bg-danger/5 p-6">
          <p className="text-sm font-medium text-danger">
            Your driver profile is suspended.
          </p>
          <p className="mt-1 text-sm text-muted">
            You can&apos;t take rides while suspended. Contact support if you
            believe this is a mistake.
          </p>
        </div>
      )}

      {/* Approval status */}
      {!driver.verified &&
        (verification?.status === "pending" ? (
          <div className="card border-warn/50 bg-warn/5 p-6">
            <div className="flex items-center gap-3">
              <Badge tone="warn">Under review</Badge>
              <p className="text-sm text-muted">
                Documents submitted{" "}
                {verification.updatedAt.toDateString()}.
              </p>
            </div>
            <p className="mt-3 text-sm leading-6 text-faint">
              Our team is reviewing your ID and licence. You&apos;ll get an
              email the moment you&apos;re approved — your profile and the
              request board unlock then.
            </p>
          </div>
        ) : (
          <div className="card space-y-4 p-6">
            <div className="flex items-center gap-3">
              <Badge tone={verification ? "danger" : "warn"}>
                {verification ? "Documents declined" : "Documents needed"}
              </Badge>
              <p className="text-sm text-muted">
                {verification
                  ? "Fix the issue below and re-submit."
                  : "One step left before review: your ID and licence."}
              </p>
            </div>
            {verification?.note && (
              <p className="rounded-xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
                Reviewer note: {verification.note}
              </p>
            )}
            <DriverVerificationForm defaultFullName={user.name ?? ""} />
          </div>
        ))}

      {/* Availability */}
      <section className="card p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Availability
        </h2>
        <div className="mt-4">
          <DriverActiveToggle active={driver.active} />
        </div>
        {!driver.verified && (
          <p className="mt-3 text-xs text-faint">
            You&apos;ll appear in the directory and see requests once approved.
          </p>
        )}
      </section>

      {/* Quick links */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/driver/requests"
          className="card block p-6 transition-colors hover:border-brand/40"
        >
          <h2 className="font-display text-lg text-ink">Request board</h2>
          <p className="mt-1 text-sm text-muted">
            Live open requests — accept a rider&apos;s price or counter with
            yours.
          </p>
        </Link>
        <Link
          href="/driver/rides"
          className="card block p-6 transition-colors hover:border-brand/40"
        >
          <h2 className="font-display text-lg text-ink">My rides</h2>
          <p className="mt-1 text-sm text-muted">
            Your matched trips — upcoming pickups and past fares.
          </p>
        </Link>
      </div>

      {/* Profile, vehicle & rates */}
      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
          Profile, vehicle &amp; rates
        </h2>
        <div className="mt-4">
          <DriverProfileForm
            mode="edit"
            initial={{
              displayName: driver.displayName,
              bio: driver.bio,
              facePhotoUrl: driver.facePhotoUrl,
              parish: driver.parish,
              city: driver.city,
              vehicleMake: driver.vehicleMake,
              vehicleModel: driver.vehicleModel,
              vehicleYear: driver.vehicleYear,
              vehicleColor: driver.vehicleColor,
              vehiclePlate: driver.vehiclePlate,
              vehiclePhotoUrl: driver.vehiclePhotoUrl,
              perKmRateCents: driver.perKmRateCents,
              minFareCents: driver.minFareCents,
            }}
          />
        </div>
      </section>
    </div>
  );
}
