import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";
import { getExpoReceipts } from "@/lib/expo";

export const runtime = "nodejs";

const ERROR_CODES_TO_PRUNE = new Set(["DeviceNotRegistered", "InvalidCredentials"]);
const MAX_BATCH_SIZE = 300;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

async function deleteToken(token: string): Promise<void> {
  if (!token) return;
  try {
    await adminDb.collection("pushTokens").doc(token).delete();
  } catch (error) {
    console.warn("Failed to delete invalid token", token, error);
  }
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  try {
    const ticketSnapshot = await adminDb
      .collection("pushTickets")
      .where("createdAt", ">=", sevenDaysAgo)
      .get();

    const pendingTickets = ticketSnapshot.docs
      .map((doc) => doc.data() as { ticketId?: string; status?: string; token?: string; error?: string | null })
      .filter((ticket) => ticket.ticketId && ticket.status !== "ok");

    const ticketIds = pendingTickets
      .map((ticket) => ticket.ticketId)
      .filter((id): id is string => typeof id === "string");

    const batches = chunk(ticketIds, MAX_BATCH_SIZE);
    let checked = 0;
    let deleted = 0;
    const receiptsCollection = adminDb.collection("pushReceipts");

    for (const batch of batches) {
      const receipts = await getExpoReceipts(batch);

      await Promise.all(
        Object.entries(receipts).map(async ([ticketId, receipt]) => {
          checked += 1;
          const errorCode = receipt.details?.error ?? null;
          const status = receipt.status;

          const ticket = pendingTickets.find((item) => item.ticketId === ticketId);
          const token = ticket?.token ?? null;

          await receiptsCollection.doc(ticketId).set(
            {
              ticketId,
              status,
              error: errorCode ?? null,
              createdAt: new Date(),
            },
            { merge: true },
          );

          if (errorCode && token && ERROR_CODES_TO_PRUNE.has(errorCode)) {
            await deleteToken(token);
            deleted += 1;
          }
        }),
      );
    }

    return NextResponse.json({ ok: true, checked, deleted });
  } catch (error) {
    console.error("Failed to prune invalid tokens", error);
    return NextResponse.json(
      { ok: false, error: "Failed to prune invalid tokens" },
      { status: 500 },
    );
  }
}

