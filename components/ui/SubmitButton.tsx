"use client";

import { useFormStatus } from "react-dom";

// Submit button that disables + shows progress while its parent form's
// server action is pending.
export default function SubmitButton({
  children,
  className = "btn-gold",
  pendingText = "Working…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? pendingText : children}
    </button>
  );
}
