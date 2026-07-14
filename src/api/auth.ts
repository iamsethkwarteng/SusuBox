import { apiClient } from '@/src/api/client';
import { ENDPOINTS } from '@/src/constants/api';
import type { User } from '@/src/types';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterBasicDetails {
  name: string;
  phone: string;
  email: string;
  password: string;
}

export interface RegisterIdentityPayload {
  documentType: 'ghana_card' | 'voter_id' | 'passport';
  /** Cloudinary secure_url (susutrack/id_cards/) — never a local file path. */
  idImageUrl: string;
  /** Cloudinary secure_url (susutrack/selfies/). */
  selfieImageUrl: string;
}

export interface AuthResponse {
  token: string;
  /** Update 6 — per-device session token; backend keeps one active per user. */
  sessionToken: string;
  user: User;
}

// BACKEND REQUIRED: POST /api/auth/login — verify credentials; if the user
// already has an active session on another device return HTTP 423
// { message: 'ACTIVE_SESSION_EXISTS' }; otherwise create a session row and
// return { token, sessionToken, user }.
export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(ENDPOINTS.auth.login, payload);
  return data;
}

// BACKEND REQUIRED: POST /api/auth/force-logout — invalidates every other
// session for this user (called from the Login screen's 423 modal), then the
// client retries login.
export async function forceLogout(payload: LoginPayload): Promise<void> {
  await apiClient.post('/auth/force-logout', payload);
}

// BACKEND REQUIRED: POST /api/auth/logout — invalidate the current session row.
export async function logoutSession(): Promise<void> {
  await apiClient.post('/auth/logout');
}

// BACKEND REQUIRED: POST /api/auth/register — create the user, persist the
// Cloudinary URLs (id_image_url, selfie_url), stamp tc_accepted_at, create a
// session, return { token, sessionToken, user }. Images are already hosted on
// Cloudinary by the client, so this is pure JSON — no multipart upload.
export async function register(
  basicDetails: RegisterBasicDetails,
  identity: RegisterIdentityPayload,
): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>(ENDPOINTS.auth.register, {
    ...basicDetails,
    documentType: identity.documentType,
    idImageUrl: identity.idImageUrl,
    selfieImageUrl: identity.selfieImageUrl,
    tcAcceptedAt: new Date().toISOString(),
  });
  return data;
}

export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<User>(ENDPOINTS.auth.me);
  return data;
}

// BACKEND REQUIRED: PATCH /api/users/profile — updates name, phone, and/or
// profilePhotoUrl (Cloudinary URL from susutrack/profiles/).
export async function updateProfile(patch: Partial<Pick<User, 'name' | 'phone' | 'profilePhotoUrl'>>): Promise<User> {
  const { data } = await apiClient.patch<User>('/users/profile', patch);
  return data;
}
