import { NextResponse } from 'next/server';
import { verifyCredentials } from '@/lib/storage';
import { createAuthToken } from '@/lib/session';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Username and password are required.' },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    const result = await verifyCredentials(trimmedUsername, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Invalid username or password.' },
        { status: 401 }
      );
    }

    const user = result.user;
    if (!user.isActive) {
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact an administrator.' },
        { status: 403 }
      );
    }

    const token = await createAuthToken(user.id, '30d');

    return NextResponse.json({
      success: true,
      token,
      user,
    });
  } catch (error) {
    console.error('Mobile login error:', error);
    return NextResponse.json(
      { error: 'Internal server error processing login.' },
      { status: 500 }
    );
  }
}
