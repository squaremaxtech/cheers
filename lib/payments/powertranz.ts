import { randomUUID } from "crypto";

// =============================================================================
// PowerTranz (First Atlantic Commerce) — the ONLY module in this codebase that
// talks to a payment gateway over HTTP.
// =============================================================================
//
// WHAT IT IS USED FOR. Two money-in flows, both platform revenue:
//   1. the customer's monthly CheersJA Membership;
//   2. the professional's 5% commission, billed monthly in arrears.
// It is NEVER used for the price of a job. Collecting a customer's money and
// paying it on to a worker is money transmission, licensed by Bank of Jamaica
// and not permitted on an ordinary local merchant account — so job money goes
// customer → professional directly and the app only records it.
//
// EVERYTHING WORKS WITH NOTHING CONFIGURED. `paymentsConfigured()` is false
// until the merchant credentials exist; every card surface stays hidden, every
// action refuses politely, and the app is fully usable. That is not a
// nice-to-have: the owner has no merchant account yet.
//
// -----------------------------------------------------------------------------
// ASSUMED WIRE CONTRACT — VERIFY THIS WITH FAC/WiPay BEFORE GOING LIVE
// -----------------------------------------------------------------------------
// This was written without access to a live merchant account. Every assumption
// is listed here, and every one of them is a single edit inside this file.
//
// Transport
//   POST `${POWERTRANZ_BASE_URL}${path}` with JSON bodies and these headers:
//     PowerTranz-PowerTranzId:       <POWERTRANZ_MERCHANT_ID>
//     PowerTranz-PowerTranzPassword: <POWERTRANZ_PASSWORD>
//     Content-Type: application/json
//   POWERTRANZ_BASE_URL is expected to end at the API root, e.g.
//     https://staging.ptranz.com/api   (test)
//     https://gateway.ptranz.com/api   (production)
//
// Paths (PATHS below)
//   /spi/Auth     hosted 3DS authorization — used for card SETUP (tokenize)
//   /spi/Payment  completes an /spi/Auth after the 3DS redirect, given SpiToken
//   /spi/Sale     merchant-initiated sale against a stored credential
//   /spi/Void     void an authorization (used to release the setup auth)
//   /spi/Refund   refund a settled transaction
//
// Request fields we send (GatewayRequest)
//   TransactionIdentifier  our own UUID per attempt (idempotency handle)
//   TotalAmount            DECIMAL MAJOR UNITS, not cents (12.34, not 1234)
//   CurrencyCode           ISO-4217 NUMERIC string — "840" for USD
//   OrderIdentifier        our reference (see PaymentReference below), ≤50 chars
//   ThreeDSecure           true on card setup, false on merchant-initiated
//   Source                 { Token } for stored credentials
//   Tokenize               true on setup, so the response carries a PAN token
//   ExtendedData.MerchantResponseUrl  absolute URL the ACS posts back to
//
// Response fields we read (GatewayResponse)
//   Approved            boolean
//   TransactionIdentifier / RRN     the handle refunds and voids reference
//   IsoResponseCode + ResponseMessage   decline reason
//   RedirectData        an HTML <form> the browser must POST to the ACS
//   SpiToken            opaque handle that /spi/Payment exchanges for a result
//   OrderIdentifier     echoed back — this is how the callback learns who/what
//   PanToken            the stored-credential handle we persist (never a PAN)
//   CardBrand, CardPan (masked, last 4), ExpirationDate ("MMYY")
//
// THINGS TO CONFIRM WITH THE ACQUIRER
//   * amount format (major units vs cents) and currency code format
//   * whether JMD is supported and what its numeric code should be
//   * the exact stored-credential field on /spi/Sale (Source.Token vs
//     Source.PanToken vs PaymentAccountDataToken)
//   * whether a ZERO-value account-verification Auth is permitted; if not, set
//     POWERTRANZ_SETUP_AMOUNT_CENTS to a small amount (it is voided
//     immediately either way)
//   * the expiry format returned on ExpirationDate (MMYY assumed)
//   * whether the browser POST back to MerchantResponseUrl is signed. We do
//     NOT rely on it being signed: the callback re-queries the gateway with
//     the SpiToken and only trusts THAT answer (see verifyCallback).
//
// SWAPPING IN WiPay. WiPay resells the same rails with a hosted-page API: a
// request returns a payment URL instead of an HTML form, and the customer
// comes back to a return URL. Only this file changes — `startCardSetup` would
// return that URL directly (the local bridge below becomes unused), and
// `verifyCallback` would re-query WiPay's transaction lookup instead of
// exchanging an SpiToken. Nothing outside this module knows the difference.
// =============================================================================

const PATHS = {
  auth: "/spi/Auth",
  payment: "/spi/Payment",
  sale: "/spi/Sale",
  void: "/spi/Void",
  refund: "/spi/Refund",
} as const;

const REQUEST_TIMEOUT_MS = 20_000;

// --- Configuration ----------------------------------------------------------

export function paymentsConfigured(): boolean {
  return Boolean(
    process.env.POWERTRANZ_MERCHANT_ID &&
      process.env.POWERTRANZ_PASSWORD &&
      process.env.POWERTRANZ_BASE_URL
  );
}

// ISO-4217 NUMERIC code. lib/constants.ts CURRENCY is the alpha code used for
// display; the gateway wants the number.
function currencyCode(): string {
  return process.env.POWERTRANZ_CURRENCY_CODE ?? "840";
}

// Card setup runs an authorization that is voided straight afterwards. Zero is
// the correct "account verification" amount where the acquirer allows it; if
// yours does not, set a small amount here — it is never captured.
function setupAmountCents(): number {
  const raw = Number(process.env.POWERTRANZ_SETUP_AMOUNT_CENTS);
  return Number.isFinite(raw) && raw >= 0 ? raw : 0;
}

export function appUrl(path: string): string {
  const base = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  return `${base}${path}`;
}

// --- References -------------------------------------------------------------
//
// The reference is stamped on the gateway transaction as OrderIdentifier and
// comes back to us inside the gateway's OWN authenticated response. It is
// therefore the only piece of callback context we are willing to trust, and it
// carries everything the callback needs. Kept under 50 characters because that
// is the documented OrderIdentifier limit.

export type CardSetupReturn = "membership" | "welcome" | "earnings";

const RETURN_SLOTS: Record<CardSetupReturn, string> = {
  membership: "m",
  welcome: "w",
  earnings: "e",
};

export const CARD_SETUP_RETURN_PATHS: Record<CardSetupReturn, string> = {
  membership: "/membership",
  welcome: "/welcome",
  earnings: "/worker/earnings",
};

export type PaymentReference =
  | { kind: "card_setup"; userId: string; returnTo: CardSetupReturn }
  | { kind: "membership"; userId: string }
  | { kind: "fee_invoice"; invoiceId: string };

function packUuid(id: string): string {
  return id.replace(/-/g, "");
}

// 8-4-4-4-12. Returns null when the packed form is not 32 hex characters, so a
// malformed reference can never be mistaken for a real row id.
function unpackUuid(packed: string): string | null {
  if (!/^[0-9a-f]{32}$/i.test(packed)) return null;
  return [
    packed.slice(0, 8),
    packed.slice(8, 12),
    packed.slice(12, 16),
    packed.slice(16, 20),
    packed.slice(20),
  ]
    .join("-")
    .toLowerCase();
}

export function encodeReference(ref: PaymentReference): string {
  switch (ref.kind) {
    case "card_setup":
      return `cs${RETURN_SLOTS[ref.returnTo]}${packUuid(ref.userId)}`;
    case "membership":
      return `mb${packUuid(ref.userId)}`;
    case "fee_invoice":
      return `fi${packUuid(ref.invoiceId)}`;
  }
}

export function decodeReference(raw: string | null | undefined): PaymentReference | null {
  if (!raw) return null;
  const kind = raw.slice(0, 2);
  if (kind === "cs") {
    const slot = raw.slice(2, 3);
    const returnTo = (
      Object.keys(RETURN_SLOTS) as CardSetupReturn[]
    ).find((k) => RETURN_SLOTS[k] === slot);
    const userId = unpackUuid(raw.slice(3));
    if (!returnTo || !userId) return null;
    return { kind: "card_setup", userId, returnTo };
  }
  if (kind === "mb") {
    const userId = unpackUuid(raw.slice(2));
    return userId ? { kind: "membership", userId } : null;
  }
  if (kind === "fi") {
    const invoiceId = unpackUuid(raw.slice(2));
    return invoiceId ? { kind: "fee_invoice", invoiceId } : null;
  }
  return null;
}

// --- Wire shapes ------------------------------------------------------------

type GatewayRequest = Record<string, unknown>;

type GatewayError = { Code?: string; Message?: string };

type GatewayResponse = {
  Approved?: boolean;
  TransactionIdentifier?: string;
  OriginalTrxnIdentifier?: string;
  RRN?: string;
  OrderIdentifier?: string;
  TotalAmount?: number;
  CurrencyCode?: string;
  IsoResponseCode?: string;
  ResponseMessage?: string;
  RedirectData?: string;
  SpiToken?: string;
  PanToken?: string;
  CardBrand?: string;
  CardPan?: string;
  ExpirationDate?: string;
  Errors?: GatewayError[];
};

type Transport =
  | { ok: true; body: GatewayResponse }
  // `retryable` separates "the gateway said no" (a decline — do not retry the
  // same card blindly) from "we could not reach the gateway" (retry later).
  | { ok: false; retryable: boolean; message: string };

function describeErrors(body: GatewayResponse): string {
  const fromErrors = (body.Errors ?? [])
    .map((e) => e.Message ?? e.Code)
    .filter((m): m is string => Boolean(m))
    .join("; ");
  return (
    fromErrors ||
    body.ResponseMessage ||
    (body.IsoResponseCode ? `Gateway response ${body.IsoResponseCode}` : "") ||
    "The card was not accepted."
  );
}

async function post(path: string, body: unknown): Promise<Transport> {
  if (!paymentsConfigured()) {
    return {
      ok: false,
      retryable: false,
      message: "Card payments are not set up yet.",
    };
  }
  const base = (process.env.POWERTRANZ_BASE_URL ?? "").replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "PowerTranz-PowerTranzId": process.env.POWERTRANZ_MERCHANT_ID ?? "",
        "PowerTranz-PowerTranzPassword": process.env.POWERTRANZ_PASSWORD ?? "",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      parsed = null;
    }
    if (!res.ok) {
      return {
        ok: false,
        // 5xx and 429 are worth another attempt; a 4xx means our request is
        // wrong and repeating it changes nothing.
        retryable: res.status >= 500 || res.status === 429,
        message: `Gateway returned ${res.status}.`,
      };
    }
    if (parsed === null || typeof parsed !== "object") {
      return { ok: false, retryable: true, message: "Unreadable gateway response." };
    }
    return { ok: true, body: parsed as GatewayResponse };
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      message:
        error instanceof Error ? error.message : "Could not reach the gateway.",
    };
  }
}

// Gateway amounts are decimal major units, ours are integer cents.
function toMajorUnits(cents: number): number {
  return Math.round(cents) / 100;
}

// --- Stored cards -----------------------------------------------------------

export type StoredCard = {
  token: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

// "MMYY" → { month, year }. Any other shape yields nulls rather than a wrong
// expiry date on someone's card list.
function parseExpiry(raw: string | undefined): {
  expMonth: number | null;
  expYear: number | null;
} {
  if (!raw || !/^\d{4}$/.test(raw)) return { expMonth: null, expYear: null };
  const month = Number(raw.slice(0, 2));
  const year = 2000 + Number(raw.slice(2));
  if (month < 1 || month > 12) return { expMonth: null, expYear: null };
  return { expMonth: month, expYear: year };
}

function readCard(body: GatewayResponse): StoredCard | null {
  const token = body.PanToken;
  if (!token) return null;
  const pan = body.CardPan ?? "";
  const digits = pan.replace(/\D/g, "");
  return {
    token,
    brand: body.CardBrand ?? null,
    last4: digits.length >= 4 ? digits.slice(-4) : null,
    ...parseExpiry(body.ExpirationDate),
  };
}

// --- The local redirect bridge ----------------------------------------------
//
// PowerTranz hands back an HTML <form> (RedirectData) that the browser must
// POST to the issuer's 3DS page, not a URL. Callers want a URL, so we park the
// form for a few minutes and hand back a link to a route that serves it once.
//
// This is a pre-redirect handoff and NOTHING is promoted from it: losing the
// entry on a restart just means "start again". Money is only ever recognised
// in verifyCallback, which re-queries the gateway. A hosted-page gateway
// (WiPay) returns a URL directly and never touches this.
const REDIRECT_TTL_MS = 10 * 60_000;

const redirectStore = ((
  globalThis as unknown as {
    __ptRedirects?: Map<string, { html: string; expiresAt: number }>;
  }
).__ptRedirects ??= new Map<string, { html: string; expiresAt: number }>());

function parkHostedPage(html: string): string {
  const now = Date.now();
  for (const [key, entry] of redirectStore) {
    if (entry.expiresAt <= now) redirectStore.delete(key);
  }
  const handle = randomUUID();
  redirectStore.set(handle, { html, expiresAt: now + REDIRECT_TTL_MS });
  return handle;
}

// Single-use: the entry is removed on read, so a shared link is inert.
export function takeHostedPage(handle: string): string | null {
  const entry = redirectStore.get(handle);
  redirectStore.delete(handle);
  if (!entry || entry.expiresAt <= Date.now()) return null;
  return entry.html;
}

export const HOSTED_PAGE_ROUTE = "/api/payments/powertranz/redirect";

// --- Card setup (tokenization) ----------------------------------------------

export type CardSetupStart =
  | { ok: true; url: string }
  | { ok: false; message: string };

// Begin a hosted 3DS authorization purely to obtain a stored-credential token.
// The authorization is voided as soon as the callback lands, so no money is
// taken. Returns a URL to send the browser to.
export async function startCardSetup(opts: {
  userId: string;
  returnPath: CardSetupReturn;
}): Promise<CardSetupStart> {
  if (!paymentsConfigured()) {
    return { ok: false, message: "Card payments are not set up yet." };
  }
  const reference = encodeReference({
    kind: "card_setup",
    userId: opts.userId,
    returnTo: opts.returnPath,
  });
  const request: GatewayRequest = {
    TransactionIdentifier: randomUUID(),
    TotalAmount: toMajorUnits(setupAmountCents()),
    CurrencyCode: currencyCode(),
    OrderIdentifier: reference,
    ThreeDSecure: true,
    Tokenize: true,
    AddressMatch: false,
    ExtendedData: {
      MerchantResponseUrl: appUrl("/api/payments/powertranz/callback"),
      ThreeDSecure: { ChallengeWindowSize: 4, ChallengeIndicator: "01" },
    },
  };

  const res = await post(PATHS.auth, request);
  if (!res.ok) return { ok: false, message: res.message };

  // Hosted-page gateways answer with a URL; PowerTranz answers with a form.
  const redirect = res.body.RedirectData;
  if (typeof redirect === "string" && /^https?:\/\//i.test(redirect.trim())) {
    return { ok: true, url: redirect.trim() };
  }
  if (typeof redirect === "string" && redirect.trim().length > 0) {
    const handle = parkHostedPage(redirect);
    return { ok: true, url: `${HOSTED_PAGE_ROUTE}?h=${handle}` };
  }
  return { ok: false, message: describeErrors(res.body) };
}

// --- Merchant-initiated charge against a stored credential ------------------

export type ChargeResult =
  | { ok: true; transactionId: string }
  // `declined` = the gateway answered and said no. False means we never got a
  // clean answer, so the charge may be retried without a new card.
  | { ok: false; declined: boolean; message: string };

export async function chargeStoredCard(opts: {
  token: string;
  amountCents: number;
  reference: string;
  description: string;
}): Promise<ChargeResult> {
  if (!paymentsConfigured()) {
    return {
      ok: false,
      declined: false,
      message: "Card payments are not set up yet.",
    };
  }
  if (opts.amountCents <= 0) {
    return { ok: false, declined: false, message: "Nothing to charge." };
  }
  const request: GatewayRequest = {
    TransactionIdentifier: randomUUID(),
    TotalAmount: toMajorUnits(opts.amountCents),
    CurrencyCode: currencyCode(),
    OrderIdentifier: opts.reference,
    // Merchant-initiated: the cardholder is not present, so there is no 3DS
    // challenge to run. The credential was authenticated when it was stored.
    ThreeDSecure: false,
    Source: { Token: opts.token },
    OrderDescription: opts.description,
  };

  const res = await post(PATHS.sale, request);
  if (!res.ok) {
    return { ok: false, declined: !res.retryable, message: res.message };
  }
  const transactionId =
    res.body.TransactionIdentifier ?? res.body.RRN ?? null;
  if (res.body.Approved === true && transactionId) {
    return { ok: true, transactionId };
  }
  return { ok: false, declined: true, message: describeErrors(res.body) };
}

// --- Void / refund ----------------------------------------------------------

// Release an authorization that was never meant to be captured (card setup).
export async function voidTransaction(transactionId: string): Promise<boolean> {
  if (!paymentsConfigured() || !transactionId) return false;
  const res = await post(PATHS.void, {
    TransactionIdentifier: randomUUID(),
    OriginalTrxnIdentifier: transactionId,
  });
  return res.ok && res.body.Approved === true;
}

// Refund a settled charge. Only ever used on platform revenue (a membership
// charge or a commission invoice) — the platform holds no job money, so there
// is nothing else it could refund. Returns false rather than throwing.
export async function refundTransaction(
  transactionId: string,
  amountCents: number
): Promise<boolean> {
  if (!paymentsConfigured() || !transactionId || amountCents <= 0) return false;
  const res = await post(PATHS.refund, {
    TransactionIdentifier: randomUUID(),
    OriginalTrxnIdentifier: transactionId,
    TotalAmount: toMajorUnits(amountCents),
    CurrencyCode: currencyCode(),
    Refund: true,
  });
  return res.ok && res.body.Approved === true;
}

// --- Callback verification --------------------------------------------------

export type CallbackPayload = {
  spiToken?: string | null;
};

export type CallbackResult =
  | {
      ok: true;
      approved: boolean;
      reference: PaymentReference | null;
      transactionId: string | null;
      message: string;
      card: StoredCard | null;
    }
  | { ok: false; message: string };

// Validate a return from the gateway.
//
// The browser POST that lands on our callback route is attacker-controllable
// and is NEVER trusted on its own. The only thing taken from it is the opaque
// SpiToken, which is then exchanged server-to-server (authenticated with our
// merchant credentials) for the authoritative result. Everything the caller
// acts on — approved, the reference, the card token — comes from that second
// call, not from the redirect.
//
// PowerTranz does not sign the browser POST. If FAC enables an HMAC on the
// response for your account, verify it here IN ADDITION to the re-query; do
// not replace the re-query with it.
export async function verifyCallback(
  payload: CallbackPayload
): Promise<CallbackResult> {
  if (!paymentsConfigured()) {
    return { ok: false, message: "Card payments are not set up yet." };
  }
  const spiToken = payload.spiToken?.trim();
  if (!spiToken) {
    return { ok: false, message: "Missing gateway token." };
  }

  // FAC's /spi/Payment takes the SpiToken as the entire JSON body (a bare JSON
  // string), not an object. If your account expects `{ SpiToken: "…" }`, that
  // is the one line to change.
  const res = await post(PATHS.payment, spiToken);
  if (!res.ok) return { ok: false, message: res.message };

  return {
    ok: true,
    approved: res.body.Approved === true,
    reference: decodeReference(res.body.OrderIdentifier),
    transactionId: res.body.TransactionIdentifier ?? res.body.RRN ?? null,
    message: res.body.Approved === true ? "Approved" : describeErrors(res.body),
    card: readCard(res.body),
  };
}
