import { notify } from "@/lib/notify";
import { saveCardOnFile } from "@/lib/payments/cards";
import {
  CARD_SETUP_RETURN_PATHS,
  appUrl,
  paymentsConfigured,
  verifyCallback,
  voidTransaction,
  type PaymentReference,
} from "@/lib/payments/powertranz";

// The gateway's return endpoint.
//
// The browser lands here after 3-D Secure, carrying an SpiToken. NOTHING in
// this request is trusted: the token is exchanged server-to-server (with our
// merchant credentials) for the authoritative result, and only that answer is
// acted on — including who the transaction belongs to, which comes back as the
// reference we stamped on it.
//
// Idempotent by construction. The only state it writes is the user's single
// card row, keyed on userId, so a replayed callback re-writes the same values
// and changes nothing. It never promotes a payment: the platform takes no job
// money, and membership/commission charges are merchant-initiated and settle
// synchronously with no callback at all.

export async function POST(req: Request): Promise<Response> {
  return handle(req);
}

// Some acquirer configurations return with a GET. Same treatment: the token is
// the only thing read, and it is verified before anything happens.
export async function GET(req: Request): Promise<Response> {
  return handle(req);
}

async function handle(req: Request): Promise<Response> {
  if (!paymentsConfigured()) {
    return new Response("not configured", { status: 503 });
  }

  const spiToken = await readToken(req);
  if (!spiToken) return redirectTo("/membership", "card=failed");

  const result = await verifyCallback({ spiToken });
  if (!result.ok) {
    console.error("[payments] callback verification failed:", result.message);
    return redirectTo("/membership", "card=failed");
  }

  const reference = result.reference;
  if (!reference || reference.kind !== "card_setup") {
    // A merchant-initiated charge has no browser leg, so there is nothing to
    // do here beyond getting the person somewhere sensible.
    return redirectTo(returnPathFor(reference), "card=failed");
  }

  const returnPath = CARD_SETUP_RETURN_PATHS[reference.returnTo];
  if (!result.approved || !result.card) {
    return redirectTo(returnPath, "card=declined");
  }

  try {
    await saveCardOnFile({
      userId: reference.userId,
      card: result.card,
      gatewayCustomerId: result.card.token,
    });
    // The setup authorization exists only to prove the card works. Release it
    // immediately so no hold sits on the cardholder's account.
    if (result.transactionId) await voidTransaction(result.transactionId);

    await notify({
      userId: reference.userId,
      type: "card_saved",
      title: "Card saved",
      body: `${result.card.brand ?? "Your card"}${
        result.card.last4 ? ` ending ${result.card.last4}` : ""
      } is now on file. It is only ever charged for your CheersJA Membership or your monthly commission — never for a job.`,
      email: false,
    });
  } catch (error) {
    console.error(
      "[payments] storing card failed:",
      error instanceof Error ? error.message : error
    );
    return redirectTo(returnPath, "card=failed");
  }

  return redirectTo(returnPath, "card=added");
}

// The gateway posts either a form body or JSON depending on configuration.
async function readToken(req: Request): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get("SpiToken");
  if (fromQuery) return fromQuery;
  if (req.method === "GET") return null;

  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const body: unknown = await req.json();
      if (body && typeof body === "object" && "SpiToken" in body) {
        const value = (body as { SpiToken?: unknown }).SpiToken;
        return typeof value === "string" ? value : null;
      }
      return null;
    }
    const form = await req.formData();
    const value = form.get("SpiToken");
    return typeof value === "string" ? value : null;
  } catch {
    return null;
  }
}

function returnPathFor(reference: PaymentReference | null): string {
  if (reference?.kind === "fee_invoice") return "/worker/earnings";
  return "/membership";
}

function redirectTo(path: string, query: string): Response {
  return Response.redirect(appUrl(`${path}?${query}`), 303);
}
