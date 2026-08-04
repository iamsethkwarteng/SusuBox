import { mapUser, type BackendUser } from '@/src/api/adapters';
import { apiClient } from '@/src/api/client';
import type { User } from '@/src/types';

// Two-step verification (self-set 6-digit PIN).
//
// The PIN never leaves this layer in any stored form — it is posted, checked
// against a bcrypt hash server-side, and forgotten. Nothing here writes it to
// SecureStore, logs it, or keeps it in module state.

export interface TwoFAVerifyResult {
  token: string;
  sessionToken: string;
  user: User;
}

// POST /api/2fa/verify — second half of login. Authenticated by the temp_token
// from the login response, not a JWT (there isn't one yet).
export async function verifyTwoFAPin(pin: string, tempToken: string): Promise<TwoFAVerifyResult> {
  const { data } = await apiClient.post<{
    token: string;
    session_token: string;
    user: BackendUser;
  }>('/2fa/verify', { pin, temp_token: tempToken });
  return { token: data.token, sessionToken: data.session_token, user: mapUser(data.user) };
}

// GET /api/2fa/status — drives the ON/OFF badge in Settings.
export async function getTwoFAStatus(): Promise<{ enabled: boolean; lockedUntil: string | null }> {
  const { data } = await apiClient.get<{ two_fa_enabled: boolean; locked_until: string | null }>(
    '/2fa/status',
  );
  return { enabled: data.two_fa_enabled, lockedUntil: data.locked_until };
}

// POST /api/2fa/setup — first-time enable.
export async function setupTwoFA(pin: string, confirmPin: string): Promise<void> {
  await apiClient.post('/2fa/setup', { pin, confirm_pin: confirmPin });
}

// POST /api/2fa/change-pin — requires the current PIN.
export async function changeTwoFAPin(
  currentPin: string,
  newPin: string,
  confirmNewPin: string,
): Promise<void> {
  await apiClient.post('/2fa/change-pin', {
    current_pin: currentPin,
    new_pin: newPin,
    confirm_new_pin: confirmNewPin,
  });
}

// POST /api/2fa/disable — requires BOTH password and current PIN.
export async function disableTwoFA(pin: string, password: string): Promise<void> {
  await apiClient.post('/2fa/disable', { pin, password });
}

// POST /api/2fa/reset-pin — "Forgot PIN", proved by the account password.
// Callable from Settings (JWT attached automatically) or from the login PIN
// prompt, where `tempToken` stands in for the session the user doesn't have yet.
export async function resetTwoFAPin(
  password: string,
  newPin: string,
  confirmNewPin: string,
  tempToken?: string,
): Promise<void> {
  await apiClient.post('/2fa/reset-pin', {
    password,
    new_pin: newPin,
    confirm_new_pin: confirmNewPin,
    ...(tempToken ? { temp_token: tempToken } : {}),
  });
}
