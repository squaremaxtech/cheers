import DashboardNav from "@/components/layout/DashboardNav";

export type NavItem = { href: string; label: string };

// Shared chrome for customer / worker / admin areas. Mobile-first: nav renders
// as a horizontal scroller on small screens, a sidebar on large.
export default function DashboardShell({
  title,
  nav,
  children,
}: {
  title: string;
  nav: NavItem[];
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-5 py-8 lg:flex-row">
      <aside className="lg:w-52 lg:shrink-0">
        <p className="mb-3 hidden text-xs font-medium uppercase tracking-[0.2em] text-faint lg:block">
          {title}
        </p>
        <DashboardNav nav={nav} />
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
