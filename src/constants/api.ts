// Central place for backend endpoint config. Swap EXPO_PUBLIC_API_URL in a .env
// file (Expo inlines EXPO_PUBLIC_* vars at build time) once the real backend is live.

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://api.susutrack.app/v1';

export const API_TIMEOUT_MS = 8000;

export const ENDPOINTS = {
  auth: {
    register: '/auth/register',
    login: '/auth/login',
    verifyIdentity: '/auth/verify-identity',
    me: '/auth/me',
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
  },
} as const;

// Public key is safe to ship in the client; the secret key stays server-side only.
export const PAYSTACK_PUBLIC_KEY =
  process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY ?? 'pk_test_00000000000000000000000000000000000000';

export const APP_SCHEME = 'susutrack';
export const INVITE_LINK_BASE = `${APP_SCHEME}://join`;
export const INVITE_WEB_BASE = 'https://susutrack.app/join';

// Cloudinary unsigned upload config. The cloud name + unsigned preset are safe
// to ship in the client (the preset should be locked to the susutrack/ folder
// and image-only in the Cloudinary dashboard). Set real values via .env:
//   EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=your-cloud
//   EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=susutrack_unsigned
export const CLOUDINARY_CLOUD_NAME =
  process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME ?? 'susutrack-demo';
export const CLOUDINARY_UPLOAD_PRESET =
  process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET ?? 'susutrack_unsigned';
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
