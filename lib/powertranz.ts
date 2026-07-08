import { randomUUID } from "crypto";
import { CURRENCY } from "@/lib/constants";

// PowerTranz (First Atlantic Commerce / Fiserv Caribbean) gateway client —
// hosted-page SPI flow, so card data NEVER touches this app:
//   1. POST /api/spi/sale with ExtendedData.HostedPage + MerchantResponseUrl
//      → SpiToken + RedirectData (HTML that renders the PowerTranz-hosted
//      card page and the 3DS challenge).
//   2. We serve that HTML to the customer (GET /api/pay/session/<token>).
//   3. PowerTranz posts the outcome (incl. the SpiToken) from the customer's
//      browser to our MerchantResponseUrl (/api/pay/callback?...).
//   4. We finalize server-side: POST /api/spi/payment with the SpiToken
//      (must happen within its ~5-minute TTL) → Approved / declined.
// Refunds: POST /api/refund with the ORIGINAL TransactionIdentifier.
//
// Env (see docs/HANDOFF.md): POWERTRANZ_ID, POWERTRANZ_PASSWORD,
// POWERTRANZ_HPP_PAGESET ("PTZ/..." from the merchant portal),
// POWERTRANZ_HPP_PAGENAME (default "Default"), POWERTRANZ_BASE_URL
// (staging https://staging.ptranz.com by default; FAC supplies the
// production URL with your live credentials).
//
// Dev without credentials: POWERTRANZ_SIMULATE=1 (refused in production)
// swaps the gateway for an in-app approve/decline page so every payment
// flow can be exercised end-to-end locally.

const BASE_URL =
  process.env.POWERTRANZ_BASE_URL ?? "https://staging.ptranz.com";

// ISO 4217 numeric codes for the currencies the platform may charge in.
const CURRENCY_NUMERIC: Record<string, string> = {
  usd: "840",
  jmd: "388",
};

export function appUrl(path: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

export function gatewaySimulated(): boolean {
  return (
    process.env.POWERTRANZ_SIMULATE === "1" &&
    process.env.NODE_ENV !== "production"
  );
}

export function gatewayConfigured(): boolean {
  if (gatewaySimulated()) return true;
  return Boolean(
    process.env.POWERTRANZ_ID &&
      process.env.POWERTRANZ_PASSWORD &&
      process.env.POWERTRANZ_HPP_PAGESET
  );
}

function authHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    accept: "application/json",
    "PowerTranz-PowerTranzId": process.env.POWERTRANZ_ID ?? "",
    "PowerTranz-PowerTranzPassword": process.env.POWERTRANZ_PASSWORD ?? "",
  };
}

// PowerTranz amounts are decimal major units, not cents.
function decimalAmount(amountCents: number): number {
  return Number((amountCents / 100).toFixed(2));
}

export type GatewayInit = {
  spiToken: string;
  redirectData: string;
  transactionIdentifier: string;
};

// Start a hosted-page card payment. orderId is our reference shown in the
// PowerTranz portal (booking code / membership payment id).
export async function initiateHostedPayment(opts: {
  amountCents: number;
  orderId: string;
  responseUrl: string;
}): Promise<GatewayInit> {
  if (gatewaySimulated()) {
    const spiToken = `SIM-${randomUUID()}`;
    return {
      spiToken,
      transactionIdentifier: spiToken,
      redirectData: simulatedGatewayPage(opts, spiToken),
    };
  }

  const transactionIdentifier = randomUUID();
  const res = await fetch(`${BASE_URL}/api/spi/sale`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      TransactionIdentifier: transactionIdentifier,
      TotalAmount: decimalAmount(opts.amountCents),
      CurrencyCode: CURRENCY_NUMERIC[CURRENCY] ?? "840",
      ThreeDSecure: true,
      OrderIdentifier: opts.orderId,
      ExtendedData: {
        MerchantResponseUrl: opts.responseUrl,
        ThreeDSecure: { ChallengeWindowSize: 4, ChallengeIndicator: "01" },
        HostedPage: {
          PageSet: process.env.POWERTRANZ_HPP_PAGESET ?? "",
          PageName: process.env.POWERTRANZ_HPP_PAGENAME ?? "Default",
        },
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`powertranz sale failed: HTTP ${res.status}`);
  }
  const data: {
    SpiToken?: string;
    RedirectData?: string;
    TransactionIdentifier?: string;
    Errors?: { Message?: string }[];
  } = await res.json();
  if (!data.SpiToken || !data.RedirectData) {
    throw new Error(
      `powertranz sale rejected: ${data.Errors?.[0]?.Message ?? "no SpiToken/RedirectData"}`
    );
  }
  return {
    spiToken: data.SpiToken,
    redirectData: data.RedirectData,
    transactionIdentifier: data.TransactionIdentifier ?? transactionIdentifier,
  };
}

// Second SPI step after the callback: finalize with the SpiToken. Per the
// gateway spec this call carries NO merchant auth headers — the token is the
// authorization. The gateway response, not the callback body, is the source
// of truth for approval.
export async function completeGatewayPayment(spiToken: string): Promise<{
  approved: boolean;
  transactionId: string | null;
  message: string;
}> {
  const res = await fetch(`${BASE_URL}/api/spi/payment`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(spiToken),
  });
  if (!res.ok) {
    return { approved: false, transactionId: null, message: `HTTP ${res.status}` };
  }
  const data: {
    Approved?: boolean;
    IsoResponseCode?: string;
    ResponseMessage?: string;
    TransactionIdentifier?: string;
  } = await res.json();
  return {
    approved: data.Approved === true && data.IsoResponseCode === "00",
    transactionId: data.TransactionIdentifier ?? null,
    message: data.ResponseMessage ?? data.IsoResponseCode ?? "unknown",
  };
}

// Refund a settled transaction (full amount as used here). True = accepted.
export async function refundGatewayPayment(
  transactionId: string,
  amountCents: number
): Promise<boolean> {
  if (gatewaySimulated() || transactionId.startsWith("SIM-")) return true;
  try {
    const res = await fetch(`${BASE_URL}/api/refund`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({
        TransactionIdentifier: transactionId,
        TotalAmount: decimalAmount(amountCents),
        CurrencyCode: CURRENCY_NUMERIC[CURRENCY] ?? "840",
      }),
    });
    if (!res.ok) return false;
    const data: { Approved?: boolean; IsoResponseCode?: string } =
      await res.json();
    return data.Approved === true;
  } catch (error) {
    console.error(
      "powertranz refund failed:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Redirect-page hand-off: server actions can only return JSON, so the
// RedirectData HTML is parked here (single pm2 fork, same pattern as the SSE
// bus) and served by GET /api/pay/session/<token>.
// ---------------------------------------------------------------------------

const REDIRECT_TTL_MS = 15 * 60_000;

const globalStore = globalThis as unknown as {
  __payRedirects?: Map<string, { html: string; expires: number }>;
};
const redirects = (globalStore.__payRedirects ??= new Map<
  string,
  { html: string; expires: number }
>());

export function storeRedirectPage(html: string): string {
  const now = Date.now();
  for (const [key, entry] of redirects) {
    if (entry.expires < now) redirects.delete(key);
  }
  const token = randomUUID();
  redirects.set(token, { html, expires: now + REDIRECT_TTL_MS });
  return token;
}

export function getRedirectPage(token: string): string | null {
  const entry = redirects.get(token);
  if (!entry || entry.expires < Date.now()) return null;
  return entry.html;
}

// Dev-only stand-in for the PowerTranz hosted page: approve/decline buttons
// that post back to the callback exactly like the real gateway would.
function simulatedGatewayPage(
  opts: { amountCents: number; orderId: string; responseUrl: string },
  spiToken: string
): string {
  const amount = `$${(opts.amountCents / 100).toFixed(2)}`;
  return `<!doctype html><html><head><title>Simulated gateway</title></head>
<body style="font-family:sans-serif;background:#111;color:#eee;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<div style="max-width:420px;padding:32px;border:1px solid #444;border-radius:12px;">
  <h2 style="margin:0 0 8px;">Simulated PowerTranz page</h2>
  <p style="color:#aaa;">POWERTRANZ_SIMULATE=1 — no real gateway involved.</p>
  <p>Order <strong>${opts.orderId}</strong> · Amount <strong>${amount}</strong></p>
  <form method="POST" action="${opts.responseUrl}" style="display:inline">
    <input type="hidden" name="SpiToken" value="${spiToken}" />
    <input type="hidden" name="SimApproved" value="1" />
    <button type="submit" style="padding:10px 22px;background:#2e7d32;color:#fff;border:0;border-radius:8px;cursor:pointer;">Approve payment</button>
  </form>
  <form method="POST" action="${opts.responseUrl}" style="display:inline;margin-left:8px;">
    <input type="hidden" name="SpiToken" value="${spiToken}" />
    <input type="hidden" name="SimApproved" value="0" />
    <button type="submit" style="padding:10px 22px;background:#c62828;color:#fff;border:0;border-radius:8px;cursor:pointer;">Decline</button>
  </form>
</div></body></html>`;
}
