import { NextResponse } from 'next/server';
import { authenticateMobileRequest, mobileAuthErrorResponse } from '@/lib/mobile-auth';
import { updateOwnProfile } from '@/lib/storage';

export async function PATCH(request: Request) {
  const auth = await authenticateMobileRequest(request);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  try {
    const body = await request.json();
    const { email, phone } = body;

    const result = await updateOwnProfile(auth.user.id, {
      email: typeof email === 'string' ? email : undefined,
      phone: typeof phone === 'string' ? phone : undefined,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      user: result.user,
    });
  } catch (error) {
    console.error('Error updating mobile profile:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
