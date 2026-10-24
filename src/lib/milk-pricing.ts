/**
 * Milk-center pricing based on the buyer's base rate and milk quality.
 *
 * Standard milk is 4.5% fat and 8.5% SNF, which gives a score of 15.25:
 *   1.5 × 4.5 + 8.5 = 15.25
 *
 * Rate per litre = baseRate × (1.5 × fat + SNF) ÷ 15.25
 *
 * The same calculation can be expressed as two component rates:
 *   fatRate = 1.5 × baseRate ÷ 15.25
 *   snfRate = baseRate ÷ 15.25
 *   ratePerLiter = fat × fatRate + SNF × snfRate
 */
export const STANDARD_FAT_PERCENTAGE = 4.5;
export const STANDARD_SNF_PERCENTAGE = 8.5;
export const STANDARD_MILK_SCORE = 15.25;
export const FAT_WEIGHT = 1.5;

export interface MilkPricing {
  fatRate: number;
  snfRate: number;
  ratePerLiter: number;
}

export function calculateMilkPricing(
  baseRate: number,
  fatPercentage: number,
  snfPercentage: number
): MilkPricing {
  if (
    !Number.isFinite(baseRate) ||
    !Number.isFinite(fatPercentage) ||
    !Number.isFinite(snfPercentage) ||
    baseRate < 0
  ) {
    return { fatRate: 0, snfRate: 0, ratePerLiter: 0 };
  }

  const fatRate = (FAT_WEIGHT * baseRate) / STANDARD_MILK_SCORE;
  const snfRate = baseRate / STANDARD_MILK_SCORE;
  const ratePerLiter = fatPercentage * fatRate + snfPercentage * snfRate;

  return {
    fatRate,
    snfRate,
    ratePerLiter: Number(Math.max(0, ratePerLiter).toFixed(2)),
  };
}
