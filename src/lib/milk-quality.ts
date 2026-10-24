/**
 * Estimates SNF (Solid-Not-Fat) percentage from the Corrected Lactometer
 * Reading (CLR) and butterfat percentage.
 *
 * Common dairy formula:
 *   SNF = CLR ÷ 4 + 0.25 × FAT + 0.44
 *
 * Example: CLR 26, FAT 4.5 → 6.5 + 1.125 + 0.44 = 8.065 (displayed as 8.06).
 */
export function calculateSnf(clr: number, fatPercentage: number): number {
  if (!Number.isFinite(clr) || !Number.isFinite(fatPercentage)) return 0;
  return Number((clr / 4 + 0.25 * fatPercentage + 0.44).toFixed(2));
}
