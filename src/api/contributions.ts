import { mapPaymentHistory, type BackendContributionRow } from '@/src/api/adapters';
import { apiClient } from '@/src/api/client';
import { ENDPOINTS } from '@/src/constants/api';
import type { FeeBreakdown } from '@/src/utils/calculatePaystackFee';
import type { PaymentHistoryItem } from '@/src/types';

export interface InitializePaymentPayload {
  cycleId: string;
}

export interface InitializePaymentResponse {
  reference: string;
  /** Total the member is charged (contribution + Paystack fee), in GHS. */
  amount: number;
  /** Itemised contribution / fee / total for the payment summary. */
  feeBreakdown?: FeeBreakdown;
  /** Group's Paystack subaccount (collection wallet), when configured. */
  subaccountCode?: string | null;
}

// POST /api/payments/initialize — creates a pending PaymentTransaction (with the
// fee breakdown) and returns the backend-generated reference + the total to
// charge. The mobile SDK charges that total client-side with this reference so
// the webhook/verify can match it (server does NOT init to avoid a duplicate).
export async function initializePayment(
  payload: InitializePaymentPayload,
): Promise<InitializePaymentResponse> {
  const { data } = await apiClient.post<{
    reference: string;
    amount: number;
    fee_breakdown?: FeeBreakdown;
    subaccount_code?: string | null;
  }>(ENDPOINTS.payments.initialize, payload);
  return {
    reference: data.reference,
    amount: data.amount,
    feeBreakdown: data.fee_breakdown,
    subaccountCode: data.subaccount_code,
  };
}

// GET /api/payments/verify/:reference — re-verifies with Paystack and records
// the contribution (idempotent with the webhook). Called after checkout success
// so the payment lands even when the webhook can't reach a local dev server.
export async function verifyPayment(reference: string): Promise<{ status: 'success' | 'failed' }> {
  const { data } = await apiClient.get<{ status: 'success' | 'failed' }>(
    ENDPOINTS.payments.verify(reference),
  );
  return data;
}

// GET /api/payments/history → { message, contributions: [...] }
// Returns the current user's confirmed contributions, newest first, mapped to
// the frontend display shape.
export async function fetchPaymentHistory(): Promise<PaymentHistoryItem[]> {
  const { data } = await apiClient.get<{ contributions: BackendContributionRow[] }>(
    ENDPOINTS.payments.history,
  );
  return (data.contributions ?? []).map(mapPaymentHistory);
}
