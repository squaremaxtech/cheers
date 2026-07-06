import Stripe from "stripe";

// Lazy singleton so builds without STRIPE_SECRET_KEY don't crash at import time.
let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
    client = new Stripe(key);
  }
  return client;
}

export function appUrl(path: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}
