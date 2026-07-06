"use client";

// App-wide error boundary. This modified Next.js passes unstable_retry
// (replacing the old `reset` prop).
export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <p className="font-display text-2xl tracking-[0.3em] text-gold">CHEERS</p>
      <h1 className="font-display mt-8 text-2xl text-ink">
        Something went wrong
      </h1>
      <p className="mt-3 max-w-sm text-sm text-muted">
        An unexpected error interrupted the page. It has been logged
        {error.digest ? ` (ref ${error.digest})` : ""} — try again in a moment.
      </p>
      <button
        type="button"
        onClick={() => unstable_retry()}
        className="btn-gold mt-8"
      >
        Try again
      </button>
    </div>
  );
}
