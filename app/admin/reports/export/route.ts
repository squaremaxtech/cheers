import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, payments, users, workers } from "@/db/schema";
import { GuardError, requireStaff } from "@/lib/guards";

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  return [
    headers.join(","),
    ...rows.map((r) => r.map(csvEscape).join(",")),
  ].join("\n");
}

export async function GET(req: Request): Promise<Response> {
  try {
    await requireStaff();
  } catch (error) {
    if (error instanceof GuardError) {
      return Response.json({ error: error.code }, { status: 403 });
    }
    throw error;
  }

  const type = new URL(req.url).searchParams.get("type");

  if (type === "payments") {
    const rows = await db
      .select({ payment: payments, code: bookings.code })
      .from(payments)
      .innerJoin(bookings, eq(payments.bookingId, bookings.id))
      .orderBy(desc(payments.createdAt));
    const csv = toCsv(
      ["date", "booking", "amount", "tip", "platform_fee", "method", "status"],
      rows.map(({ payment, code }) => [
        payment.createdAt.toISOString(),
        code,
        (payment.amountCents / 100).toFixed(2),
        (payment.tipCents / 100).toFixed(2),
        (payment.platformFeeCents / 100).toFixed(2),
        payment.method,
        payment.status,
      ])
    );
    return new Response(csv, {
      headers: {
        "content-type": "text/csv",
        "content-disposition": "attachment; filename=payments.csv",
      },
    });
  }

  // default: bookings
  const rows = await db
    .select({
      booking: bookings,
      stageName: workers.stageName,
      customerEmail: users.email,
    })
    .from(bookings)
    .innerJoin(workers, eq(bookings.workerId, workers.id))
    .innerJoin(users, eq(bookings.customerId, users.id))
    .orderBy(desc(bookings.createdAt));
  const csv = toCsv(
    [
      "created",
      "code",
      "service",
      "worker",
      "customer",
      "date",
      "start",
      "duration_min",
      "price",
      "addons",
      "tip",
      "platform_fee",
      "status",
    ],
    rows.map(({ booking, stageName, customerEmail }) => [
      booking.createdAt.toISOString(),
      booking.code,
      booking.serviceName,
      stageName,
      customerEmail,
      booking.date,
      booking.startTime,
      booking.durationMinutes,
      (booking.priceCents / 100).toFixed(2),
      (booking.addonsCents / 100).toFixed(2),
      (booking.tipCents / 100).toFixed(2),
      (booking.platformFeeCents / 100).toFixed(2),
      booking.status,
    ])
  );
  return new Response(csv, {
    headers: {
      "content-type": "text/csv",
      "content-disposition": "attachment; filename=bookings.csv",
    },
  });
}
