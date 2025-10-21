import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { incrementStaffScanCount } from '@/lib/ambassadors';
import { getStaffConfig } from '@/lib/ip-utils';

const VerifyStaffSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  pin: z.string().min(4, 'PIN must be at least 4 digits').max(6, 'PIN must be at most 6 digits'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, pin } = VerifyStaffSchema.parse(body);

    // Get staff configuration
    const { staffPin } = getStaffConfig();
    
    if (!staffPin) {
      return NextResponse.json(
        { error: 'Staff PIN not configured' },
        { status: 500 }
      );
    }

    // Verify PIN
    if (pin !== staffPin) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      );
    }

    // PIN is valid, increment staff scan count
    await incrementStaffScanCount(code);

    return NextResponse.json({
      success: true,
      message: 'Access granted',
    });
  } catch (error) {
    console.error('Error verifying staff PIN:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
