import { NextResponse } from 'next/server';
import { authenticateMobileRequest, mobileAuthErrorResponse } from '@/lib/mobile-auth';
import { savePushToken, deletePushToken } from '@/lib/storage';

export async function POST(request: Request) {
  const auth = await authenticateMobileRequest(request);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  try {
    const body = await request.json();
    const { token, device } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Push token is required.' }, { status: 400 });
    }

    const result = await savePushToken(auth.user.id, token.trim(), device);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to save token' }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Push token registered successfully.' });
  } catch (error) {
    console.error('Error registering push token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authenticateMobileRequest(request);
  if ('error' in auth) {
    return mobileAuthErrorResponse(auth);
  }

  try {
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Push token is required.' }, { status: 400 });
    }

    await deletePushToken(auth.user.id, token.trim());
    return NextResponse.json({ success: true, message: 'Push token removed.' });
  } catch (error) {
    console.error('Error removing push token:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
