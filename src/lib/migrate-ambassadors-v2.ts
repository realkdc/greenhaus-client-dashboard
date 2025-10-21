import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Migration script to update existing ambassadors with new QR system
 * This adds the new fields: qrType, qrUrlPublic, qrUrlStaff, scanCountPublic, scanCountStaff
 */
export async function migrateAmbassadorsV2() {
  console.log('Starting ambassador migration v2...');
  
  try {
    // Get all existing ambassadors
    const ambassadorsSnapshot = await adminDb.collection('ambassadors').get();
    
    if (ambassadorsSnapshot.empty) {
      console.log('No ambassadors found to migrate.');
      return { success: true, migrated: 0 };
    }
    
    const siteBase = process.env.NEXT_PUBLIC_SITE_BASE || 'https://greenhaus-site.vercel.app';
    let migratedCount = 0;
    
    // Process each ambassador
    for (const doc of ambassadorsSnapshot.docs) {
      const data = doc.data();
      const ambassadorId = doc.id;
      
      // Skip if already migrated (has qrType field)
      if (data.qrType) {
        console.log(`Ambassador ${ambassadorId} already migrated, skipping...`);
        continue;
      }
      
      const updates: any = {
        qrType: "public", // Default to public for existing ambassadors
        qrUrlPublic: data.qrUrl || `${siteBase}/r/${data.code}`,
        scanCountPublic: data.scanCount || 0,
        scanCountStaff: 0,
      };
      
      // Only set qrUrlStaff if the ambassador is marked as staff type
      // For now, all existing ambassadors are public
      // You can modify this logic if you want to convert some to staff
      
      try {
        await adminDb.collection('ambassadors').doc(ambassadorId).update(updates);
        console.log(`Migrated ambassador ${ambassadorId}: ${data.firstName} ${data.lastName}`);
        migratedCount++;
      } catch (error) {
        console.error(`Failed to migrate ambassador ${ambassadorId}:`, error);
      }
    }
    
    console.log(`Migration completed. Migrated ${migratedCount} ambassadors.`);
    return { success: true, migrated: migratedCount };
    
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Convert an ambassador from public to staff or vice versa
 */
export async function convertAmbassadorType(ambassadorId: string, newType: "public" | "staff") {
  try {
    const ambassadorRef = adminDb.collection('ambassadors').doc(ambassadorId);
    const ambassadorDoc = await ambassadorRef.get();
    
    if (!ambassadorDoc.exists) {
      throw new Error('Ambassador not found');
    }
    
    const data = ambassadorDoc.data()!;
    const siteBase = process.env.NEXT_PUBLIC_SITE_BASE || 'https://greenhaus-site.vercel.app';
    
    const updates: any = {
      qrType: newType,
      qrUrlPublic: `${siteBase}/r/${data.code}`,
    };
    
    if (newType === "staff") {
      updates.qrUrlStaff = `${siteBase}/s/${data.code}`;
    } else {
      // Remove staff URL when converting to public
      updates.qrUrlStaff = FieldValue.delete();
    }
    
    await ambassadorRef.update(updates);
    
    console.log(`Converted ambassador ${ambassadorId} to ${newType} type`);
    return { success: true };
    
  } catch (error) {
    console.error('Failed to convert ambassador type:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
