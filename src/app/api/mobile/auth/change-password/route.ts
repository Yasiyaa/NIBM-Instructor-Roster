import { NextResponse } from 'next/server';
import { authenticateMobileRequest, mobileAuthErrorResponse } from '@/lib/mobile-auth';
import { changePassword } from '@/lib/storage';

export async function POST(request: Request) {
  const auth = await authenticateMobileRequest(request);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  try {
    const body = await request.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required.' },
        { status: 400 }
      );
    }

    const result = await changePassword(auth.user.id, currentPassword, newPassword);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully.',
    });
  } catch (error) {
    console.error('Error changing mobile password:', error);
    return NextResponse.json({ error: 'Failed to change password' }, { status: 500 });
  }
}
