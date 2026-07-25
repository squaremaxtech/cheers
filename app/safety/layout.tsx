import { redirect } from "next/navigation";
import DashboardShell from "@/components/layout/DashboardShell";
import SiteHeader from "@/components/layout/SiteHeader";
import { getUserRow } from "@/lib/auth";
import { isSafetyDesk } from "@/lib/guards";

const nav = [
  { href: "/safety", label: "Live board" },
  { href: "/safety/rota", label: "On-call rota" },
];

// The safety desk lives OUTSIDE /admin on purpose.
//
// Safety monitors need this board and nothing else — not payments, not chat
// transcripts, not identity documents. Giving them their own top-level area
// (the same pattern drivers use at /driver) means least privilege is enforced
// by routing, not by remembering to add a guard to every admin page. Admins
// and desk support reach it from their own nav.
export default async function SafetyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUserRow();
  if (!user || user.suspended) redirect("/login");
  if (!isSafetyDesk(user)) redirect("/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <DashboardShell title="Safety desk" nav={nav}>
          {children}
        </DashboardShell>
      </main>
    </>
  );
}
