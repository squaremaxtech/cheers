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
  { href: "/admin/catalog", label: "Catalog" },
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

  // Two surfaces are owner decisions rather than desk tasks and are admin-only
  // (each page redirects, each action requireAdmin), so support never sees the
  // link either: /admin/promote grants the premium tier, and /admin/catalog
  // owns the browse vocabulary every listing is filed under — and shows the
  // hidden Premium category while it does.
  const adminOnly = ["/admin/promote", "/admin/catalog"];
  const items =
    user.role === "admin"
      ? nav
      : nav.filter((item) => !adminOnly.includes(item.href));

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
