import { apiClient } from '@/src/api/client';
import { ENDPOINTS } from '@/src/constants/api';
import type { MoMoNetwork } from '@/src/types';

// POST /api/payments/payout — admin sends the net payout of a closed cycle to
// the recipient's MoMo via the Paystack Transfer API.
export interface PayoutResult {
  message: string;
  transferCode: string;
  transferStatus: string;
  netPayout: number;
  recipientName: string;
  recipientNetwork?: string;
  recipientMomo?: string | null;
}

export async function initiateGroupPayout(cycleId: string, groupId: string): Promise<PayoutResult> {
  const { data } = await apiClient.post<{
    message: string;
    transfer_code: string;
    transfer_status: string;
    net_payout: number;
    recipient_name: string;
    recipient_network?: string;
    recipient_momo?: string | null;
  }>(ENDPOINTS.payments.payout, { cycleId, groupId });
  return {
    message: data.message,
    transferCode: data.transfer_code,
    transferStatus: data.transfer_status,
    netPayout: data.net_payout,
    recipientName: data.recipient_name,
    recipientNetwork: data.recipient_network,
    recipientMomo: data.recipient_momo,
  };
}

// GET /api/payments/subaccount/:groupId — admin views the group wallet balance.
export interface SubaccountInfo {
  groupName: string;
  subaccountCode: string;
  /** Raw Paystack subaccount payload (settlement bank, account number, etc.). */
  subaccount: Record<string, unknown>;
}

export async function getSubaccountBalance(groupId: string): Promise<SubaccountInfo> {
  const { data } = await apiClient.get<{
    group_name: string;
    subaccount_code: string;
    subaccount: Record<string, unknown>;
  }>(ENDPOINTS.payments.subaccount(groupId));
  return {
    groupName: data.group_name,
    subaccountCode: data.subaccount_code,
    subaccount: data.subaccount,
  };
}

// POST /api/users/momo — save MoMo payout details (creates a Paystack recipient).
export interface SaveMoMoResult {
  message: string;
  momoNumber: string;
  momoNetwork: MoMoNetwork;
  payoutReady: boolean;
}

export async function saveMoMoDetails(
  momoNumber: string,
  momoNetwork: MoMoNetwork,
): Promise<SaveMoMoResult> {
  const { data } = await apiClient.post<{
    message: string;
    momo_number: string;
    momo_network: MoMoNetwork;
    payout_ready: boolean;
  }>(ENDPOINTS.users.momo, { momo_number: momoNumber, momo_network: momoNetwork });
  return {
    message: data.message,
    momoNumber: data.momo_number,
    momoNetwork: data.momo_network,
    payoutReady: data.payout_ready,
  };
}

// GET /api/users/banks — supported Ghana mobile-money networks.
export interface GhanaBank {
  name: string;
  code: string;
  type: string;
}

export async function getGhanaBanks(): Promise<GhanaBank[]> {
  const { data } = await apiClient.get<{ banks: GhanaBank[] }>(ENDPOINTS.users.banks);
  return data.banks ?? [];
}
