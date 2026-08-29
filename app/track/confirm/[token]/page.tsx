import { and, eq, gt } from "drizzle-orm";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db } from "@/db";
import { trustedContacts } from "@/db/schema";
import { TRACK_VIEWS_PER_MINUTE } from "@/lib/constants";
import { rateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/safety/session";

export const metadata: Metadata = {
  title: "Confirm safety contact",
  robots: { index: false, follow: false },
};

// Consent gate for trusted contacts. Nobody is contacted in an emergency
// unless they have agreed to be — being woken at 3am about someone else's
// safety is not something to opt a person into without asking.
//
// Confirming is a state change, so this consumes the token: single-use, and
// the row keeps no reusable credential afterwards.
export default async function ConfirmContactPage(
  props: PageProps<"/track/confirm/[token]">
) {
  const { token } = await props.params;
  // Global to the route, not per token — see the note in /track/[token].
  if (!rateLimit("track:confirm", TRACK_VIEWS_PER_MINUTE, 60_000)) {
    notFound();
  }

  const [contact] = await db
    .select()
    .from(trustedContacts)
    .where(
      and(
        eq(trustedContacts.verifyTokenHash, hashToken(token)),
        gt(trustedContacts.verifyExpiresAt, new Date())
      )
    );
  if (!contact) notFound();

  if (!contact.verifiedAt) {
    await db
      .update(trustedContacts)
      .set({
        verifiedAt: new Date(),
        // Burn the token: a confirmation link is good exactly once.
        verifyTokenHash: null,
        verifyExpiresAt: null,
      })
      .where(eq(trustedContacts.id, contact.id));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="card space-y-4 p-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-faint">CheersJA safety</p>
        <p className="font-display text-2xl text-success">You&apos;re confirmed</p>
        <p className="text-sm text-muted">
          Thank you, {contact.name}. You&apos;ll receive a live tracking link
          when a booking starts, and we&apos;ll contact you if we can&apos;t
          reach them.
        </p>
        <p className="border-t border-hairline pt-4 text-xs text-faint">
          You can be removed at any time by the person who added you. We never
          share who they&apos;re with or where they&apos;re working.
        </p>
      </div>
    </main>
  );
}
