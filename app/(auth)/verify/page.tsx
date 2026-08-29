import Link from "next/link";

export default function VerifyPage() {
  return (
    <div className="card w-full max-w-sm p-8 text-center">
      <h1 className="font-display text-2xl tracking-tight text-ink">
        Check your email
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        We sent you a sign-in link. Open it on this device to continue — it
        expires shortly. If it has not arrived in a minute, check your spam
        folder.
      </p>
      <div className="mt-6 space-y-2 text-xs leading-5 text-faint">
        <p>
          You must be 18 or older to use CheersJA —{" "}
          <Link href="/terms#eligibility" className="text-brand hover:underline">
            eligibility
          </Link>
          .
        </p>
        <p>
          By continuing you agree to the{" "}
          <Link href="/terms" className="text-brand hover:underline">
            Terms of Service
          </Link>{" "}
          and the{" "}
          <Link href="/privacy" className="text-brand hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
