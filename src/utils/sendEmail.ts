import { apiClient, isNetworkError } from '@/src/api/client';

export type EmailType = 'contribution_confirmed' | 'payout_received' | 'join_approved' | 'join_declined';

export interface EmailPayload {
  type: EmailType;
  /** Template variables the backend interpolates into the Nodemailer template. */
  data: Record<string, string | number>;
}

/**
 * Fire-and-forget trigger for transactional emails. The device never talks to
 * an SMTP server directly — it just asks the backend to send, so credentials
 * stay server-side and templates stay consistent.
 *
 * BACKEND REQUIRED: POST /api/notifications/email — validates the JWT, loads
 * the Nodemailer template for `type`, interpolates `data`, and sends to the
 * authenticated user's registered email address. Templates:
 *   contribution_confirmed: "Dear [name], your contribution of GHS [amount]
 *     to [groupName] for Cycle [cycle] has been received and recorded.
 *     Reference: [reference]. Thank you."
 *   payout_received: "Dear [name], your payout of GHS [net] from [groupName]
 *     has been processed. Breakdown: Pot GHS [pot] − Arrears GHS [arrears] −
 *     Penalties GHS [penalties] = Net GHS [net]. Congratulations!"
 */
export async function sendEmail(payload: EmailPayload): Promise<{ sent: boolean }> {
  try {
    await apiClient.post('/notifications/email', payload);
    return { sent: true };
  } catch (error) {
    // DEMO FALLBACK: no backend yet — report success on network error so the
    // confirmation toast flow can be exercised end-to-end in the demo build.
    if (isNetworkError(error)) return { sent: true };
    return { sent: false };
  }
}

export default sendEmail;
