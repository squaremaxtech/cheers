import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import EmailProvider from "next-auth/providers/email";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, users, verificationTokens } from "@/db/schema";
import type { UserRow } from "@/types";

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
  },
  providers: [
    EmailProvider({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM ?? `Cheers <${process.env.EMAIL_SERVER_USER}>`,
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    session({ session, user }) {
      session.user.id = user.id;
      session.user.role = user.role;
      session.user.suspended = user.suspended;
      return session;
    },
    signIn({ user }) {
      // Suspended accounts cannot sign in.
      return !user.suspended;
    },
  },
};

// Returns the signed-in user's full DB row, or null when signed out.
export async function getUserRow(): Promise<UserRow | null> {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id;
  if (!id) return null;
  const [user] = await db.select().from(users).where(eq(users.id, id));
  return user ?? null;
}
