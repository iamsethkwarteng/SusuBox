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

export type PaymentStatus = 'pending' | 'success' | 'failed';

// GET /api/payments/status/:reference — reads the backend's own record, no
// Paystack round trip. Safe to poll.
export async function getPaymentStatus(
  reference: string,
): Promise<{ status: PaymentStatus; amount?: number }> {
  const { data } = await apiClient.get<{ status: PaymentStatus; amount?: number }>(
    ENDPOINTS.payments.status(reference),
  );
  return data;
}

// Polls until the contribution is recorded, the payment is rejected, or we run
// out of patience.
//
// Needed because checkout's onSuccess is NOT confirmation. With mobile money
// the sheet closes as soon as the user approves on their handset, seconds
// before Paystack settles and the webhook fires. Refreshing the group at that
// moment showed the member still unpaid — money gone, screen unchanged — which
// is the single most alarming thing a savings app can do.
//
// A timeout is not a failure: the webhook will still land. The caller says
// "confirming shortly" rather than anything alarming.
export async function waitForPaymentConfirmation(
  reference: string,
  {
    intervalMs = 2500,
    timeoutMs = 60000,
    shouldContinue,
  }: {
    intervalMs?: number;
    timeoutMs?: number;
    /**
     * Checked before each poll. Return false to abandon — used to stop when the
     * screen has unmounted, so a user who backs out mid-confirmation does not
     * get an Alert fired at them from a screen they already left.
     */
    shouldContinue?: () => boolean;
  } = {},
): Promise<PaymentStatus | 'abandoned'> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (shouldContinue && !shouldContinue()) return 'abandoned';
    try {
      const { status } = await getPaymentStatus(reference);
      if (status === 'success' || status === 'failed') return status;
    } catch {
      // A dropped poll is not an answer — keep trying until the deadline.
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return 'pending';
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
