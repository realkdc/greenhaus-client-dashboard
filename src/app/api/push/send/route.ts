import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";
import { sendExpoMessages } from "@/lib/expo";

type TicketRecord = {
  token: string;
  ticketId: string;
  status: string;
  error: string | null;
  createdAt: Date;
};

type ReceiptRecord = TicketRecord;

const ERROR_CODES_TO_PRUNE = new Set(["DeviceNotRegistered", "InvalidCredentials"]);

async function deleteToken(token: string): Promise<void> {
  if (!token) return;
  try {
    await adminDb.collection("pushTokens").doc(token).delete();
  } catch (error) {
    console.warn("Failed to delete invalid token", token, error);
  }
}

async function recordTicket(record: TicketRecord): Promise<void> {
  const ticketRef = adminDb.collection("pushTickets").doc(record.ticketId);
  await ticketRef.set(record, { merge: true });
}

async function recordReceipt(record: ReceiptRecord): Promise<void> {
  const receiptRef = adminDb.collection("pushReceipts").doc(record.ticketId);
  await receiptRef.set(record, { merge: true });
}

export const runtime = "nodejs";

const payloadSchema = z.object({
  to: z.string().min(1, "Token is required"),
  title: z.string().min(1),
  body: z.string().min(1),
  data: z.record(z.unknown()).optional(),
});

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);

    const tickets = await sendExpoMessages([payload.to], {
      title: payload.title,
      body: payload.body,
      data: payload.data,
    });

    const now = new Date();

    const processedTickets = await Promise.all(
      tickets.map(async (ticket) => {
        const ticketId = ticket.id ?? `${payload.to}-${Date.now()}`;
        const errorCode = (ticket.details?.error ?? ticket.message ?? null) as
          | string
          | null;

        const ticketRecord: TicketRecord = {
          token: payload.to,
          ticketId,
          status: ticket.status,
          error: errorCode,
          createdAt: now,
        };

        await recordTicket(ticketRecord);

        if (ticket.status !== "ok") {
          await recordReceipt(ticketRecord);
          if (errorCode && ERROR_CODES_TO_PRUNE.has(errorCode)) {
            await deleteToken(payload.to);
          }
        }

        return ticketRecord;
      }),
    );

    return NextResponse.json({ ok: true, tickets: processedTickets });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: error.flatten() },
        { status: 400 },
      );
    }

    console.error("Failed to send push notification", error);
    return NextResponse.json(
      { ok: false, error: "Failed to send push notification" },
      { status: 500 },
    );
  }
}
