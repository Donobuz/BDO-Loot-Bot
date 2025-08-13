// Tax calculation constants for BDO marketplace
export const TAX_CONSTANTS = {
  // Base marketplace tax rate
  BASE_TAX_RATE: 0.35, // 35% base tax

  // Post-tax bonuses (applied to profit after tax)
  VALUE_PACK_BONUS: 0.30, // 30% bonus on post-tax amount (Profit × 1.3)
  RICH_MERCHANT_RING_BONUS: 0.05, // 5% bonus on post-tax amount (Profit × 1.05)

  // Family Fame bonuses (applied to post-tax amount)
  FAMILY_FAME_BRACKETS: [
    { threshold: 0, reduction: 0.00 },     // 0-999: 0%
    { threshold: 1000, reduction: 0.005 }, // 1000-3999: 0.5% (Profit × 1.005)
    { threshold: 4000, reduction: 0.01 },  // 4000-6999: 1% (Profit × 1.01)  
    { threshold: 7000, reduction: 0.015 }, // 7000+: 1.5% (Profit × 1.015)
  ],

  // Maximum family fame value and bonus
  MAX_FAMILY_FAME: 15000, // Maximum family fame value (increased to realistic max)
  MAX_FAMILY_FAME_BONUS: 0.015, // 1.5%
};
