import 'server-only';
import { cache } from 'react';
import { getSessionUserId } from './session';
import { getUserById } from './storage';
import { User } from '@/types';

// Cached per request: safe to call getCurrentUser() from multiple places
// during one render without re-reading the cookie or user store each time.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const user = await getUserById(userId);
  return user ?? null;
});
