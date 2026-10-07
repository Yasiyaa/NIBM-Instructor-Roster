import 'server-only';
import { getPushTokensForUsers, removeInvalidPushTokens, getAllUsers } from './storage';
import { Role } from '@/types';

interface PushMessagePayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  priority?: 'default' | 'normal' | 'high';
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoPushToken(token: string): boolean {
  return typeof token === 'string' && (token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken['));
}

export async function sendExpoPushNotifications(
  tokens: string[],
  payload: PushMessagePayload
): Promise<{ success: boolean; count: number }> {
  const validTokens = Array.from(new Set(tokens.filter(isExpoPushToken)));
  if (validTokens.length === 0) {
    return { success: true, count: 0 };
  }

  const messages = validTokens.map((token) => ({
    to: token,
    sound: payload.sound ?? 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    priority: payload.priority ?? 'high',
  }));

  try {
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      console.warn(`[Push] Expo push endpoint returned status ${response.status}`);
      return { success: false, count: 0 };
    }

    const data = await response.json();
    const tickets = data?.data;

    if (Array.isArray(tickets)) {
      const tokensToRemove: string[] = [];
      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          tokensToRemove.push(validTokens[idx]);
        }
      });

      if (tokensToRemove.length > 0) {
        // Fire-and-forget token cleanup
        removeInvalidPushTokens(tokensToRemove).catch((err) =>
          console.error('[Push] Stale token cleanup failed:', err)
        );
      }
    }

    return { success: true, count: validTokens.length };
  } catch (error) {
    console.error('[Push] Failed to dispatch push notifications:', error);
    return { success: false, count: 0 };
  }
}

export async function sendPushNotificationToUsers(
  userIds: string[],
  payload: PushMessagePayload
): Promise<{ success: boolean; count: number }> {
  if (userIds.length === 0) return { success: true, count: 0 };
  try {
    const tokens = await getPushTokensForUsers(userIds);
    if (tokens.length === 0) return { success: true, count: 0 };
    return await sendExpoPushNotifications(tokens, payload);
  } catch (error) {
    console.error('[Push] Error resolving tokens for users:', error);
    return { success: false, count: 0 };
  }
}

export async function sendPushNotificationToRoles(
  roles: Role[],
  payload: PushMessagePayload
): Promise<{ success: boolean; count: number }> {
  try {
    const allUsers = await getAllUsers();
    const targetedUsers = allUsers.filter((u) => u.isActive && roles.includes(u.role));
    const userIds = targetedUsers.map((u) => u.id);
    return await sendPushNotificationToUsers(userIds, payload);
  } catch (error) {
    console.error('[Push] Error resolving users by role:', error);
    return { success: false, count: 0 };
  }
}

export async function broadcastPushNotification(
  payload: PushMessagePayload
): Promise<{ success: boolean; count: number }> {
  try {
    const allUsers = await getAllUsers();
    const activeUserIds = allUsers.filter((u) => u.isActive).map((u) => u.id);
    return await sendPushNotificationToUsers(activeUserIds, payload);
  } catch (error) {
    console.error('[Push] Error broadcasting notification:', error);
    return { success: false, count: 0 };
  }
}
