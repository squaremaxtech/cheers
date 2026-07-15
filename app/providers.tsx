"use client";

import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";

export default function Providers({
  children,
  authBasePath,
}: {
  children: React.ReactNode;
  // Path to the auth API (NEXTAUTH_URL's path). Passed in from the server
  // layout because client bundles can't read non-NEXT_PUBLIC env vars.
  authBasePath: string;
}) {
  return (
    <SessionProvider basePath={authBasePath}>
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
