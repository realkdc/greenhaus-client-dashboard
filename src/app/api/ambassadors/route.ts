import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAmbassador } from '@/lib/ambassadors';

const CreateAmbassadorSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  handle: z.string().optional(),
  tier: z.enum(['seed', 'sprout', 'bloom', 'evergreen']).optional().default('seed'),
  qrType: z.enum(['public', 'staff']).optional().default('public'),
  orders: z.number().min(0).optional().default(0),
  points: z.number().min(0).optional().default(0),
  createdBy: z.string().min(1, 'Created by is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, handle, tier, qrType, orders, points, createdBy } = CreateAmbassadorSchema.parse(body);

    const ambassador = await createAmbassador({
      firstName,
      lastName,
      email: email || undefined,
      handle,
      tier,
      qrType,
      orders,
      points,
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
