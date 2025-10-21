import { adminDb } from './firebaseAdmin';
import bcrypt from 'bcryptjs';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Get the hashed staff PIN from Firestore config
 */
export async function getStaffPinHash(): Promise<string | null> {
  try {
    const doc = await adminDb.collection('config').doc('settings').get();
    if (!doc.exists) {
      return null;
    }
    
    const data = doc.data();
    return data?.staffPinHash || null;
  } catch (error) {
    console.error('Error getting staff PIN hash:', error);
    return null;
  }
}

/**
 * Set the hashed staff PIN in Firestore config
 */
export async function setStaffPinHash(
  hash: string, 
  actorEmail?: string
): Promise<void> {
  try {
    await adminDb.collection('config').doc('settings').set({
      staffPinHash: hash,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: actorEmail || 'dashboard'
    }, { merge: true });
  } catch (error) {
    console.error('Error setting staff PIN hash:', error);
    throw error;
  }
}

/**
 * Verify a raw PIN against the stored hash
 */
export async function verifyStaffPin(rawPin: string): Promise<boolean> {
  try {
    const hash = await getStaffPinHash();
    if (!hash) {
      return false;
    }
    
    return await bcrypt.compare(rawPin, hash);
  } catch (error) {
    console.error('Error verifying staff PIN:', error);
    return false;
  }
}

/**
 * Hash a raw PIN
 */
export async function hashStaffPin(rawPin: string): Promise<string> {
  return await bcrypt.hash(rawPin, 10);
}

/**
 * Get PIN status information
 */
export async function getStaffPinStatus(): Promise<{
  hasPin: boolean;
  updatedAt?: string;
  updatedBy?: string;
}> {
  try {
    const doc = await adminDb.collection('config').doc('settings').get();
    if (!doc.exists) {
      return { hasPin: false };
    }
    
    const data = doc.data();
    return {
      hasPin: Boolean(data?.staffPinHash),
      updatedAt: data?.updatedAt?.toDate?.()?.toISOString(),
      updatedBy: data?.updatedBy
    };
  } catch (error) {
    console.error('Error getting staff PIN status:', error);
    return { hasPin: false };
  }
}
