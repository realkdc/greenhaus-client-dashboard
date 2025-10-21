import { NextRequest, NextResponse } from 'next/server';
import { migrateAmbassadorsV2, convertAmbassadorType } from '@/lib/migrate-ambassadors-v2';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, ambassadorId, newType } = body;
    
    if (action === 'migrate') {
      const result = await migrateAmbassadorsV2();
      return NextResponse.json(result);
    } else if (action === 'convert' && ambassadorId && newType) {
      const result = await convertAmbassadorType(ambassadorId, newType);
      return NextResponse.json(result);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "migrate" or "convert" with ambassadorId and newType.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Migration API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
