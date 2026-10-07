import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import {
  initApiSettings,
  apiLogin,
  apiGetMe,
  setAuthToken,
  setApiBaseUrl,
  getApiBaseUrl,
  setOnUnauthorizedHandler,
} from '../services/api';
import {
  registerForPushNotificationsAsync,
  unregisterPushNotificationsAsync,
} from '../services/notifications';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  serverUrl: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateServerUrl: (url: string) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [serverUrl, setServerUrlState] = useState<string>('');

  useEffect(() => {
    async function loadStoredAuth() {
      try {
        const { token: savedToken, serverUrl: savedUrl } = await initApiSettings();
        setServerUrlState(savedUrl);
        if (savedToken) {
          setTokenState(savedToken);
          try {
            const me = await apiGetMe();
            setUser(me);
            // Re-register push token in background
            registerForPushNotificationsAsync().catch(() => {});
          } catch (err) {
            console.warn('[Auth] Stored token expired or invalid:', err);
            await setAuthToken(null);
            setTokenState(null);
            setUser(null);
          }
        }
      } catch (err) {
        console.warn('[Auth] Auth initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadStoredAuth();

    setOnUnauthorizedHandler(() => {
      logout().catch(() => {});
    });

    return () => {
      setOnUnauthorizedHandler(null);
    };
  }, []);

  const login = async (username: string, password: string) => {
    setIsLoading(true);
    try {
      const result = await apiLogin(username, password);
      setUser(result.user);
      setTokenState(result.token);
      // Register for push notifications upon login
      registerForPushNotificationsAsync().catch(() => {});
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await unregisterPushNotificationsAsync();
    } catch {}
    await setAuthToken(null);
    setTokenState(null);
    setUser(null);
  };

  const updateServerUrl = async (url: string) => {
    await setApiBaseUrl(url);
    setServerUrlState(getApiBaseUrl());
  };

  const refreshUser = async () => {
    if (!token) return;
    try {
      const me = await apiGetMe();
      setUser(me);
    } catch (err) {
      console.warn('[Auth] Failed refreshing user:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        serverUrl,
        login,
        logout,
        updateServerUrl,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
