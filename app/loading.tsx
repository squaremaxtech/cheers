export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-gold" />
        <p className="font-display text-sm tracking-[0.3em] text-faint">
          CHEERS
        </p>
      </div>
    </div>
  );
}
