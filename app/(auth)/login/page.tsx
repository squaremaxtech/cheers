"use client";

import { useState } from "react";
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
      <h1 className="font-display text-2xl text-ink">Welcome</h1>
      <p className="mt-1 text-sm text-muted">
        Sign in or create your account — one link, no passwords.
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
        <button type="submit" className="btn-gold w-full" disabled={sending}>
          {sending ? "Sending link…" : "Email me a sign-in link"}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-faint">
        <span className="gold-line flex-1" />
        or
        <span className="gold-line flex-1" />
      </div>

      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
        className="btn-outline w-full"
      >
        Continue with Google
      </button>

      <p className="mt-6 text-center text-xs text-faint">
        By continuing you confirm you are 18+ and agree to our Terms.
      </p>
    </div>
  );
}
