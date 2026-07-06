import type { DefaultSession } from "next-auth";
import type { users } from "@/db/schema";

type Role = (typeof users.$inferSelect)["role"];

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      suspended: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    role: Role;
    suspended: boolean;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    role: Role;
    suspended: boolean;
  }
}

// @auth/drizzle-adapter is typed against @auth/core; keep its AdapterUser in
// sync so the adapter remains assignable to next-auth v4's Adapter type.
declare module "@auth/core/adapters" {
  interface AdapterUser {
    role: Role;
    suspended: boolean;
  }
}
