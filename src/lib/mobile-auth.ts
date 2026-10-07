import 'server-only';
import { verifyAuthToken } from './session';
import { getUserById } from './storage';
import { Role, User } from '@/types';
import { NextResponse } from 'next/server';

export async function getMobileUser(request: Request): Promise<User | null> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return null;
  }

  const userId = await verifyAuthToken(token);
  if (!userId) {
    return null;
  }

  const user = await getUserById(userId);
  if (!user || !user.isActive) {
    return null;
  }

  return user;
}

export async function authenticateMobileRequest(
  request: Request,
  allowedRoles?: Role[]
): Promise<{ user: User } | { error: string; status: number }> {
  const user = await getMobileUser(request);
  if (!user) {
    return { error: 'Unauthorized: Invalid or missing Bearer token', status: 401 };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return { error: 'Forbidden: Insufficient privileges', status: 403 };
  }

  return { user };
}

export function mobileAuthErrorResponse(authResult: { error: string; status: number }) {
  return NextResponse.json({ error: authResult.error }, { status: authResult.status });
}
