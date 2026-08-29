// Tones read on the dark theme: light text on its own faint wash of the same
// hue, all legible against the #171412 card surface. The washes stay low
// (10–14%) because on a near-black ground a heavier fill starts to glow.
// "brand" and "gold" are the same accent family by design — brand is the
// quieter outline, gold the emphatic one.
const tones = {
  brand: "border-brand/40 text-brand-soft bg-brand/10",
  gold: "border-gold/50 text-gold-soft bg-gold/15",
  neutral: "border-hairline text-muted bg-raised",
  success: "border-success/40 text-success bg-success/10",
  danger: "border-danger/40 text-danger bg-danger/10",
  warn: "border-warn/40 text-warn bg-warn/10",
} as const;

export default function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof tones;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wider ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
