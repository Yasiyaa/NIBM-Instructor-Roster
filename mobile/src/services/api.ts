import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  User,
  RosterWeek,
  DutyAssignment,
  NightShift,
  AcademicCatalog,
  LeaveRequest,
  ExecutiveStatusReport,
} from '../types';

const STORE_TOKEN_KEY = 'nibm_slate_token';
const STORE_SERVER_KEY = 'nibm_slate_server_url';

// Production domain for NIBM Slate: https://slate.oalindustries.me
const PRODUCTION_HOST = 'https://slate.oalindustries.me';

// Default API host:
// - Uses EXPO_PUBLIC_API_URL when explicitly set
// - In development (__DEV__): points to local server (10.0.2.2 for Android emulator, localhost:3000 for iOS/Web)
// - In production: defaults directly to https://slate.oalindustries.me
const DEFAULT_HOST =
  process.env.EXPO_PUBLIC_API_URL ||
  (typeof __DEV__ !== 'undefined' && __DEV__
    ? Platform.OS === 'android'
      ? 'http://10.0.2.2:3000'
      : 'http://localhost:3000'
    : PRODUCTION_HOST);

let currentServerUrl = DEFAULT_HOST;
let currentToken: string | null = null;

// Cross-platform persistent storage helper:
// On Web, SecureStore is unavailable in Expo SDK; fallback gracefully to localStorage.
// On iOS & Android, use hardware-backed encrypted SecureStore.
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage.getItem(key);
        }
      } catch (e) {
        console.warn('[Storage] Web localStorage read failed:', e);
      }
      return null;
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {
      console.warn('[Storage] SecureStore.getItemAsync failed:', e);
      return null;
    }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(key, value);
        }
      } catch (e) {
        console.warn('[Storage] Web localStorage write failed:', e);
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (e) {
      console.warn('[Storage] SecureStore.setItemAsync failed:', e);
    }
  },
  async deleteItem(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        if (typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.removeItem(key);
        }
      } catch (e) {
        console.warn('[Storage] Web localStorage remove failed:', e);
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (e) {
      console.warn('[Storage] SecureStore.deleteItemAsync failed:', e);
    }
  },
};

export async function initApiSettings(): Promise<{ token: string | null; serverUrl: string }> {
  try {
    const savedServer = await storage.getItem(STORE_SERVER_KEY);
    if (savedServer) {
      currentServerUrl = savedServer;
    }
    const savedToken = await storage.getItem(STORE_TOKEN_KEY);
    currentToken = savedToken;
    return { token: currentToken, serverUrl: currentServerUrl };
  } catch (e) {
    console.warn('[API] Failed reading stored settings:', e);
    return { token: null, serverUrl: currentServerUrl };
  }
}

export async function setApiBaseUrl(url: string): Promise<void> {
  const sanitized = url.trim().replace(/\/+$/, '');
  currentServerUrl = sanitized;
  try {
    await storage.setItem(STORE_SERVER_KEY, sanitized);
  } catch (e) {
    console.warn('[API] Failed saving server URL:', e);
  }
}

export function getApiBaseUrl(): string {
  return currentServerUrl;
}

export async function setAuthToken(token: string | null): Promise<void> {
  currentToken = token;
  try {
    if (token) {
      await storage.setItem(STORE_TOKEN_KEY, token);
    } else {
      await storage.deleteItem(STORE_TOKEN_KEY);
    }
  } catch (e) {
    console.warn('[API] Failed storing auth token:', e);
  }
}

let onUnauthorizedHandler: (() => void) | null = null;

export function setOnUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorizedHandler = handler;
}

export function getAuthToken(): string | null {
  return currentToken;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${currentServerUrl}${endpoint}`;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    if (response.status === 401 && endpoint !== '/api/mobile/auth/login') {
      onUnauthorizedHandler?.();
    }
    const errorMsg = (typeof data === 'object' && data?.error) ? data.error : `Request failed with status ${response.status}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export async function apiLogin(
  username: string,
  password: string
): Promise<{ success: boolean; token: string; user: User }> {
  const res = await request<{ success: boolean; token: string; user: User }>('/api/mobile/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  await setAuthToken(res.token);
  return res;
}

export async function apiGetMe(): Promise<User> {
  const res = await request<{ user: User }>('/api/mobile/auth/me');
  return res.user;
}

export async function apiRegisterPushToken(token: string, device?: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/api/mobile/push-token', {
    method: 'POST',
    body: JSON.stringify({ token, device }),
  });
}

export async function apiDeletePushToken(token: string): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/api/mobile/push-token', {
    method: 'DELETE',
    body: JSON.stringify({ token }),
  });
}

export interface ScheduleResponse {
  week: RosterWeek;
  duties: DutyAssignment[];
  mergedDuties: DutyAssignment[];
  nightShifts: NightShift[];
  catalog: AcademicCatalog;
  instructors: User[];
}

export async function apiGetSchedule(startDate?: string): Promise<ScheduleResponse> {
  const query = startDate ? `?startDate=${encodeURIComponent(startDate)}` : '';
  return request<ScheduleResponse>(`/api/mobile/schedule${query}`);
}

export async function apiGetLeaves(): Promise<LeaveRequest[]> {
  const res = await request<{ leaves: LeaveRequest[] }>('/api/mobile/leaves');
  return res.leaves;
}

export async function apiSubmitLeave(
  startDate: string,
  endDate: string,
  reason: string
): Promise<{ success: boolean; leave: LeaveRequest }> {
  return request<{ success: boolean; leave: LeaveRequest }>('/api/mobile/leaves', {
    method: 'POST',
    body: JSON.stringify({ startDate, endDate, reason }),
  });
}

export async function apiReviewLeave(
  leaveId: string,
  status: 'APPROVED' | 'REJECTED',
  reviewComment?: string
): Promise<{ success: boolean; leave: LeaveRequest }> {
  return request<{ success: boolean; leave: LeaveRequest }>(`/api/mobile/leaves/${leaveId}/review`, {
    method: 'POST',
    body: JSON.stringify({ status, reviewComment }),
  });
}

export async function apiGetDashboard(date?: string): Promise<{ date: string; report: ExecutiveStatusReport }> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  return request<{ date: string; report: ExecutiveStatusReport }>(`/api/mobile/dashboard${query}`);
}

export async function apiCancelLeave(leaveId: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/mobile/leaves/${leaveId}`, {
    method: 'DELETE',
  });
}

export async function apiUpdateProfile(input: { email?: string; phone?: string }): Promise<{ success: boolean; user: User }> {
  return request<{ success: boolean; user: User }>('/api/mobile/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function apiChangePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>('/api/mobile/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export interface PublicBoardResponse {
  week: RosterWeek;
  today: string;
  executiveReport: ExecutiveStatusReport;
  duties: DutyAssignment[];
  mergedDuties: DutyAssignment[];
  nightShifts: NightShift[];
  catalog: AcademicCatalog;
  instructors: User[];
}

export async function apiGetPublicBoard(): Promise<PublicBoardResponse> {
  return request<PublicBoardResponse>('/api/mobile/public-board');
}

export interface AddDutyInput {
  rosterWeekId: string;
  instructorId: string;
  dutyDate: string;
  slotLabel: string;
  startTime: string;
  endTime: string;
  dutyType: string;
  batchName?: string;
  moduleName?: string;
  roomLab?: string;
  notes?: string;
}

export async function apiAssignDuty(input: AddDutyInput): Promise<{ success: boolean; assignment: DutyAssignment }> {
  return request<{ success: boolean; assignment: DutyAssignment }>('/api/mobile/schedule/duty', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function apiDeleteDuty(assignmentId: string): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/mobile/schedule/duty?id=${encodeURIComponent(assignmentId)}`, {
    method: 'DELETE',
  });
}

export async function apiSetNightShift(
  rosterWeekId: string,
  instructorId: string,
  shiftDate: string,
  notes?: string
): Promise<{ success: boolean; nightShift: NightShift }> {
  return request<{ success: boolean; nightShift: NightShift }>('/api/mobile/schedule/night-shift', {
    method: 'POST',
    body: JSON.stringify({ rosterWeekId, instructorId, shiftDate, notes }),
  });
}

export async function apiPublishRoster(
  weekId: string,
  action?: 'publish' | 'unpublish'
): Promise<{ success: boolean; week: RosterWeek }> {
  return request<{ success: boolean; week: RosterWeek }>('/api/mobile/schedule/publish', {
    method: 'POST',
    body: JSON.stringify({ weekId, action }),
  });
}

export function getCalendarFeedUrl(instructorId: string): string {
  return `${currentServerUrl}/api/calendar/${instructorId}`;
}
