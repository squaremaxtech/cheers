export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <span className="h-8 w-8 animate-spin rounded-full border-2 border-hairline border-t-brand" />
        <p className="font-display text-sm font-semibold tracking-tight text-faint">
          CheersJA
        </p>
      </div>
    </div>
  );
}
