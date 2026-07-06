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
    role?: Role;
    suspended?: boolean;
  }
}

// role/suspended are declared OPTIONAL on purpose: npm may install a second,
// nested copy of @auth/core under @auth/drizzle-adapter (it did on the VPS),
// and augmentations only reach the copy TypeScript resolves from here. With
// required fields, the un-augmented nested copy's AdapterUser is no longer
// assignable and `next build` fails. Optional fields keep every copy
// compatible; consumers default them (the DB columns are NOT NULL, so the
// values are always present at runtime).
declare module "next-auth/adapters" {
  interface AdapterUser {
    role?: Role;
    suspended?: boolean;
  }
}

declare module "@auth/core/adapters" {
  interface AdapterUser {
    role?: Role;
    suspended?: boolean;
  }
}
