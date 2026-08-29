import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <p className="font-display text-2xl tracking-tight text-gold">
        CheersJA
      </p>
      <h1 className="font-display mt-8 text-2xl tracking-tight text-ink">
        This page isn&apos;t available
      </h1>
      <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
        The page or profile you&apos;re looking for doesn&apos;t exist, or it is
        no longer listed.
      </p>
      <div className="mt-8 flex gap-3">
        <Link href="/browse" className="btn-primary">
          Browse services
        </Link>
        <Link href="/" className="btn-outline">
          Home
        </Link>
      </div>
    </div>
  );
}
