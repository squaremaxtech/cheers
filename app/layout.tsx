import type { Metadata } from "next";
import { Geist, Playfair_Display } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { authApiPath } from "@/lib/auth";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin"],
});

// Every page renders per-request: the app is auth- and DB-backed throughout,
// so build-time prerendering would both require DB access during `next build`
// and bake stale data into static HTML.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Cheers — Premium Event Companions & Wellness, Jamaica",
    template: "%s · Cheers",
  },
  description:
    "Book verified massage professionals and event entertainment across Jamaica. Premium, private, professional.",
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
        <Providers authBasePath={authApiPath}>{children}</Providers>
      </body>
    </html>
  );
}
