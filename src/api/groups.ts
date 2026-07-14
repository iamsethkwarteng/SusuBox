import { apiClient } from '@/src/api/client';
import { ENDPOINTS } from '@/src/constants/api';
import type { Group, GroupFrequency, GroupPreview } from '@/src/types';

// BACKEND REQUIRED: GET /api/groups — all groups where the current user is an
// active member (admin or regular).
export async function fetchGroups(): Promise<Group[]> {
  const { data } = await apiClient.get<Group[]>(ENDPOINTS.groups.list);
  return data;
}

// BACKEND REQUIRED: GET /api/groups/:id — single group with members, current
// cycle, rotation order, and (for admins) pendingRequests.
export async function fetchGroupDetail(groupId: string): Promise<Group> {
  const { data } = await apiClient.get<Group>(ENDPOINTS.groups.detail(groupId));
  return data;
}

export async function fetchRotation(groupId: string): Promise<Group['rotation']> {
  const { data } = await apiClient.get<Group['rotation']>(ENDPOINTS.groups.rotation(groupId));
  return data;
}

export interface CreateGroupPayload {
  name: string;
  contributionAmount: number;
  frequency: GroupFrequency;
  maxMembers: number;
  penaltyFee: number;
  gracePeriodDays: number;
  rules?: string;
}

// BACKEND REQUIRED: POST /api/groups — creates the group, auto-generates a
// unique SUSU-XXXXXX invite code + susutrack.app/join/<code> link, and inserts
// the creator as an active admin member with payout_position 1.
export async function createGroup(payload: CreateGroupPayload): Promise<Group> {
  const { data } = await apiClient.post<Group>(ENDPOINTS.groups.list, payload);
  return data;
}

// BACKEND REQUIRED: GET /api/groups/preview/:inviteCode — PUBLIC route (no
// auth) so the join screen can show name/amount/slots before login.
export async function fetchGroupPreview(inviteCode: string): Promise<GroupPreview> {
  const { data } = await apiClient.get<GroupPreview>(`/groups/preview/${inviteCode}`);
  return data;
}

// BACKEND REQUIRED: POST /api/groups/join — creates a *pending* membership and
// notifies the admin (FCM + email). Distinct error codes the UI handles:
//   ALREADY_MEMBER, REMOVED_BLOCKED, GROUP_FULL, REQUEST_PENDING
export async function requestToJoin(inviteCode: string): Promise<{ status: 'pending' }> {
  const { data } = await apiClient.post<{ status: 'pending' }>('/groups/join', { inviteCode });
  return data;
}

/** @deprecated old direct-join path; requestToJoin is the approval flow. */
export async function joinGroupByInvite(inviteCode: string): Promise<Group> {
  const { data } = await apiClient.post<Group>(ENDPOINTS.groups.join(inviteCode));
  return data;
}

// BACKEND REQUIRED: PATCH /api/groups/:groupId/members/:memberId/approve —
// admin only; activates the membership, assigns the last payout position, and
// notifies the member via FCM + email.
export async function approveJoinRequest(groupId: string, memberId: string): Promise<void> {
  await apiClient.patch(`/groups/${groupId}/members/${memberId}/approve`);
}

// BACKEND REQUIRED: PATCH /api/groups/:groupId/members/:memberId/decline —
// admin only; notifies the member via FCM + email.
export async function declineJoinRequest(groupId: string, memberId: string): Promise<void> {
  await apiClient.patch(`/groups/${groupId}/members/${memberId}/decline`);
}

// BACKEND REQUIRED: DELETE /api/groups/:groupId/members/:memberId — admin
// only; marks the membership removed AND adds the user to the group blocklist
// so rejoining with the same invite code returns REMOVED_BLOCKED.
export async function removeMember(groupId: string, memberId: string): Promise<void> {
  await apiClient.delete(`/groups/${groupId}/members/${memberId}`);
}

// BACKEND REQUIRED: PATCH /api/groups/:groupId/rotation — admin only; accepts
// the full ordered member-id list. Rejected with 409 once cycle 1 has opened.
export async function updateRotationOrder(groupId: string, orderedMemberIds: string[]): Promise<void> {
  await apiClient.patch(`/groups/${groupId}/rotation`, { order: orderedMemberIds });
}

export async function closeCycleAndPayout(groupId: string): Promise<Group> {
  const { data } = await apiClient.post<Group>(`${ENDPOINTS.groups.detail(groupId)}/close-cycle`);
  return data;
}

export async function requestEarlyPayout(groupId: string): Promise<{ status: string }> {
  const { data } = await apiClient.post<{ status: string }>(
    `${ENDPOINTS.groups.detail(groupId)}/early-payout-request`,
  );
  return data;
}
