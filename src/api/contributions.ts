import { apiClient } from '@/src/api/client';
import { ENDPOINTS } from '@/src/constants/api';
import type { ContributionHistoryItem } from '@/src/types';

export interface PayContributionPayload {
  groupId: string;
  amount: number;
  channel: 'momo' | 'card' | 'bank';
}

export interface PayContributionResponse {
  reference: string;
  authorizationUrl?: string;
}

export async function payContribution(
  payload: PayContributionPayload,
): Promise<PayContributionResponse> {
  const { data } = await apiClient.post<PayContributionResponse>(
    ENDPOINTS.contributions.pay,
    payload,
  );
  return data;
}

export async function fetchContributionHistory(groupId: string): Promise<ContributionHistoryItem[]> {
  const { data } = await apiClient.get<ContributionHistoryItem[]>(
    ENDPOINTS.contributions.history(groupId),
  );
  return data;
}

export async function verifyPayment(reference: string): Promise<{ status: 'success' | 'failed' }> {
  const { data } = await apiClient.get<{ status: 'success' | 'failed' }>(
    ENDPOINTS.payments.verify(reference),
  );
  return data;
}
