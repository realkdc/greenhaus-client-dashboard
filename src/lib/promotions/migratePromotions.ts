import { Timestamp } from "firebase-admin/firestore";
import type { Firestore } from "firebase-admin/firestore";
import {
  coerceCanonicalStoreId,
  resolveStoreAliases,
} from "./storeIds";

export interface MigrationResult {
  updated: number;
  skipped: number;
  errors: string[];
}

export async function migratePromotionsCollection(
  db: Firestore,
): Promise<MigrationResult> {
  const result: MigrationResult = {
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const snapshot = await db.collection("promotions").get();

  if (snapshot.empty) {
    return result;
  }

  for (const doc of snapshot.docs) {
    try {
      const data = doc.data();

      const newData: Record<string, unknown> = {};

      newData.title = data.title || "";
      newData.enabled = data.enabled ?? false;
      newData.env = data.env || "prod";

      const resolvedStore = resolveStoreAliases(data.storeId) ?? {
        canonical: coerceCanonicalStoreId(data.storeId),
        aliases: [],
      };

      newData.storeId = resolvedStore.canonical;

      if (data.body && typeof data.body === "string" && data.body.trim()) {
        newData.body = data.body.trim();
      }

      if (data.imageUrl && typeof data.imageUrl === "string" && data.imageUrl.trim()) {
        newData.imageUrl = data.imageUrl.trim();
      }

      const ctaUrl = data.ctaUrl || data.deepLinkUrl;
      if (ctaUrl && typeof ctaUrl === "string" && ctaUrl.trim()) {
        newData.ctaUrl = ctaUrl.trim();
      }

      if (data.startsAt) {
        if (data.startsAt.toDate) {
          newData.startsAt = data.startsAt;
        } else if (typeof data.startsAt === "string") {
          const startDate = new Date(data.startsAt);
          if (!Number.isNaN(startDate.getTime())) {
            newData.startsAt = Timestamp.fromDate(startDate);
          }
        }
      }

      if (data.endsAt) {
        if (data.endsAt.toDate) {
          newData.endsAt = data.endsAt;
        } else if (typeof data.endsAt === "string") {
          const endDate = new Date(data.endsAt);
          if (!Number.isNaN(endDate.getTime())) {
            newData.endsAt = Timestamp.fromDate(endDate);
          }
        }
      }

      if (data.createdAt) {
        newData.createdAt = data.createdAt;
      } else {
        newData.createdAt = Timestamp.now();
      }

      newData.updatedAt = Timestamp.now();

      const needsUpdate = JSON.stringify(newData) !== JSON.stringify(data);

      if (!needsUpdate) {
        result.skipped += 1;
        continue;
      }

      await db.collection("promotions").doc(doc.id).set(newData);
      result.updated += 1;
    } catch (error) {
      const message = `Failed to migrate promotion ${doc.id}: ${error instanceof Error ? error.message : String(error)}`;
      result.errors.push(message);
    }
  }

  return result;
}


