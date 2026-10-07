import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiRegisterPushToken, apiDeletePushToken } from './api';

// Configure how notifications behave when the app is in the foreground
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

let cachedPushToken: string | null = null;

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web' || !Device.isDevice) {
    return null;
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push] Push notification permission not granted.');
      return null;
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = tokenData.data;
    cachedPushToken = token;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6366f1',
      });
    }

    // Register with backend
    const deviceName = `${Device.manufacturer || ''} ${Device.modelName || Platform.OS}`.trim();
    await apiRegisterPushToken(token, deviceName);
    console.log('[Push] Push notification device registered successfully.');
    return token;
  } catch (error) {
    console.warn('[Push] Error registering push notifications:', error);
    return null;
  }
}

export async function unregisterPushNotificationsAsync(): Promise<void> {
  if (Platform.OS === 'web') return;
  if (cachedPushToken) {
    try {
      await apiDeletePushToken(cachedPushToken);
      cachedPushToken = null;
    } catch (e) {
      console.warn('[Push] Error unregistering push token:', e);
    }
  }
}
