export interface FeeBreakdown {
  contribution: number;
  fee: number;
  total: number;
  contribution_display: string;
  fee_display: string;
  total_display: string;
}

// Mirrors the backend util (src/utils/calculatePaystackFee.js) so the payment
// screen can show the exact fee breakdown before opening the Paystack popup.
// Paystack Ghana fee: 1.5% + GHS 0.50 flat, capped at GHS 2.00. Members pay the
// fee on top of their contribution; the group receives the exact contribution.
export const calculatePaystackFee = (contributionAmount: number): FeeBreakdown => {
  const amount = Number(contributionAmount) || 0;
  const percentage = amount * 0.015;
  const flat = 0.5;
  const fee = Math.min(percentage + flat, 2.0);
  const total = amount + fee;

  return {
    contribution: parseFloat(amount.toFixed(2)),
    fee: parseFloat(fee.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
    contribution_display: `GHS ${amount.toFixed(2)}`,
    fee_display: `GHS ${fee.toFixed(2)}`,
    total_display: `GHS ${total.toFixed(2)}`,
  };
};

export default calculatePaystackFee;
