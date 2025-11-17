import { adminDb } from "../src/lib/firebaseAdmin";
import { migratePromotionsCollection } from "../src/lib/promotions/migratePromotions";

async function main() {
  const db = adminDb;
  const result = await migratePromotionsCollection(db);

  console.log("Migration Summary:");
  console.log(`Updated: ${result.updated}`);
  console.log(`Skipped: ${result.skipped}`);
  console.log(`Errors: ${result.errors.length}`);

  if (result.errors.length > 0) {
    result.errors.forEach((error) => console.error(error));
  }

  process.exit(result.errors.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
