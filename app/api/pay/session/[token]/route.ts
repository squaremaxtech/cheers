import { getRedirectPage } from "@/lib/powertranz";

// Serves the gateway's RedirectData HTML (PowerTranz hosted card page +
// 3DS challenge) that a checkout action parked in memory. Tokens are
// single-purpose UUIDs with a short TTL; an expired token just sends the
// customer back to their bookings.
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/pay/session/[token]">
): Promise<Response> {
  const { token } = await ctx.params;
  const html = getRedirectPage(token);
  if (!html) {
    return new Response(
      `<!doctype html><html><body><p>This payment session has expired.</p>
<script>setTimeout(function(){ window.location.replace("/bookings"); }, 1500);</script>
</body></html>`,
      { status: 410, headers: { "content-type": "text/html; charset=utf-8" } }
    );
  }
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
