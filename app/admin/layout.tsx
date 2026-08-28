import { redirect } from "next/navigation";
import DashboardShell, {
  type NavItem,
} from "@/components/layout/DashboardShell";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";
import { isDriver, isSafetyMonitor } from "@/lib/guards";

const nav: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/safety", label: "Safety desk" },
  { href: "/admin/workers", label: "Professionals" },
  { href: "/admin/drivers", label: "Drivers" },
  { href: "/admin/gigs", label: "Gigs" },
  { href: "/admin/promote", label: "Promote" },
  { href: "/admin/verifications", label: "Verifications" },
  { href: "/admin/bookings", label: "Bookings" },
  { href: "/admin/requests", label: "Requests" },
  { href: "/admin/rides", label: "Rides" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/chats", label: "Chats" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Settings" },
];

// Admin + desk support (customer_support/supervisor) share this area; server
// actions gate destructive operations to the admin role specifically.
// Drivers and safety monitors are support staff too, but each gets only their
// own surface: transport at /driver, the live board at /safety. Routing them
// away here is what keeps least privilege from depending on remembering to
// guard every individual admin page.
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  if (user.role !== "admin" && user.role !== "support") redirect("/dashboard");
  if (isDriver(user)) redirect("/driver");
  if (isSafetyMonitor(user)) redirect("/safety");

  // Granting premium is an owner decision, not a desk task: /admin/promote
  // is admin-only (the page redirects, the actions requireAdmin), so support
  // never sees the link either.
  const items =
    user.role === "admin"
      ? nav
      : nav.filter((item) => item.href !== "/admin/promote");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <DashboardShell title="Admin" nav={items}>
          {children}
        </DashboardShell>
      </main>
    </>
  );
}
