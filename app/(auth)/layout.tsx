import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Link
        href="/"
        className="mb-10 font-display text-2xl tracking-[0.3em] text-gold"
      >
        CHEERS
      </Link>
      {children}
    </div>
  );
}
