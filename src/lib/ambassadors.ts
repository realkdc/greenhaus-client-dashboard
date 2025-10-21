import { adminDb } from './firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

export interface Ambassador {
  id: string;
  firstName: string;
  lastName: string;
  handle?: string;
  code: string;
  qrUrl: string;
  qrType: "public" | "staff";
  qrUrlPublic: string;
  qrUrlStaff?: string;
  scanCount: number;
  scanCountPublic?: number;
  scanCountStaff?: number;
  createdAt: FieldValue;
  createdBy: string;
}

export interface CreateAmbassadorData {
  firstName: string;
  lastName: string;
  handle?: string;
  qrType?: "public" | "staff";
  createdBy: string;
}

function kebabCase(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateShortId(length = 4): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateCode(firstName: string, lastName: string): string {
  const firstKebab = kebabCase(firstName);
  const lastKebab = kebabCase(lastName);
  const shortId = generateShortId();
  return `${firstKebab}-${lastKebab}-${shortId}`;
}

export async function createAmbassador(data: CreateAmbassadorData): Promise<Ambassador> {
  const { firstName, lastName, handle, qrType = "public", createdBy } = data;
  
  // Generate unique code
  let code: string;
  let attempts = 0;
  const maxAttempts = 10;
  
  do {
    code = generateCode(firstName, lastName);
    const existing = await adminDb.collection('ambassadors').where('code', '==', code).limit(1).get();
    if (existing.empty) break;
    attempts++;
  } while (attempts < maxAttempts);
  
  if (attempts >= maxAttempts) {
    throw new Error('Unable to generate unique code. Please try again.');
  }
  
  // Generate QR URLs
  const siteBase = process.env.NEXT_PUBLIC_SITE_BASE || 'https://greenhaus-site.vercel.app';
  const qrUrlPublic = `${siteBase}/r/${code}`;
  const qrUrlStaff = qrType === "staff" ? `${siteBase}/s/${code}` : undefined;
  
  const ambassadorData: Omit<Ambassador, 'id'> = {
    firstName,
    lastName,
    handle,
    code,
    qrUrl: qrUrlPublic, // Keep for backward compatibility
    qrType,
    qrUrlPublic,
    qrUrlStaff,
    scanCount: 0,
    scanCountPublic: 0,
    scanCountStaff: 0,
    createdAt: FieldValue.serverTimestamp(),
    createdBy,
  };
  
  const docRef = await adminDb.collection('ambassadors').add(ambassadorData);
  
  return {
    id: docRef.id,
    ...ambassadorData,
  };
}

export async function getAmbassadorByCode(code: string): Promise<Ambassador | null> {
  const snapshot = await adminDb
    .collection('ambassadors')
    .where('code', '==', code)
    .limit(1)
    .get();
  
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as Ambassador;
}

export async function listAmbassadors(): Promise<Ambassador[]> {
  const snapshot = await adminDb
    .collection('ambassadors')
    .orderBy('createdAt', 'desc')
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as Ambassador));
}

export async function incrementScanCount(code: string): Promise<number> {
  const ambassador = await getAmbassadorByCode(code);
  if (!ambassador) {
    throw new Error('Ambassador not found');
  }
  
  const ambassadorRef = adminDb.collection('ambassadors').doc(ambassador.id);
  await ambassadorRef.update({
    scanCount: FieldValue.increment(1),
  });
  
  return ambassador.scanCount + 1;
}

export async function incrementPublicScanCount(code: string, ip: string): Promise<{ incremented: boolean; newCount: number }> {
  const ambassador = await getAmbassadorByCode(code);
  if (!ambassador) {
    throw new Error('Ambassador not found');
  }

  // Create anti-cheat key: code_ip_YYYYMMDD
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const scanKey = `${code}_${ip}_${today}`;
  
  return await adminDb.runTransaction(async (transaction) => {
    const scanLogRef = adminDb.collection('scanLogs').doc(scanKey);
    const ambassadorRef = adminDb.collection('ambassadors').doc(ambassador.id);
    
    // Check if already scanned today from this IP
    const scanLogDoc = await transaction.get(scanLogRef);
    if (scanLogDoc.exists) {
      // Already scanned today, don't increment but still return current count
      const currentData = await transaction.get(ambassadorRef);
      const currentCount = currentData.data()?.scanCountPublic || 0;
      return { incremented: false, newCount: currentCount };
    }
    
    // Create scan log entry
    transaction.set(scanLogRef, {
      code,
      ip,
      date: today,
      type: "public",
      ts: FieldValue.serverTimestamp(),
    });
    
    // Increment counts
    transaction.update(ambassadorRef, {
      scanCount: FieldValue.increment(1),
      scanCountPublic: FieldValue.increment(1),
    });
    
    return { incremented: true, newCount: (ambassador.scanCountPublic || 0) + 1 };
  });
}

export async function incrementStaffScanCount(code: string): Promise<number> {
  const ambassador = await getAmbassadorByCode(code);
  if (!ambassador) {
    throw new Error('Ambassador not found');
  }
  
  return await adminDb.runTransaction(async (transaction) => {
    const ambassadorRef = adminDb.collection('ambassadors').doc(ambassador.id);
    
    // Increment counts
    transaction.update(ambassadorRef, {
      scanCount: FieldValue.increment(1),
      scanCountStaff: FieldValue.increment(1),
    });
    
    return (ambassador.scanCountStaff || 0) + 1;
  });
}

export async function deleteAmbassador(id: string): Promise<void> {
  await adminDb.collection('ambassadors').doc(id).delete();
}
