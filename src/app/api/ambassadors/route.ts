import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAmbassador } from '@/lib/ambassadors';

const CreateAmbassadorSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  handle: z.string().optional(),
  qrType: z.enum(['public', 'staff']).optional().default('public'),
  createdBy: z.string().min(1, 'Created by is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, handle, qrType, createdBy } = CreateAmbassadorSchema.parse(body);

    const ambassador = await createAmbassador({
      firstName,
      lastName,
      handle,
      qrType,
      createdBy,
    });

    return NextResponse.json(ambassador);
  } catch (error) {
    console.error('Error creating ambassador:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
