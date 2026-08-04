import axios, { AxiosError } from 'axios';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import { API_BASE_URL, API_TIMEOUT_MS } from '@/src/constants/api';

// JWT + session token never touch AsyncStorage — expo-secure-store backs onto
// Keychain (iOS) / Keystore (Android), the correct place for auth material.
export const TOKEN_KEY = 'susubox_jwt';
export const SESSION_TOKEN_KEY = 'susubox_session_token';
export const SESSION_STARTED_AT_KEY = 'susubox_session_started_at';
export const PROFILE_PHOTO_KEY = 'susubox_profile_photo';

// Caches the latest profile-photo URL so the avatar shows instantly on the next
// app launch, before GET /auth/me returns. Cleared on logout with the tokens.
export async function cacheProfilePhoto(url: string): Promise<void> {
  await SecureStore.setItemAsync(PROFILE_PHOTO_KEY, url);
}

export async function getCachedProfilePhoto(): Promise<string | null> {
  return SecureStore.getItemAsync(PROFILE_PHOTO_KEY);
}

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getSessionToken(): Promise<string | null> {
  return SecureStore.getItemAsync(SESSION_TOKEN_KEY);
}

/** Update 6 — stores the per-device session token the backend issues at login
 *  and stamps when this session began (drives SessionBanner's 5-minute window). */
export async function setSessionToken(sessionToken: string): Promise<void> {
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, sessionToken);
  await SecureStore.setItemAsync(SESSION_STARTED_AT_KEY, String(Date.now()));
}

export async function getSessionStartedAt(): Promise<number | null> {
  const raw = await SecureStore.getItemAsync(SESSION_STARTED_AT_KEY);
  return raw ? Number(raw) : null;
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
  await SecureStore.deleteItemAsync(SESSION_STARTED_AT_KEY);
  await SecureStore.deleteItemAsync(PROFILE_PHOTO_KEY);
}

// --- Session conflict channel (Update 6) -----------------------------------
// client.ts cannot render UI, so when the backend reports this device's
// session was superseded (HTTP 409 SESSION_CONFLICT) we emit an event; the
// root layout subscribes and shows the full-screen "signed out" modal.
type SessionConflictListener = () => void;
const sessionConflictListeners = new Set<SessionConflictListener>();

export function onSessionConflict(listener: SessionConflictListener): () => void {
  sessionConflictListeners.add(listener);
  return () => {
    sessionConflictListeners.delete(listener);
  };
}

let conflictNotified = false; // fire the modal once, not per parallel request

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT_MS,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // BACKEND REQUIRED: on every request the backend compares X-Session-Token
  // against users.active_session_token; mismatch -> 409 SESSION_CONFLICT.
  const sessionToken = await getSessionToken();
  if (sessionToken) {
    config.headers['X-Session-Token'] = sessionToken;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    conflictNotified = false; // a successful call means the session is valid again
    return response;
  },
  async (error: AxiosError<{ message?: string; error?: string; email?: string }>) => {
    const status = error.response?.status;
    const message = error.response?.data?.message;

    // Any protected route hit by an unverified account: bounce to the
    // verification screen rather than surfacing a bare 403 on some deep screen.
    // Guarded so a 403 arriving before the navigator mounts can't crash the app.
    if (status === 403 && error.response?.data?.error === 'EMAIL_NOT_VERIFIED') {
      const email = error.response.data.email ?? '';
      try {
        router.replace({ pathname: '/(auth)/verify-email', params: { email } });
      } catch {
        // Navigator not ready yet — SplashScreen's own check will route instead.
      }
      return Promise.reject(error);
    }

    if (status === 409 && message === 'SESSION_CONFLICT') {
      // Another device logged in — sign this one out exactly once.
      if (!conflictNotified) {
        conflictNotified = true;
        await clearToken();
        sessionConflictListeners.forEach((listener) => listener());
      }
    } else if (status === 401) {
      await clearToken();
    }
    return Promise.reject(error);
  },
);

export function isNetworkError(error: unknown): boolean {
  return axios.isAxiosError(error) && !error.response;
}

/** True when the backend rejected login because another session is active (HTTP 423). */
export function isActiveSessionError(error: unknown): boolean {
  return (
    axios.isAxiosError(error) &&
    error.response?.status === 423 &&
    (error.response.data as { message?: string })?.message === 'ACTIVE_SESSION_EXISTS'
  );
}

export default apiClient;
