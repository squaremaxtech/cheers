import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";

const nav = [
  { href: "/driver", label: "Dashboard" },
  { href: "/driver/requests", label: "Requests" },
  { href: "/driver/rides", label: "My rides" },
];

// The driver hub. Guard: marketplace drivers and admins — plus customers,
// who must reach /driver to REGISTER (createDriverProfile flips their role
// to driver). The old support sub-role "driver" is retired: support staff
// have no business here. Inner pages that need a profile use driverForUser
// and redirect back to /driver (onboarding) when it is missing.
export default async function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  if (user.role === "worker") redirect("/worker");
  if (user.role === "support") redirect("/admin");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <DashboardShell title="Driver hub" nav={nav}>
          {children}
        </DashboardShell>
      </main>
      <SiteFooter />
    </>
  );
}
