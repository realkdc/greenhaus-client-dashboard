#!/usr/bin/env node

import { adminDb } from "../src/lib/firebaseAdmin";
import { Timestamp } from "firebase-admin/firestore";

interface MigrationResult {
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Migrates existing promotion documents to match the new schema.
 * Sets defaults for missing values and removes unexpected fields.
 */
export async function migratePromotions(): Promise<MigrationResult> {
  const result: MigrationResult = {
    updated: 0,
    skipped: 0,
    errors: [],
  };

  try {
    console.log("Starting promotions migration...");
    
    const snapshot = await adminDb.collection("promotions").get();
    
    if (snapshot.empty) {
      console.log("No promotions found to migrate.");
      return result;
    }

    console.log(`Found ${snapshot.size} promotions to process...`);

    for (const doc of snapshot.docs) {
      try {
        const data = doc.data();
        const docId = doc.id;
        
        console.log(`Processing promotion ${docId}...`);
        
        // Create the new document with proper schema
        const newData: Record<string, any> = {};
        
        // Required fields
        newData.title = data.title || "";
        newData.enabled = data.enabled ?? false;
        newData.env = data.env || "prod";
        newData.storeId = data.storeId || "store_123";
        
        // Optional fields - only include if they exist and are not empty
        if (data.body && typeof data.body === "string" && data.body.trim()) {
          newData.body = data.body.trim();
        }
        
        if (data.imageUrl && typeof data.imageUrl === "string" && data.imageUrl.trim()) {
          newData.imageUrl = data.imageUrl.trim();
        }
        
        // Map legacy deepLinkUrl to ctaUrl
        const ctaUrl = data.ctaUrl || data.deepLinkUrl;
        if (ctaUrl && typeof ctaUrl === "string" && ctaUrl.trim()) {
          newData.ctaUrl = ctaUrl.trim();
        }
        
        // Handle timestamps
        if (data.startsAt) {
          if (data.startsAt.toDate) {
            // Already a Timestamp
            newData.startsAt = data.startsAt;
          } else if (typeof data.startsAt === "string") {
            // Convert string to Timestamp
            const date = new Date(data.startsAt);
            if (!isNaN(date.getTime())) {
              newData.startsAt = Timestamp.fromDate(date);
            }
          }
        }
        
        if (data.endsAt) {
          if (data.endsAt.toDate) {
            // Already a Timestamp
            newData.endsAt = data.endsAt;
          } else if (typeof data.endsAt === "string") {
            // Convert string to Timestamp
            const date = new Date(data.endsAt);
            if (!isNaN(date.getTime())) {
              newData.endsAt = Timestamp.fromDate(date);
            }
          }
        }
        
        // Preserve existing timestamps or set defaults
        if (data.createdAt) {
          newData.createdAt = data.createdAt;
        } else {
          newData.createdAt = Timestamp.now();
        }
        
        newData.updatedAt = Timestamp.now();
        
        // Check if document needs updating
        const needsUpdate = JSON.stringify(newData) !== JSON.stringify(data);
        
        if (needsUpdate) {
          await adminDb.collection("promotions").doc(docId).set(newData);
          result.updated++;
          console.log(`✓ Updated promotion ${docId}`);
        } else {
          result.skipped++;
          console.log(`- Skipped promotion ${docId} (no changes needed)`);
        }
        
      } catch (error) {
        const errorMsg = `Failed to migrate promotion ${doc.id}: ${error}`;
        console.error(errorMsg);
        result.errors.push(errorMsg);
      }
    }
    
    console.log("Migration completed!");
    console.log(`Updated: ${result.updated}`);
    console.log(`Skipped: ${result.skipped}`);
    console.log(`Errors: ${result.errors.length}`);
    
    if (result.errors.length > 0) {
      console.log("Errors:");
      result.errors.forEach(error => console.log(`  - ${error}`));
    }
    
  } catch (error) {
    const errorMsg = `Migration failed: ${error}`;
    console.error(errorMsg);
    result.errors.push(errorMsg);
  }
  
  return result;
}

// Run migration if called directly
if (require.main === module) {
  migratePromotions()
    .then(result => {
      console.log("\nMigration Summary:");
      console.log(`Updated: ${result.updated}`);
      console.log(`Skipped: ${result.skipped}`);
      console.log(`Errors: ${result.errors.length}`);
      process.exit(result.errors.length > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error("Migration failed:", error);
      process.exit(1);
    });
}
