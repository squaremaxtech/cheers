import { takeHostedPage } from "@/lib/payments/powertranz";

// The 3DS hand-off page.
//
// PowerTranz answers a card-setup authorization with an HTML <form> that the
// browser must POST to the issuer's 3-D Secure page — not with a URL. The
// adapter parks that form for a few minutes and hands callers a link here.
//
// Nothing is promoted from this route: it carries no money, no session state
// and no decision. A card is only ever recognised in the callback, which
// re-queries the gateway. The handle is single-use, so a shared or replayed
// link renders nothing.
export async function GET(req: Request): Promise<Response> {
  const handle = new URL(req.url).searchParams.get("h");
  const html = handle ? takeHostedPage(handle) : null;
  if (!html) {
    return new Response(
      "<!doctype html><meta charset=\"utf-8\"><title>Link expired</title>" +
        "<p>This secure payment link has expired. Go back and try again.</p>",
      {
        status: 410,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      }
    );
  }

  return new Response(
    `<!doctype html><meta charset="utf-8"><title>Contacting your bank…</title>` +
      `<p>Contacting your bank to verify this card…</p>${html}`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    }
  );
}
