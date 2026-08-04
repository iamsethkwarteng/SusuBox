import {
  mapGroup,
  mapPreview,
  type BackendGroup,
  type BackendPreview,
} from '@/src/api/adapters';
import { apiClient } from '@/src/api/client';
import { ENDPOINTS } from '@/src/constants/api';
import type { Group, GroupFrequency, GroupPreview } from '@/src/types';

// GET /api/groups → { message, groups: [...] } (snake_case) — mapped to Group[].
export async function fetchGroups(): Promise<Group[]> {
  const { data } = await apiClient.get<{ groups: BackendGroup[] }>(ENDPOINTS.groups.list);
  return (data.groups ?? []).map(mapGroup);
}

// GET /api/groups/:id → { message, group } with members + current cycle.
export async function fetchGroupDetail(groupId: string): Promise<Group> {
  const { data } = await apiClient.get<{ group: BackendGroup }>(ENDPOINTS.groups.detail(groupId));
  return mapGroup(data.group);
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

// POST /api/groups — backend generates the SUSU-XXXXXX code + link and seats
// the creator as admin position 1. Request keys are snake_case on the backend.
export async function createGroup(payload: CreateGroupPayload): Promise<Group> {
  const { data } = await apiClient.post<{ group: BackendGroup }>(ENDPOINTS.groups.list, {
    name: payload.name,
    contribution_amount: payload.contributionAmount,
    frequency: payload.frequency,
    max_members: payload.maxMembers,
    penalty_fee_per_cycle: payload.penaltyFee,
    grace_period_days: payload.gracePeriodDays,
    group_rules: payload.rules,
  });
  return mapGroup(data.group);
}

// GET /api/groups/preview/:inviteCode — PUBLIC route → { message, preview }.
export async function fetchGroupPreview(inviteCode: string): Promise<GroupPreview> {
  const { data } = await apiClient.get<{ preview: BackendPreview }>(`/groups/preview/${inviteCode}`);
  return mapPreview(data.preview);
}

// POST /api/groups/join — creates a *pending* membership and notifies the admin
// (FCM + email). Backend expects { invite_code, rules_agreed }. Distinct error
// codes the UI handles: ALREADY_MEMBER, REMOVED_BLOCKED, GROUP_FULL, REQUEST_PENDING.
export async function requestToJoin(inviteCode: string): Promise<{ status: 'pending' }> {
  await apiClient.post('/groups/join', { invite_code: inviteCode, rules_agreed: true });
  return { status: 'pending' };
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

// PATCH /api/groups/:groupId/rotation — admin only; rejected with 400 once
// cycle 1 has opened. Backend expects { rotation: [{ userId, position }] } —
// NOT a bare ordered id list — and matches each entry by the member's userId
// (not the GroupMember row id).
export interface RotationOrderEntry {
  userId: string;
  position: number;
}

export async function updateRotationOrder(groupId: string, order: RotationOrderEntry[]): Promise<void> {
  await apiClient.patch(`/groups/${groupId}/rotation`, {
    rotation: order.map((e) => ({ userId: e.userId, position: e.position })),
  });
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
