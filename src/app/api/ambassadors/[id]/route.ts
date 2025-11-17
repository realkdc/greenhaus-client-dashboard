import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { updateAmbassador } from '@/lib/ambassadors';

const UpdateAmbassadorSchema = z.object({
  firstName: z.string().min(1, 'First name is required').optional(),
  lastName: z.string().min(1, 'Last name is required').optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  handle: z.string().optional(),
  tier: z.enum(['seed', 'sprout', 'bloom', 'evergreen']).optional(),
  orders: z.number().min(0).optional(),
  points: z.number().min(0).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const data = UpdateAmbassadorSchema.parse(body);

    // Filter out undefined values and convert empty email to undefined
    const updateData: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        if (key === 'email' && value === '') {
          // Skip empty email strings
          continue;
        }
        updateData[key] = value;
      }
    }

    await updateAmbassador(params.id, updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating ambassador:', error);

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
