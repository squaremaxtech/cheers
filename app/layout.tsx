import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Display face for headings and the wordmark. Playfair Display is the serif
// that carries the dark, evening-out voice of the brand; body copy stays on
// Geist. Exposed as --font-display, which globals.css reads.
const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

// Every page renders per-request: the app is auth- and DB-backed throughout,
// so build-time prerendering would both require DB access during `next build`
// and bake stale data into static HTML.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "CheersJA — Jamaica's Events & Entertainment Marketplace",
    template: "%s · CheersJA",
  },
  description:
    "Book the people who make an event happen — DJs, MCs, sound and lighting, performers, caterers, bartenders, décor, photographers, event security and staging, right across Jamaica.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
