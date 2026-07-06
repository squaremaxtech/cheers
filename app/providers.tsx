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
          style: {
            background: "#201c19",
            color: "#faf7f2",
            border: "1px solid #2c2724",
          },
        }}
      />
    </SessionProvider>
  );
}
