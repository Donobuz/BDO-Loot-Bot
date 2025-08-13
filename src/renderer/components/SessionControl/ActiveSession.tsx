import React, { useState, useEffect } from "react";
import { Location, Item, TaxCalculations } from "../../types";
import { calculatePostTaxValue } from "../../utils/taxCalculations";

interface ActiveSessionProps {
  session: {
    isActive: boolean;
    startTime?: Date;
    location?: Location;
    itemCounts: Map<number, number>;
  };
  lootTableItems: ItemWithPrice[];
  taxSettings: TaxCalculations;
  userPreferences: any;
  streamingOverlayOpen: boolean;
  onStopSession: () => void;
  onOpenStreamingOverlay: () => void;
  onItemDetected: (event: any, data: any) => void;
}

interface ItemWithPrice extends Item {
  calculatedPrice: number;
}

export const ActiveSession: React.FC<ActiveSessionProps> = ({
  session,
  lootTableItems,
  taxSettings,
  userPreferences,
  streamingOverlayOpen,
  onStopSession,
  onOpenStreamingOverlay,
  onItemDetected,
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showTaxBreakdown, setShowTaxBreakdown] = useState(false);

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const calculateTotalValue = (): number => {
    let totalValue = 0;
    lootTableItems.forEach(item => {
      const count = session.itemCounts.get(item.id) || 0;
      
      // During active session, calculate the post-tax price for each item
      let postTaxPrice = 0;
      
      if (item.type === "marketplace") {
        // Use the raw price from calculatedPrice and apply tax
        const preTaxPrice = item.calculatedPrice; // This is the raw price since we loaded with applyTaxCalculations=false
        postTaxPrice = calculatePostTaxValue(
          preTaxPrice,
          taxSettings.value_pack,
          taxSettings.rich_merchant_ring,
          taxSettings.family_fame
        );
      } else if (item.type === "trash_loot") {
        // Trash loot is not taxed, use calculatedPrice directly
        postTaxPrice = item.calculatedPrice;
      } else if (item.type === "conversion" && item.convertible_to_bdo_item_id && item.conversion_ratio) {
        // For conversion items, the calculatedPrice is already the raw conversion value
        // We need to apply tax to the target marketplace item and then divide by conversion ratio
        const userRegion = userPreferences.preferred_region;
        const targetItem = lootTableItems.find(i => 
          i.bdo_item_id === item.convertible_to_bdo_item_id && 
          i.region === userRegion && 
          i.type === "marketplace"
        );
        
        if (targetItem) {
          // Use the target item's raw price and apply tax
          const targetPostTaxPrice = calculatePostTaxValue(
            targetItem.calculatedPrice, // Raw price of target marketplace item
            taxSettings.value_pack,
            taxSettings.rich_merchant_ring,
            taxSettings.family_fame
          );
          postTaxPrice = targetPostTaxPrice / item.conversion_ratio;
        } else {
          // Fallback: use the conversion item's calculated price (raw) and apply estimated tax
          const rawConversionPrice = item.calculatedPrice;
          // Estimate the marketplace price this conversion represents
          const estimatedMarketplacePrice = rawConversionPrice * item.conversion_ratio;
          const taxedMarketplacePrice = calculatePostTaxValue(
            estimatedMarketplacePrice,
            taxSettings.value_pack,
            taxSettings.rich_merchant_ring,
            taxSettings.family_fame
          );
          postTaxPrice = taxedMarketplacePrice / item.conversion_ratio;
        }
      }
      
      totalValue += count * Math.round(postTaxPrice);
    });
    return totalValue;
  };

  const calculateGrossValue = (): number => {
    let grossValue = 0;
    
    lootTableItems.forEach(item => {
      const count = session.itemCounts.get(item.id) || 0;
      // Use the raw calculatedPrice since it was loaded with applyTaxCalculations=false
      const preTaxPrice = item.calculatedPrice;
      grossValue += count * preTaxPrice;
    });
    
    return grossValue;
  };

  const getTaxBreakdown = () => {
    const userRegion = userPreferences.preferred_region;
    let taxableGrossValue = 0;
    let taxablePostTaxValue = 0;
    let nonTaxableValue = 0;
    
    // Calculate taxable and non-taxable values separately
    lootTableItems.forEach(item => {
      const count = session.itemCounts.get(item.id) || 0;
      
      if (item.type === "trash_loot") {
        // Trash loot is not taxed - use calculatedPrice directly
        nonTaxableValue += count * item.calculatedPrice;
      } else if (item.type === "marketplace") {
        // Marketplace items are taxed - use calculatedPrice as pre-tax value
        const preTaxPrice = item.calculatedPrice;
        const postTaxPrice = calculatePostTaxValue(
          preTaxPrice,
          taxSettings.value_pack,
          taxSettings.rich_merchant_ring,
          taxSettings.family_fame
        );
        taxableGrossValue += count * preTaxPrice;
        taxablePostTaxValue += count * postTaxPrice;
      } else if (item.type === "conversion" && item.convertible_to_bdo_item_id && item.conversion_ratio) {
        // Conversion items use the post-tax value of their target marketplace item
        const targetItem = lootTableItems.find(i => 
          i.bdo_item_id === item.convertible_to_bdo_item_id && 
          i.region === userRegion && 
          i.type === "marketplace"
        );
        
        if (targetItem) {
          // Use the target item's calculatedPrice as the pre-tax marketplace price
          const targetPreTaxPrice = targetItem.calculatedPrice;
          const targetPostTaxPrice = calculatePostTaxValue(
            targetPreTaxPrice,
            taxSettings.value_pack,
            taxSettings.rich_merchant_ring,
            taxSettings.family_fame
          );
          
          const conversionPreTaxPrice = targetPreTaxPrice / item.conversion_ratio;
          const conversionPostTaxPrice = targetPostTaxPrice / item.conversion_ratio;
          
          taxableGrossValue += count * conversionPreTaxPrice;
          taxablePostTaxValue += count * conversionPostTaxPrice;
        } else {
          // Fallback: use the conversion item's calculatedPrice
          const conversionPreTaxPrice = item.calculatedPrice;
          
          // Estimate the marketplace price this represents and apply tax
          const estimatedMarketplacePrice = conversionPreTaxPrice * item.conversion_ratio;
          const taxedMarketplacePrice = calculatePostTaxValue(
            estimatedMarketplacePrice,
            taxSettings.value_pack,
            taxSettings.rich_merchant_ring,
            taxSettings.family_fame
          );
          const conversionPostTaxPrice = taxedMarketplacePrice / item.conversion_ratio;
          
          taxableGrossValue += count * conversionPreTaxPrice;
          taxablePostTaxValue += count * conversionPostTaxPrice;
        }
      }
    });
    
    const totalGrossValue = taxableGrossValue + nonTaxableValue;
    const totalPostTaxValue = taxablePostTaxValue + nonTaxableValue;
    const taxAmount = taxableGrossValue - taxablePostTaxValue;
    const effectiveTaxRate = taxableGrossValue > 0 ? (taxAmount / taxableGrossValue) * 100 : 0;
    
    return {
      grossValue: totalGrossValue,
      postTaxValue: totalPostTaxValue,
      taxableGrossValue,
      taxablePostTaxValue,
      nonTaxableValue,
      taxAmount,
      effectiveTaxRate,
      bonuses: {
        valuePack: taxSettings.value_pack,
        richMerchantRing: taxSettings.rich_merchant_ring,
        familyFame: taxSettings.family_fame
      }
    };
  };

  const formatSessionDuration = (startTime: Date): string => {
    const diff = currentTime.getTime() - startTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (!session.isActive || !session.startTime) {
    return null;
  }

  return (
    <div className='session-control active'>
      <div className='session-header'>
        <div className='session-status'>
          <div className='status-indicator active'></div>
          <h3>Active Session</h3>
        </div>
        <div className='session-controls'>
          <div className='session-duration'>
            {formatSessionDuration(session.startTime)}
          </div>
          {!streamingOverlayOpen && (
            <button 
              onClick={onOpenStreamingOverlay}
              className='overlay-launch-icon'
              title='Open Streaming Overlay'
              aria-label='Open Streaming Overlay'
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 7h10v10" />
                <path d="M7 17L17 7" />
              </svg>
            </button>
          )}
          {streamingOverlayOpen && (
            <div className='overlay-active-indicator' title='Streaming Overlay Active'>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="12" r="10" />
                <path d="M9 12l2 2 4-4" stroke="white" strokeWidth="2" fill="none" />
              </svg>
            </div>
          )}
        </div>
      </div>

      <div className='session-stats'>
        <div className='stat'>
          <span className='stat-label'>Gross Value (Pre-Tax):</span>
          <span className='stat-value'>{calculateGrossValue().toLocaleString()} silver</span>
        </div>
        <div className='stat' style={{ textAlign: 'right' }}>
          <span className='stat-label'>Location:</span>
          <span className='stat-value'>{session.location?.name}</span>
        </div>
        <div className='stat tax-breakdown-stat'>
          <div className='tax-stat-header' onClick={() => setShowTaxBreakdown(!showTaxBreakdown)}>
            <span className='stat-label'>Post-Tax Value:</span>
            <span className='stat-value'>{calculateTotalValue().toLocaleString()} silver</span>
            <span className={`tax-accordion-icon ${showTaxBreakdown ? 'expanded' : ''}`}>
              ▼
            </span>
          </div>
          {showTaxBreakdown && (
            <div className='tax-breakdown-details'>
              {(() => {
                const breakdown = getTaxBreakdown();
                return (
                  <>
                    <div className='breakdown-row'>
                      <span className='breakdown-label'>Total Gross Value:</span>
                      <span className='breakdown-value'>{breakdown.grossValue.toLocaleString()} silver</span>
                    </div>
                    
                    {breakdown.nonTaxableValue > 0 && (
                      <div className='breakdown-row non-taxable'>
                        <span className='breakdown-label'>└ Trash Loot (Tax-Free):</span>
                        <span className='breakdown-value'>{breakdown.nonTaxableValue.toLocaleString()} silver</span>
                      </div>
                    )}
                    
                    {(breakdown.nonTaxableValue > 0 && breakdown.taxableGrossValue > 0) && (
                      <div className='breakdown-divider'></div>
                    )}
                    
                    {breakdown.taxableGrossValue > 0 && (
                      <>
                        <div className='breakdown-row taxable'>
                          <span className='breakdown-label'>└ Marketplace & Conversion Items (Pre-Tax):</span>
                          <span className='breakdown-value'>{breakdown.taxableGrossValue.toLocaleString()} silver</span>
                        </div>
                        <div className='breakdown-row tax-deduction'>
                          <span className='breakdown-label'>  Base Tax (35%):</span>
                          <span className='breakdown-value'>-{(breakdown.taxableGrossValue * 0.35).toLocaleString()} silver</span>
                        </div>
                        <div className='breakdown-row base-after-tax'>
                          <span className='breakdown-label'>  After Base Tax:</span>
                          <span className='breakdown-value'>{(breakdown.taxableGrossValue * 0.65).toLocaleString()} silver</span>
                        </div>
                        {breakdown.bonuses.valuePack && (
                          <div className='breakdown-row bonus'>
                            <span className='breakdown-label'>  Value Pack (+30%):</span>
                            <span className='breakdown-value'>+{(breakdown.taxableGrossValue * 0.65 * 0.30).toLocaleString()} silver</span>
                          </div>
                        )}
                        {breakdown.bonuses.richMerchantRing && (
                          <div className='breakdown-row bonus'>
                            <span className='breakdown-label'>  Rich Merchant Ring (+5%):</span>
                            <span className='breakdown-value'>+{(breakdown.taxableGrossValue * 0.65 * 0.05).toLocaleString()} silver</span>
                          </div>
                        )}
                        {breakdown.bonuses.familyFame > 0 && (
                          <div className='breakdown-row bonus'>
                            <span className='breakdown-label'>  Family Fame ({breakdown.bonuses.familyFame.toLocaleString()}):</span>
                            <span className='breakdown-value'>+{(() => {
                              // Family Fame bonus is applied to the base post-tax amount (not after other bonuses)
                              const basePostTax = breakdown.taxableGrossValue * 0.65;
                              const familyFameBonus = basePostTax * (breakdown.bonuses.familyFame >= 7000 ? 0.015 : breakdown.bonuses.familyFame >= 4000 ? 0.01 : breakdown.bonuses.familyFame >= 1000 ? 0.005 : 0);
                              return familyFameBonus.toLocaleString();
                            })()} silver</span>
                          </div>
                        )}
                        {(breakdown.bonuses.valuePack || breakdown.bonuses.richMerchantRing || breakdown.bonuses.familyFame > 0) && (
                          <>
                            <div className='breakdown-row taxable-subtotal'>
                              <span className='breakdown-label'>  Marketplace & Conversion Subtotal:</span>
                              <span className='breakdown-value'>{breakdown.taxablePostTaxValue.toLocaleString()} silver</span>
                            </div>
                            <div className='breakdown-row effective-rate'>
                              <span className='breakdown-label'>Tax Savings on Taxable Items:</span>
                              <span className='breakdown-value'>{(65 - breakdown.effectiveTaxRate).toFixed(1)}%</span>
                            </div>
                          </>
                        )}
                      </>
                    )}
                    
                    {breakdown.postTaxValue > 0 && (
                      <div className='breakdown-row final-total'>
                        <span className='breakdown-label'>Final Total:</span>
                        <span className='breakdown-value'>{breakdown.postTaxValue.toLocaleString()} silver</span>
                      </div>
                    )}
                    
                    {breakdown.grossValue === 0 && (
                      <div className='breakdown-row'>
                        <span className='breakdown-label'>No loot collected yet</span>
                        <span className='breakdown-value'>0 silver</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {!streamingOverlayOpen && (
        <div className='active-loot-items'>
          <h4>Loot</h4>
          <div className='active-items-grid'>
            {lootTableItems.map(item => {
              const count = session.itemCounts.get(item.id) || 0;
              
              // Calculate post-tax price for active session display
              let postTaxPrice = 0;
              
              if (item.type === "marketplace") {
                // Use calculatedPrice as the raw price and apply tax
                const preTaxPrice = item.calculatedPrice;
                postTaxPrice = calculatePostTaxValue(
                  preTaxPrice,
                  taxSettings.value_pack,
                  taxSettings.rich_merchant_ring,
                  taxSettings.family_fame
                );
              } else if (item.type === "trash_loot") {
                // Trash loot is not taxed
                postTaxPrice = item.calculatedPrice;
              } else if (item.type === "conversion" && item.convertible_to_bdo_item_id && item.conversion_ratio) {
                const userRegion = userPreferences.preferred_region;
                const targetItem = lootTableItems.find(i => 
                  i.bdo_item_id === item.convertible_to_bdo_item_id && 
                  i.region === userRegion && 
                  i.type === "marketplace"
                );
                
                if (targetItem) {
                  // Use target item's calculatedPrice as raw price and apply tax
                  const targetPostTaxPrice = calculatePostTaxValue(
                    targetItem.calculatedPrice,
                    taxSettings.value_pack,
                    taxSettings.rich_merchant_ring,
                    taxSettings.family_fame
                  );
                  postTaxPrice = targetPostTaxPrice / item.conversion_ratio;
                } else {
                  // Fallback: estimate tax on the conversion item
                  const rawConversionPrice = item.calculatedPrice;
                  const estimatedMarketplacePrice = rawConversionPrice * item.conversion_ratio;
                  const taxedMarketplacePrice = calculatePostTaxValue(
                    estimatedMarketplacePrice,
                    taxSettings.value_pack,
                    taxSettings.rich_merchant_ring,
                    taxSettings.family_fame
                  );
                  postTaxPrice = taxedMarketplacePrice / item.conversion_ratio;
                }
              }
              
              const totalValue = count * Math.round(postTaxPrice);
              
              return (
                <div key={item.id} className='active-loot-item'>
                  <div className='item-image-container'>
                    {item.image_url ? (
                      <img 
                        src={item.image_url} 
                        alt={item.name}
                        className='item-image'
                      />
                    ) : (
                      <div className='item-image-placeholder'>📦</div>
                    )}
                  </div>
                  <div className='item-info'>
                    <span className='item-name' title={item.name}>
                      {item.name}
                    </span>
                    <div className='item-counter'>
                      <span className='count'>{count}</span>
                      <span className='value'>
                        {totalValue.toLocaleString()} silver
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {streamingOverlayOpen && (
        <div className='overlay-active-message'>
          <h4>Streaming Overlay Active</h4>
          <p>Loot tracking is displayed in the overlay window to save resources.</p>
        </div>
      )}

      <div className='session-actions'>
        <button onClick={onStopSession} className='stop-session-button'>
          Stop Session
        </button>
        {/* Test button for item detection */}
        {lootTableItems.length > 0 && (
          <button 
            onClick={() => {
              // Randomly select an item from the loot table
              const randomIndex = Math.floor(Math.random() * lootTableItems.length);
              const randomItem = lootTableItems[randomIndex];
              onItemDetected(null, { itemName: randomItem.name, itemId: randomItem.id });
            }}
            className='test-item-button'
            style={{ 
              background: '#28a745', 
              border: '2px solid #28a745',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          >
            🧪 Test Random Item
          </button>
        )}
      </div>
    </div>
  );
};
