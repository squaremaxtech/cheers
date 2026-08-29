"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export default function Providers({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      {children}
      <Toaster
        position="top-right"
        toastOptions={{
          // Dark theme: a raised card with a hairline border and ink text,
          // matching .card in globals.css. react-hot-toast renders these
          // inline, outside the stylesheet, so the values are literal.
          style: {
            background: "#201c19",
            color: "#faf7f2",
            border: "1px solid #2c2724",
            boxShadow: "0 18px 40px -24px rgba(0, 0, 0, 0.8)",
          },
        }}
      />
    </SessionProvider>
  );
}
