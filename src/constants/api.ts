// Central place for backend endpoint config. Every request in the app resolves
// through API_BASE_URL — there is no hardcoded host anywhere else — so pointing
// at a different backend is a one-line change in .env.
//
// Expo inlines EXPO_PUBLIC_* at BUILD time, so after editing .env you must
// restart the dev server (`npx expo start --clear`); a hot reload keeps the old
// value baked into the bundle.
//
// The fallback is the live Render deployment rather than a placeholder domain:
// if .env is missing (a fresh clone, or an EAS build without the var set) the
// app still reaches a real backend instead of failing against a host that has
// never existed.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://susubox-api-u1rg.onrender.com/api';

// 30s: a free-tier host (e.g. Render) can take ~30-60s to wake from sleep on
// the first request. A short timeout there surfaces as a bogus "cannot reach
// the server" error, so we wait long enough for a cold start.
export const API_TIMEOUT_MS = 30000;

// Base origin without the /api suffix — used by the splash-screen warm-up ping.
export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export const ENDPOINTS = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    verifyIdentity: '/auth/verify-identity',
    me: '/auth/me',
    resendVerification: '/auth/resend-verification',
    verificationStatus: '/auth/verification-status',
  },
  groups: {
    list: '/groups',
    detail: (groupId: string) => `/groups/${groupId}`,
    rotation: (groupId: string) => `/groups/${groupId}/rotation`,
    members: (groupId: string) => `/groups/${groupId}/members`,
    join: (inviteCode: string) => `/groups/join/${inviteCode}`,
  },
  contributions: {
    pay: '/contributions/pay',
    history: (groupId: string) => `/contributions/${groupId}/history`,
  },
  notifications: {
    list: '/notifications',
    markRead: (id: string) => `/notifications/${id}/read`,
  },
  payments: {
    initialize: '/payments/initialize',
    verify: (reference: string) => `/payments/verify/${reference}`,
    // Cheap poll target — reads the backend's own record, so it can be called
    // every couple of seconds while a mobile money confirmation settles.
    status: (reference: string) => `/payments/status/${reference}`,
    history: '/payments/history',
    payout: '/payments/payout',
    subaccount: (groupId: string) => `/payments/subaccount/${groupId}`,
    // One-off migration: puts existing group subaccounts on manual settlement.
    // Remove once the backend route has been run and deleted.
    fixSubaccounts: '/payments/fix-subaccounts',
  },
  users: {
    momo: '/users/momo',
    banks: '/users/banks',
  },
  // Pre-registration phone verification (no auth — the account doesn't exist yet).
  otp: {
    send: '/otp/send',
    resend: '/otp/resend',
    verify: '/otp/verify',
  },
  personalSusu: {
    list: '/personal-susu',
    create: '/personal-susu',
    detail: (goalId: string) => `/personal-susu/${goalId}`,
    contribute: '/personal-susu/contribute',
    verify: (reference: string) => `/personal-susu/verify/${reference}`,
    collect: (goalId: string) => `/personal-susu/${goalId}/collect`,
    withdrawEarly: (goalId: string) => `/personal-susu/${goalId}/withdraw-early`,
    cancel: (goalId: string) => `/personal-susu/${goalId}/cancel`,
  },
} as const;

// HUBTEL PENDING — the SMS OTP step in registration step 1 is switched OFF
// until the Hubtel credentials are live. While false, step 1's Next button
// goes straight to step 2 (ID capture); PhoneOTPScreen and the /otp/* API
// layer stay in place, just unused.
//
// TO RE-ENABLE: set EXPO_PUBLIC_PHONE_OTP_ENABLED=true here AND
// PHONE_OTP_ENABLED=true in the backend .env. Both must agree — with the
// backend enforcing and the app skipping, every registration would be
// rejected as PHONE_NOT_VERIFIED.
export const PHONE_OTP_ENABLED = process.env.EXPO_PUBLIC_PHONE_OTP_ENABLED === 'true';

// Public key is safe to ship in the client; the secret key stays server-side only.
export const PAYSTACK_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY ?? 'pk_test_00000000000000000000000000000000000000';

export const APP_SCHEME = 'susubox';
export const INVITE_LINK_BASE = `${APP_SCHEME}://join`;
export const INVITE_WEB_BASE = 'https://susubox.app/join';

// Cloudinary unsigned upload config. The cloud name + unsigned preset are safe
// to ship in the client (the preset should be locked to the susubox/ folder
// and image-only in the Cloudinary dashboard). Set real values via .env:
//   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud
//   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=susubox_unsigned
export const CLOUDINARY_CLOUD_NAME =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'susubox-demo';
export const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'susubox_unsigned';
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

// Startup guard for missing build-time config.
//
// EXPO_PUBLIC_* variables are inlined by Expo at BUILD time and are NOT read
// from .env during an EAS cloud build — .env is gitignored and never uploaded.
// eas.json now sets them per profile, but if one is ever dropped the failure is
// silent and awful: the placeholder fallbacks above produce an app that looks
// fine and then cannot take a payment (Paystack rejects the dummy key) or
// upload an ID (the demo Cloudinary cloud does not exist). Worse,
// PHONE_OTP_ENABLED defaults to false, so the app skips the OTP step while the
// backend still demands the token and rejects every single registration.
//
// A loud console error at startup is the difference between finding this in
// five minutes and finding it from user reports after launch.
const MISSING_ENV = (
  [
    ['EXPO_PUBLIC_API_URL', process.env.EXPO_PUBLIC_API_URL],
    ['EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY', process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY],
    ['EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME', process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME],
    ['EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET', process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET],
    ['EXPO_PUBLIC_PHONE_OTP_ENABLED', process.env.EXPO_PUBLIC_PHONE_OTP_ENABLED],
  ] as const
)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (MISSING_ENV.length > 0) {
  console.error(
    '[CONFIG] Missing build-time environment variables:\n  ' +
      MISSING_ENV.join('\n  ') +
      '\n\nLocally: add them to .env and restart with `npx expo start --clear`.' +
      '\nEAS builds: they come from the `env` block of the build profile in eas.json.' +
      '\nUntil then this build falls back to placeholders — payments and ID upload will fail.',
  );
}
