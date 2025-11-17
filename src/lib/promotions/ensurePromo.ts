import { Timestamp } from "firebase-admin/firestore";
import {
  coerceCanonicalStoreId,
  DEFAULT_CANONICAL_STORE_ID,
} from "./storeIds";

export interface PromoDoc {
  id?: string;
  title?: string;
  body?: string;
  imageUrl?: string;
  ctaUrl?: string;
  enabled?: boolean;
  env?: "prod" | "staging";
  storeId?: string;
  startsAt?: Timestamp | null;
  endsAt?: Timestamp | null;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  // Legacy fields that might exist
  deepLinkUrl?: string;
  status?: string;
  createdBy?: string;
  [key: string]: any;
}

export interface LeanPromo {
  id: string;
  title: string;
  body?: string;
  imageUrl?: string;
  ctaUrl?: string;
  startsAt?: string;
  endsAt?: string;
}

/**
 * Validates and normalizes a promotion document to match the required schema.
 * Coerces empty strings to undefined, drops unexpected fields, and returns a lean object.
 */
export function ensurePromo(doc: PromoDoc): LeanPromo {
  // Helper to coerce empty strings to undefined
  const coerceString = (value: any): string | undefined => {
    if (typeof value === "string" && value.trim() === "") return undefined;
    return typeof value === "string" ? value.trim() : undefined;
  };

  // Helper to coerce boolean
  const coerceBoolean = (value: any): boolean => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      return value.toLowerCase() === "true" || value === "1";
    }
    return false;
  };

  // Helper to coerce environment
  const coerceEnv = (value: any): "prod" | "staging" => {
    if (value === "staging") return "staging";
    return "prod";
  };

  // Helper to convert Timestamp to ISO string
  const timestampToISO = (timestamp: Timestamp | null | undefined): string | undefined => {
    if (!timestamp) return undefined;
    if (timestamp.toDate) {
      return timestamp.toDate().toISOString();
    }
    return undefined;
  };

  // Extract and validate required fields
  const title = coerceString(doc.title);
  if (!title) {
    throw new Error("Title is required");
  }

  // Map legacy fields to new schema
  const ctaUrl = coerceString(doc.ctaUrl || doc.deepLinkUrl);
  
  return {
    id: doc.id || "",
    title,
    body: coerceString(doc.body),
    imageUrl: coerceString(doc.imageUrl),
    ctaUrl,
    startsAt: timestampToISO(doc.startsAt),
    endsAt: timestampToISO(doc.endsAt),
  };
}

/**
 * Creates a full promotion document with all required fields and defaults.
 * Use this when creating or updating promotions in Firestore.
 */
export function createPromoDoc(data: Partial<PromoDoc>, isUpdate = false): PromoDoc {
  const now = Timestamp.now();
  
  const canonicalStoreId = coerceCanonicalStoreId(
    data.storeId ?? DEFAULT_CANONICAL_STORE_ID,
  );

  const doc: PromoDoc = {
    title: data.title?.trim() || "",
    body: data.body?.trim() || undefined,
    imageUrl: data.imageUrl?.trim() || undefined,
    ctaUrl: data.ctaUrl?.trim() || undefined,
    enabled: data.enabled ?? false,
    env: data.env || "prod",
    storeId: canonicalStoreId,
    startsAt: data.startsAt || null,
    endsAt: data.endsAt || null,
    updatedAt: now,
  };

  // Only set createdAt on create, not update
  if (!isUpdate) {
    doc.createdAt = now;
  }

  // Remove undefined values
  Object.keys(doc).forEach(key => {
    if (doc[key] === undefined) {
      delete doc[key];
    }
  });

  return doc;
}
