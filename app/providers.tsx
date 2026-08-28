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
          // Light theme: a white card with hairline border and ink text,
          // matching .card in globals.css.
          style: {
            background: "#ffffff",
            color: "#16140f",
            border: "1px solid #e5e2da",
            boxShadow: "0 10px 30px -18px rgba(22, 20, 15, 0.35)",
          },
        }}
      />
    </SessionProvider>
  );
}
