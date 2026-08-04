import { apiClient } from '@/src/api/client';
import { ENDPOINTS } from '@/src/constants/api';

// Pre-registration phone verification. These are the only unauthenticated
// endpoints the app calls besides login/register — there is no account yet, so
// the phone number itself is the identifier.
//
// The OTP is never stored on the device: it is typed, posted, and exchanged for
// a short-lived phone_verification_token that POST /auth/register requires.

export interface SendOtpResult {
  phoneMasked: string;
  expiresIn: number;
}

export async function sendPhoneOtp(phone: string): Promise<SendOtpResult> {
  const { data } = await apiClient.post<{ phone_masked: string; expires_in: number }>(
    ENDPOINTS.otp.send,
    { phone },
  );
  return { phoneMasked: data.phone_masked, expiresIn: data.expires_in };
}

export async function resendPhoneOtp(phone: string): Promise<SendOtpResult> {
  const { data } = await apiClient.post<{ phone_masked: string; expires_in: number }>(
    ENDPOINTS.otp.resend,
    { phone },
  );
  return { phoneMasked: data.phone_masked, expiresIn: data.expires_in };
}

/** Returns the single-use token the registration call must include. */
export async function verifyPhoneOtp(phone: string, otp: string): Promise<string> {
  const { data } = await apiClient.post<{ phone_verification_token: string }>(
    ENDPOINTS.otp.verify,
    { phone, otp },
  );
  return data.phone_verification_token;
}
