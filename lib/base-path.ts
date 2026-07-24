// Single source of truth for the deployment sub-path (also consumed by
// next.config.ts). `basePath` is inlined into the client bundle at build time,
// so a shared literal is the simplest isomorphic way for code to prefix
// same-origin URLs.
//
// Next.js auto-prefixes the basePath onto `next/link` and `next/router` only.
// It does NOT touch raw <img>/<video> `src`, <a> `href`, `fetch()`, or
// `EventSource()` targets — those hit our /api/media and /api/* routes and must
// be prefixed by hand. (Stored media URLs stay bare, e.g. "/api/media/…", so
// the DB and the route handlers never depend on where the app is mounted.)
export const BASE_PATH = "/client-websites/cheers";

// Prefixes a root-relative, same-origin URL with BASE_PATH. Absolute
// (http[s]://) and protocol-relative (//) URLs — external media is allowed — and
// already-prefixed paths are returned unchanged, so this is safe to apply once
// at each render/fetch site.
export function withBasePath(url: string): string {
  if (!url.startsWith("/") || url.startsWith("//")) return url;
  if (url === BASE_PATH || url.startsWith(`${BASE_PATH}/`)) return url;
  return `${BASE_PATH}${url}`;
}
