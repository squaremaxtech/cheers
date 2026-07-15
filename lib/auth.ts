import { cache } from "react";
import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import { mailFrom, smtpConfig } from "@/lib/mailer";
import { touchPresence } from "@/lib/presence";
import type { UserRow } from "@/types";

// NEXTAUTH_URL must point at the auth API endpoint in full, e.g.
// "http://localhost:3010/client-websites/cheers/api/auth". Everything below
// derives from it so the subpath is configured in one place (.env +
// next.config.ts basePath, which must be inlined at build time).
export const authApiPath = new URL(process.env.NEXTAUTH_URL!).pathname.replace(/\/$/, "");
const basePath = authApiPath.replace(/\/api\/auth$/, "");

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  pages: {
    // next-auth emits these as Location headers resolved against the origin,
    // so they need the basePath prefix (next/link-style auto-prefixing does
    // not apply here).
    signIn: `${basePath}/login`,
    verifyRequest: `${basePath}/verify`,
  },
  providers: [
    EmailProvider({
      server: smtpConfig,
      from: mailFrom,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    // next-auth v4 resolves relative callbackUrls against the bare origin
    // (its baseUrl is url.origin, path dropped), which sends users to
    // e.g. /dashboard instead of /client-websites/cheers/dashboard. Re-apply
    // the basePath so signIn({ callbackUrl }) keeps taking app-relative paths.
    redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        const path =
          url === basePath || url.startsWith(`${basePath}/`)
            ? url
            : `${basePath}${url}`;
        return `${baseUrl}${path}`;
      }
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}${basePath}`;
    },
    session({ session, user }) {
      session.user.id = user.id;
      // Fallbacks mirror the DB column defaults; see types/next-auth.d.ts for
      // why the adapter types carry these as optional.
      session.user.role = user.role ?? "customer";
      session.user.suspended = user.suspended ?? false;
      return session;
    },
    signIn({ user }) {
      // Suspended accounts cannot sign in.
      return !user.suspended;
    },
  },
};

// Returns the signed-in user's full DB row, or null when signed out.
// Wrapped in React cache(): header, layout, and page all call this in one
// request — it runs once.
export const getUserRow = cache(async (): Promise<UserRow | null> => {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id));
  // Every authenticated request counts as platform activity (chat presence).
  if (user) touchPresence(user.id);
  return user ?? null;
});
