import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="hairline-top mt-auto">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg tracking-[0.25em] text-gold">
            CHEERS
          </p>
          <p className="mt-1 text-xs text-faint">
            Premium bookings across Jamaica. 18+ only.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted">
          <Link href="/about" className="hover:text-ink">
            About
          </Link>
          <Link href="/contact" className="hover:text-ink">
            Contact
          </Link>
          <Link href="/faq" className="hover:text-ink">
            FAQ
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
        </nav>
      </div>
    </footer>
  );
}
