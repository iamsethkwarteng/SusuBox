import { mapUser, type BackendUser } from '@/src/api/adapters';
import { apiClient } from '@/src/api/client';
import { ENDPOINTS } from '@/src/constants/api';
import type { User } from '@/src/types';

// The backend wraps auth payloads as { message, token, session_token, user }.
interface BackendAuthResponse {
  token: string;
  session_token: string;
  user: BackendUser;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterBasicDetails {
  name: string;
  phone: string;
  email: string;
  password: string;
  /** Single-use token from POST /otp/verify. Registration is refused without it. */
  phoneVerificationToken: string;
}

export interface RegisterIdentityPayload {
  documentType: 'ghana_card' | 'voter_id' | 'passport' | 'drivers_licence';
  /** The number typed on step 2, already format-validated by the client. */
  idNumber: string;
  /** Cloudinary secure_url (susubox/id_cards/) — never a local file path. */
  idImageUrl: string;
  /** Cloudinary secure_url (susubox/selfies/). */
  selfieImageUrl: string;
}

export interface AuthResponse {
  token: string;
  /** Update 6 — per-device session token; backend keeps one active per user. */
  sessionToken: string;
  user: User;
}

// Login has two possible successful outcomes now. With two-step verification on
// the backend withholds the JWT entirely and returns only a 5-minute temp
// token — so this is a discriminated union rather than a single shape, and a
// caller cannot accidentally treat a PIN-pending login as a completed one.
export type LoginResult =
  | { requires2fa: true; tempToken: string }
  | ({ requires2fa: false } & AuthResponse);

// POST /api/auth/login — verify credentials; if a session is already active on
// another device the backend returns HTTP 423 { message: 'ACTIVE_SESSION_EXISTS' }.
export async function login(payload: LoginPayload): Promise<LoginResult> {
  const { data } = await apiClient.post<BackendAuthResponse & {
    requires_2fa?: boolean;
    temp_token?: string;
  }>(ENDPOINTS.auth.login, payload);

  if (data.requires_2fa && data.temp_token) {
    return { requires2fa: true, tempToken: data.temp_token };
  }
  return {
    requires2fa: false,
    token: data.token,
    sessionToken: data.session_token,
    user: mapUser(data.user),
  };
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

// POST /api/auth/register — the client already uploaded the ID/selfie to
// Cloudinary, so this is pure JSON with the secure_urls. Backend field names
// are snake_case (full_name, id_type), so map them here.
export async function register(
  basicDetails: RegisterBasicDetails,
  identity: RegisterIdentityPayload,
): Promise<AuthResponse> {
  const { data } = await apiClient.post<BackendAuthResponse>(ENDPOINTS.auth.register, {
    full_name: basicDetails.name,
    phone: basicDetails.phone,
    email: basicDetails.email,
    password: basicDetails.password,
    phone_verification_token: basicDetails.phoneVerificationToken,
    id_type: identity.documentType,
    id_number: identity.idNumber,
    idImageUrl: identity.idImageUrl,
    selfieImageUrl: identity.selfieImageUrl,
    tc_accepted: 'true',
  });
  return { token: data.token, sessionToken: data.session_token, user: mapUser(data.user) };
}

// GET /api/auth/me → { message, user }
export async function getMe(): Promise<User> {
  const { data } = await apiClient.get<{ user: BackendUser }>(ENDPOINTS.auth.me);
  return mapUser(data.user);
}

// GET /api/auth/verification-status — polled by EmailVerificationScreen every
// 5s. Reachable while unverified (it is not behind requireEmailVerified).
export async function getVerificationStatus(): Promise<{ emailVerified: boolean; user: User }> {
  const { data } = await apiClient.get<{ email_verified: boolean; user: BackendUser }>(
    ENDPOINTS.auth.verificationStatus,
  );
  return { emailVerified: data.email_verified, user: mapUser(data.user) };
}

// POST /api/auth/resend-verification — issues a new token and mails a new link,
// invalidating the previous one.
export async function resendVerificationEmail(): Promise<void> {
  await apiClient.post(ENDPOINTS.auth.resendVerification);
}

// PATCH /api/users/profile — updates name, phone, and/or profile photo URL.
// Backend reads snake_case keys and returns { message, user }.
export async function updateProfile(
  patch: Partial<Pick<User, 'name' | 'phone' | 'profilePhotoUrl'>>,
): Promise<User> {
  const body: Record<string, string> = {};
  if (patch.name !== undefined) body.full_name = patch.name;
  if (patch.phone !== undefined) body.phone = patch.phone;
  if (patch.profilePhotoUrl !== undefined) body.profile_photo_url = patch.profilePhotoUrl;
  const { data } = await apiClient.patch<{ user: BackendUser }>('/users/profile', body);
  return mapUser(data.user);
}
