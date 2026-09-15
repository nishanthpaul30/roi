/**
 * Shared number formatting used across every dashboard page and table.
 * Anything under 1,000 keeps full precision (compacting "$21.61" to "$22"
 * or "500" tokens loses meaningful detail at that scale); at 1,000 and above,
 * values compact to K / M / B so nothing renders as a long raw digit string.
 */

export function formatCompactNumber(value: number | null | undefined): string {
  const v = value || 0;
  if (Math.abs(v) < 1000) return v.toLocaleString();
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(v);
}

export function formatCompactCurrency(value: number | null | undefined): string {
  const v = value || 0;
  if (Math.abs(v) < 1000) {
    return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `$${new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(v)}`;
}
