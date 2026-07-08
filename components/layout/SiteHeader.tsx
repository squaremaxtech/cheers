import Link from "next/link";
import { getUserRow } from "@/lib/auth";
import { isDriver } from "@/lib/guards";
import type { UserRow } from "@/types";

function dashboardPath(user: UserRow): string {
  if (user.role === "worker") return "/worker";
  if (user.role === "admin") return "/admin";
  if (user.role === "support") return isDriver(user) ? "/driver" : "/admin";
  return "/dashboard";
}

export default async function SiteHeader() {
  const user = await getUserRow();

  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-base/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-4 sm:px-5">
        <Link
          href="/"
          className="font-display shrink-0 text-lg tracking-[0.2em] text-gold sm:text-xl sm:tracking-[0.25em]"
        >
          CHEERS
        </Link>
        <nav className="flex min-w-0 items-center gap-1 text-sm">
          <Link href="/browse" className="btn-ghost hidden sm:inline-flex">
            Browse
          </Link>
          <Link href="/about" className="btn-ghost hidden md:inline-flex">
            About
          </Link>
          <Link href="/faq" className="btn-ghost hidden md:inline-flex">
            FAQ
          </Link>
          {user ? (
            <Link
              href={dashboardPath(user)}
              className="btn-outline ml-1 shrink-0 sm:ml-2"
            >
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="btn-gold ml-1 shrink-0 sm:ml-2">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
