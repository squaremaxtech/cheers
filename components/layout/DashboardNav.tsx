"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "@/components/layout/DashboardShell";

// Nav links with the current page highlighted (same look as hover). The
// active item is the LONGEST href that prefixes the pathname, so /worker
// stays idle while /worker/bookings/123 lights up "Bookings".
export default function DashboardNav({ nav }: { nav: NavItem[] }) {
  const pathname = usePathname();

  const active = nav.reduce<NavItem | null>((best, item) => {
    const matches =
      pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) return best;
    if (!best || item.href.length > best.href.length) return item;
    return best;
  }, null);

  return (
    <nav className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:pb-0">
      {nav.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.href === active?.href ? "page" : undefined}
          className={`btn-ghost shrink-0 justify-start whitespace-nowrap text-sm ${
            item.href === active?.href ? "bg-raised text-ink" : ""
          }`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
