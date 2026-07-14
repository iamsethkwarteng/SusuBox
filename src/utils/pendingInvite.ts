import * as SecureStore from 'expo-secure-store';

// Update 8 — deep-link invites require an account. When a logged-out user taps
// susutrack://join/<code> (or susutrack.app/join/<code>), the code is parked
// here so it survives app restarts; Login/Register read it to show the
// "Log in to join [Group]" banner and forward the user to JoinGroupScreen
// afterwards. Cleared once the join flow completes or is dismissed.

const PENDING_INVITE_KEY = 'susutrack_pending_invite';

export interface PendingInvite {
  code: string;
  groupName?: string;
}

export async function savePendingInvite(invite: PendingInvite): Promise<void> {
  await SecureStore.setItemAsync(PENDING_INVITE_KEY, JSON.stringify(invite)).catch(() => undefined);
}

export async function getPendingInvite(): Promise<PendingInvite | null> {
  try {
    const raw = await SecureStore.getItemAsync(PENDING_INVITE_KEY);
    return raw ? (JSON.parse(raw) as PendingInvite) : null;
  } catch {
    return null;
  }
}

export async function clearPendingInvite(): Promise<void> {
  await SecureStore.deleteItemAsync(PENDING_INVITE_KEY).catch(() => undefined);
}
