const tones = {
  gold: "border-gold/40 text-gold-soft bg-gold/10",
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
