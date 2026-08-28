"use client";

import { useState } from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import toast from "react-hot-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function handleEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.includes("@")) {
      toast.error("Enter a valid email address");
      return;
    }
    setSending(true);
    const res = await signIn("email", {
      email,
      redirect: false,
      callbackUrl: "/dashboard",
    });
    setSending(false);
    if (res?.error) {
      toast.error("Could not send the sign-in link. Try again.");
    } else {
      window.location.href = "/verify";
    }
  }

  return (
    <div className="card w-full max-w-sm p-8">
      <h1 className="font-display text-2xl tracking-tight text-ink">
        Welcome to Cheers
      </h1>
      <p className="mt-1 text-sm text-muted">
        Sign in or create your account — one link, no passwords. The same
        account hires professionals and offers services.
      </p>

      <form onSubmit={handleEmail} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="label">
            Email address
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input"
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={sending}>
          {sending ? "Sending link…" : "Email me a sign-in link"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-faint">
        <span className="brand-line flex-1" />
        or
        <span className="brand-line flex-1" />
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="btn-outline w-full"
      >
        Continue with Google
      </button>

      <div className="mt-6 space-y-2 text-center text-xs leading-5 text-faint">
        <p>
          You must be 18 or older to use Cheers —{" "}
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
