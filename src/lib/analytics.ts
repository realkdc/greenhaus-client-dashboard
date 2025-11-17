import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export type AnalyticsEvent = {
  userId: string | null;
  eventType: string;
  source: "mobile_app" | "admin";
  metadata?: Record<string, unknown>;
};

/**
 * Log an analytics event to Firestore.
 * Fails silently - never throws, only logs warnings on error.
 */
export async function logAnalyticsEvent(
  event: AnalyticsEvent
): Promise<void> {
  try {
    if (!adminDb) {
      console.warn("[analytics] Firestore not configured, skipping event log");
      return;
    }

    const { userId, eventType, source, metadata } = event;

    // Validate required fields
    if (!eventType || typeof eventType !== "string") {
      console.warn("[analytics] Invalid eventType, skipping event log");
      return;
    }

    if (!source || (source !== "mobile_app" && source !== "admin")) {
      console.warn("[analytics] Invalid source, skipping event log");
      return;
    }

    // Create document in analytics_events collection
    await adminDb.collection("analytics_events").add({
      eventType,
      source,
      userId: userId || null,
      metadata: metadata || {},
      createdAt: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    // Fail silently - never throw
    console.warn("[analytics] Failed to log event:", error);
  }
}

