import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { migrateAmbassadors } from '@/lib/migrate-ambassadors';

export async function POST(request: NextRequest) {
  // Check for admin authentication
  const unauthorized = requireAdmin(request);
  if (unauthorized) {
    return unauthorized;
  }

  try {
    const updatedCount = await migrateAmbassadors();
    
    return NextResponse.json({
      ok: true,
      success: true,
      message: `Migration completed. Updated ${updatedCount} ambassadors.`,
      updatedCount,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { ok: false, error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
