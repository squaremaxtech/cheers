import type { Metadata } from "next";
import { Geist, Manrope } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Display face for headings and the wordmark. Manrope carries the light,
// professional voice the serif no longer fits; only the three heading weights
// are downloaded.
const manrope = Manrope({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

// Every page renders per-request: the app is auth- and DB-backed throughout,
// so build-time prerendering would both require DB access during `next build`
// and bake stale data into static HTML.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "Cheers — Jamaica's Premium Freelance Platform",
    template: "%s · Cheers",
  },
  description:
    "Hire trusted professionals across Jamaica — electricians, DJs, cleaners, photographers, tutors and more. Browse, message, and book in minutes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
