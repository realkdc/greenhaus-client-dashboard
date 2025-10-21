import { NextRequest, NextResponse } from 'next/server';
import { migrateAmbassadors } from '@/lib/migrate-ambassadors';

export async function POST(request: NextRequest) {
  try {
    // Check for admin key for security
    const adminKey = request.headers.get('x-admin-key');
    const expectedKey = process.env.ADMIN_API_KEY;
    
    if (!expectedKey || adminKey !== expectedKey) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const updatedCount = await migrateAmbassadors();
    
    return NextResponse.json({
      success: true,
      message: `Migration completed. Updated ${updatedCount} ambassadors.`,
      updatedCount,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: 'Migration failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
