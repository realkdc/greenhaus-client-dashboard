import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Migration script to update existing ambassadors to the new data model
 * This adds the new fields: firstName, lastName, handle, qrUrl, scanCount
 * and updates the code format if needed
 */

export async function migrateAmbassadors() {
  console.log('Starting ambassador migration...');
  
  const snapshot = await adminDb.collection('ambassadors').get();
  const batch = adminDb.batch();
  let updatedCount = 0;
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const updates: any = {};
    
    // Check if this ambassador needs migration
    const needsMigration = !data.firstName || !data.lastName || !data.qrUrl || data.scanCount === undefined;
    
    if (needsMigration) {
      // Extract name from existing name field
      const fullName = data.name || 'Unknown User';
      const nameParts = fullName.split(' ');
      const firstName = nameParts[0] || 'Unknown';
      const lastName = nameParts.slice(1).join(' ') || 'User';
      
      // Generate QR URL if not exists
      const siteBase = process.env.NEXT_PUBLIC_SITE_BASE || 'https://greenhaus-site.vercel.app';
      const qrUrl = `${siteBase}/r/${data.code}`;
      
      updates.firstName = firstName;
      updates.lastName = lastName;
      updates.qrUrl = qrUrl;
      updates.scanCount = data.uses || 0; // Map existing uses to scanCount
      updates.createdBy = data.createdBy || 'migration';
      
      // Update the document
      batch.update(doc.ref, updates);
      updatedCount++;
      
      console.log(`Updated ambassador: ${firstName} ${lastName} (${data.code})`);
    }
  }
  
  if (updatedCount > 0) {
    await batch.commit();
    console.log(`Migration completed. Updated ${updatedCount} ambassadors.`);
  } else {
    console.log('No ambassadors need migration.');
  }
  
  return updatedCount;
}

// Run migration if this file is executed directly
if (require.main === module) {
  migrateAmbassadors()
    .then((count) => {
      console.log(`Migration completed successfully. Updated ${count} ambassadors.`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}
