import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";

const nav = [
  { href: "/worker", label: "Overview" },
  { href: "/worker/bookings", label: "Bookings" },
  { href: "/worker/profile", label: "Profile" },
  { href: "/worker/media", label: "Media" },
  { href: "/worker/services", label: "Services" },
  { href: "/worker/availability", label: "Availability" },
  { href: "/worker/earnings", label: "Earnings" },
];

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <DashboardShell title="Worker studio" nav={nav}>
          {children}
        </DashboardShell>
      </main>
      <SiteFooter />
    </>
  );
}
