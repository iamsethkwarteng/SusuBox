export function formatCurrency(amount: number, currency: string = 'GHS'): string {
  const formatted = amount.toLocaleString('en-GH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

export function formatCompactCurrency(amount: number, currency: string = 'GHS'): string {
  return `${currency} ${amount.toLocaleString('en-GH')}`;
}
