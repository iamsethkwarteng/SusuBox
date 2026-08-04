// Central place for backend endpoint config. Swap EXPO_PUBLIC_API_URL in a .env
// file (Expo inlines EXPO_PUBLIC_* vars at build time) once the real backend is live.

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api.susubox.app/v1';

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
