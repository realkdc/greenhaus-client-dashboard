import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminDb } from "@/lib/firebaseAdmin";
import { requireAdmin } from "@/lib/auth";
import { sendExpoMessages } from "@/lib/expo";

export const runtime = "nodejs";

const payloadSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  segment: z.union([
    z.enum(["all", "ios", "android"]),
    z.object({
      env: z.enum(["prod", "staging"]),
      storeId: z.string(),
    })
  ]).optional(),
  data: z.record(z.unknown()).optional(),
});

const ERROR_CODES_TO_PRUNE = new Set(["DeviceNotRegistered", "InvalidCredentials"]);
const CHUNK_SIZE = 100;

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

async function recordTicket(record: {
  token: string;
  ticketId: string;
  status: string;
  error: string | null;
  createdAt: Date;
}): Promise<void> {
  const ticketRef = adminDb.collection("pushTickets").doc(record.ticketId);
  await ticketRef.set(record, { merge: true });
}

async function recordReceipt(record: {
  token: string;
  ticketId: string;
  status: string;
  error: string | null;
  createdAt: Date;
}): Promise<void> {
  const receiptRef = adminDb.collection("pushReceipts").doc(record.ticketId);
  await receiptRef.set(record, { merge: true });
}

function enableCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, x-admin-key");
  return response;
}

export async function OPTIONS(): Promise<NextResponse> {
  return enableCors(NextResponse.json({ ok: true }));
}

export async function POST(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return enableCors(unauthorized);
  }

  try {
    const json = await request.json();
    const payload = payloadSchema.parse(json);

    // Handle both old and new segment formats
    let segment = "all";
    let deviceFilter = null;
    let envFilter = null;
    let storeIdFilter = null;
    
    if (payload.segment) {
      if (typeof payload.segment === "string") {
        // Old format: "all", "ios", "android"
        segment = payload.segment;
        if (segment !== "all") {
          deviceFilter = segment;
        }
      } else {
        // New format: { env, storeId }
        segment = `${payload.segment.env}-${payload.segment.storeId}`;
        envFilter = payload.segment.env;
        storeIdFilter = payload.segment.storeId;
      }
    }

    let query = adminDb.collection("pushTokens").where("optedIn", "==", true);
    if (deviceFilter) {
      query = query.where("deviceOS", "==", deviceFilter);
    }
    if (envFilter) {
      query = query.where("env", "==", envFilter);
    }
    if (storeIdFilter) {
      query = query.where("storeId", "==", storeIdFilter);
    }

    const snapshot = await query.get();
    const tokens = snapshot.docs
      .map((doc) => doc.get("token") as string | undefined)
      .filter((token): token is string => typeof token === "string" && token.length > 0);

    if (tokens.length === 0) {
      return enableCors(
        NextResponse.json(
          { ok: false, error: "No tokens available for this segment." },
          { status: 404 },
        ),
      );
    }

    const batches = chunk(tokens, CHUNK_SIZE);
    const now = new Date();
    const tickets: Array<{
      token: string;
      ticketId: string;
      status: string;
      error: string | null;
      createdAt: Date;
    }> = [];

    for (const batch of batches) {
      const expoTickets = await sendExpoMessages(batch, {
        title: payload.title,
        body: payload.body,
        data: payload.data,
      });

      await Promise.all(
        expoTickets.map(async (ticket, index) => {
          const token = batch[index] ?? "unknown";
          const ticketId = ticket.id ?? `${token}-${Date.now()}`;
          const errorCode = (ticket.details?.error ?? ticket.message ?? null) as string | null;

          const record = {
            token,
            ticketId,
            status: ticket.status,
            error: errorCode,
            createdAt: now,
          };

          tickets.push(record);
          await recordTicket(record);

          if (ticket.status !== "ok") {
            await recordReceipt(record);
            if (errorCode && ERROR_CODES_TO_PRUNE.has(errorCode)) {
              await deleteToken(token);
            }
          }
        }),
      );
    }

    const campaignsRef = adminDb.collection("pushCampaigns");
    await campaignsRef.add({
      title: payload.title,
      body: payload.body,
      segment,
      sentBy: request.headers.get("x-admin-email") ?? null,
      queued: tokens.length,
      createdAt: now,
    });

    return enableCors(NextResponse.json({ ok: true, queued: tokens.length, failed: 0 }));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return enableCors(
        NextResponse.json(
          { ok: false, error: error.flatten() },
          { status: 400 },
        ),
      );
    }

    console.error("Failed to broadcast push notification", error);
    return enableCors(
      NextResponse.json(
        { ok: false, error: "Failed to broadcast push notification" },
        { status: 500 },
      ),
    );
  }
}
