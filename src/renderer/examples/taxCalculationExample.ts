/**
 * Example usage of tax calculation constants
 * This file demonstrates how to use the tax calculation utilities
 */

import {
  calculateEffectiveTaxRate,
  calculatePostTaxValue,
  getTaxBreakdown,
  formatTaxRate,
  formatSilverValue,
  getFamilyFameBonus
} from '../utils/taxCalculations';

// Example: Calculate post-tax value for an item worth 100M silver
const itemValue = 100_000_000; // 100M silver

// User with Value Pack + Rich Merchant Ring + 5000 Family Fame
const hasValuePack = true;
const hasRichMerchantRing = true;
const familyFame = 5000;

// Calculate effective tax rate
const effectiveTaxRate = calculateEffectiveTaxRate(
  hasValuePack,
  hasRichMerchantRing,
  familyFame
);

// Calculate post-tax value
const postTaxValue = calculatePostTaxValue(
  itemValue,
  hasValuePack,
  hasRichMerchantRing,
  familyFame
);

// Get detailed breakdown
const breakdown = getTaxBreakdown(
  hasValuePack,
  hasRichMerchantRing,
  familyFame
);

console.log('=== Tax Calculation Example ===');
console.log(`Item Value: ${formatSilverValue(itemValue)} silver`);
console.log(`Base Tax Rate: ${formatTaxRate(breakdown.baseTaxRate)}`);
console.log(`\nBonuses (applied to post-tax amount):`);
console.log(`  Value Pack: +${formatTaxRate(breakdown.valuePackBonus)}`);
console.log(`  Rich Merchant Ring: +${formatTaxRate(breakdown.richMerchantRingBonus)}`);
console.log(`  Family Fame (${familyFame}): +${formatTaxRate(breakdown.familyFameBonus)}`);
console.log(`\nEffective Tax Rate: ${formatTaxRate(effectiveTaxRate)}`);
console.log(`Total Bonus Multiplier: ${breakdown.totalBonusMultiplier.toFixed(3)}x`);
console.log(`\nPost-Tax Value: ${formatSilverValue(postTaxValue)} silver`);
console.log(`Tax Amount: ${formatSilverValue(itemValue - postTaxValue)} silver`);

// Example: Family Fame brackets
console.log('\n=== Family Fame Bonuses ===');
const fameValues = [0, 1500, 3000, 5000, 7000, 10000];
fameValues.forEach(fame => {
  const bonus = getFamilyFameBonus(fame);
  console.log(`${fame} fame: +${formatTaxRate(bonus)} bonus`);
});

export {
  itemValue,
  effectiveTaxRate,
  postTaxValue,
  breakdown
};
