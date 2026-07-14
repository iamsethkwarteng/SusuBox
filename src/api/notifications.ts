import { apiClient } from '@/src/api/client';
import { ENDPOINTS } from '@/src/constants/api';
import type { AppNotification } from '@/src/types';

// BACKEND REQUIRED: GET /api/notifications — all notifications for the
// current user, newest first.
export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data } = await apiClient.get<AppNotification[]>(ENDPOINTS.notifications.list);
  return data;
}

// BACKEND REQUIRED: PATCH /api/notifications/:id/read
export async function markNotificationRead(id: string): Promise<void> {
  await apiClient.patch(ENDPOINTS.notifications.markRead(id));
}

// BACKEND REQUIRED: PATCH /api/notifications/read-all
export async function markAllNotificationsRead(): Promise<void> {
  await apiClient.patch('/notifications/read-all');
}

// BACKEND REQUIRED: PATCH /api/users/fcm-token — persists this device's push
// token so the escalation cron (see initFCM.ts) can target it.
export async function registerPushToken(token: string): Promise<void> {
  await apiClient.patch('/users/fcm-token', { token });
}
