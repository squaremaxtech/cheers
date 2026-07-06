import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";

const nav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/workers", label: "Workers" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

// Admin + support share this area; server actions gate destructive
// operations to the admin role specifically.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  if (user.role !== "admin" && user.role !== "support") redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <DashboardShell title="Admin" nav={nav}>
          {children}
        </DashboardShell>
      </main>
    </>
  );
}
