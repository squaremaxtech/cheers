import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import SiteFooter from "@/components/layout/SiteFooter";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";

const nav = [
  { href: "/dashboard", label: "Overview" },
  { href: "/bookings", label: "Bookings" },
  { href: "/rides", label: "Rides" },
  { href: "/quotes", label: "Quotes" },
  { href: "/requests", label: "Requests" },
  { href: "/chats", label: "Messages" },
  { href: "/favorites", label: "Favorites" },
  { href: "/membership", label: "Membership" },
  { href: "/browse", label: "Browse services" },
];

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  // First-time customers finish the /welcome setup (profile + terms; the
  // Verified ID step is optional) before using the account area. This keys
  // on users.onboardedAt, which only completeCustomerOnboarding sets — so an
  // older account that already has it is never dragged back into the wizard.
  if (user.role === "customer" && !user.onboardedAt) redirect("/welcome");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <DashboardShell title="My account" nav={nav}>
          {children}
        </DashboardShell>
      </main>
      <SiteFooter />
    </>
  );
}
