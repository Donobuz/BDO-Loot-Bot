import { TAX_CONSTANTS } from '../constants/taxes';

/**
 * Calculate the family fame bonus based on fame value
 * Family Fame gives a bonus on the post-tax amount
 */
export function getFamilyFameBonus(familyFame: number): number {
  if (familyFame < 0) return 0;

  // Find the appropriate bracket
  let bonus = 0;
  for (const bracket of TAX_CONSTANTS.FAMILY_FAME_BRACKETS) {
    if (familyFame >= bracket.threshold) {
      bonus = bracket.reduction; // Note: using 'reduction' field name but it's actually a bonus
    } else {
      break;
    }
  }

  return bonus;
}

/**
 * Calculate post-tax value with all bonuses applied
 * BDO tax system: 
 * 1. Apply 35% tax to get base post-tax amount
 * 2. Apply bonuses independently to the base post-tax amount (not stacked)
 *    - Value Pack bonus: 30% of base post-tax amount
 *    - Rich Merchant Ring bonus: 5% of base post-tax amount
 *    - Family Fame bonus: percentage of base post-tax amount (based on fame level)
 */
export function calculatePostTaxValue(
  preTaxValue: number,
  hasValuePack: boolean,
  hasRichMerchantRing: boolean,
  familyFame: number
): number {
  // Step 1: Apply base tax (35%) to get base post-tax amount
  const postTaxBase = preTaxValue * (1 - TAX_CONSTANTS.BASE_TAX_RATE);
  
  let finalAmount = postTaxBase;

  // Step 2: Apply bonuses independently to base post-tax amount
  if (hasValuePack) {
    finalAmount += postTaxBase * TAX_CONSTANTS.VALUE_PACK_BONUS;
  }

  if (hasRichMerchantRing) {
    finalAmount += postTaxBase * TAX_CONSTANTS.RICH_MERCHANT_RING_BONUS;
  }

  const familyFameBonus = getFamilyFameBonus(familyFame);
  if (familyFameBonus > 0) {
    finalAmount += postTaxBase * familyFameBonus;
  }

  return Math.floor(finalAmount);
}

/**
 * Calculate effective tax rate (for display purposes)
 * This shows what the equivalent tax rate would be
 */
export function calculateEffectiveTaxRate(
  hasValuePack: boolean,
  hasRichMerchantRing: boolean,
  familyFame: number
): number {
  // Calculate what we'd get from 100 silver to find effective rate
  const testAmount = 100;
  const finalAmount = calculatePostTaxValue(testAmount, hasValuePack, hasRichMerchantRing, familyFame);
  
  // Effective tax rate = 1 - (final/original)
  return 1 - (finalAmount / testAmount);
}

/**
 * Get tax breakdown for display purposes
 */
export function getTaxBreakdown(
  hasValuePack: boolean,
  hasRichMerchantRing: boolean,
  familyFame: number
): {
  baseTaxRate: number;
  valuePackBonus: number;
  richMerchantRingBonus: number;
  familyFameBonus: number;
  effectiveTaxRate: number;
  totalBonusMultiplier: number;
} {
  const baseTaxRate = TAX_CONSTANTS.BASE_TAX_RATE;
  const postTaxBase = 1 - baseTaxRate; // 65% remains after tax
  
  // Calculate bonuses independently (not stacked)
  const valuePackBonus = hasValuePack ? TAX_CONSTANTS.VALUE_PACK_BONUS : 0;
  const richMerchantRingBonus = hasRichMerchantRing ? TAX_CONSTANTS.RICH_MERCHANT_RING_BONUS : 0;
  const familyFameBonus = getFamilyFameBonus(familyFame);

  // Total bonus multiplier is the sum of all bonuses applied to base post-tax amount
  const totalBonusMultiplier = 1 + valuePackBonus + richMerchantRingBonus + familyFameBonus;

  // Final amount after all bonuses
  const finalAmount = postTaxBase * totalBonusMultiplier;
  const effectiveTaxRate = 1 - finalAmount;

  return {
    baseTaxRate,
    valuePackBonus,
    richMerchantRingBonus,
    familyFameBonus,
    effectiveTaxRate,
    totalBonusMultiplier,
  };
}

/**
 * Format tax rate as percentage string
 */
export function formatTaxRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/**
 * Format silver value with commas
 */
export function formatSilverValue(value: number): string {
  return Math.floor(value).toLocaleString();
}
