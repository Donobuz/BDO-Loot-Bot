import React, { useState, useEffect } from "react";
import { UserPreferences, Location, Item, LootTable, TaxCalculations } from "../../types";
import { useModal } from "../../contexts/ModalContext";
import { TAX_CONSTANTS } from "../../constants/taxes";
import { calculatePostTaxValue } from "../../utils/taxCalculations";
import { SearchableSelect } from "../SearchableSelect";
import { ActiveSession } from "./ActiveSession";
import "./SessionControl.css";

interface SessionControlProps {
  userPreferences: UserPreferences;
  onOpenSettings: () => void;
}

interface SessionState {
  isActive: boolean;
  startTime?: Date;
  location?: Location;
  itemCounts: Map<number, number>; // item.id -> count
}

interface ItemWithPrice extends Item {
  calculatedPrice: number;
}

export const SessionControl: React.FC<SessionControlProps> = ({
  userPreferences,
  onOpenSettings,
}) => {
  const [session, setSession] = useState<SessionState>({
    isActive: false,
    itemCounts: new Map(),
  });
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(
    null
  );
  const [lootTableItems, setLootTableItems] = useState<ItemWithPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [locationLootTables, setLocationLootTables] = useState<
    Map<number, boolean>
  >(new Map());
  const [isOverlayFocused, setIsOverlayFocused] = useState(false);
  const [streamingOverlayOpen, setStreamingOverlayOpen] = useState(false);
  
  // Tax calculation state (local state, not saved until session starts)
  const [taxSettings, setTaxSettings] = useState<TaxCalculations>({
    value_pack: userPreferences.tax_calculations?.value_pack ?? false,
    rich_merchant_ring: userPreferences.tax_calculations?.rich_merchant_ring ?? false,
    family_fame: userPreferences.tax_calculations?.family_fame ?? 0,
  });

  // Modal context for refresh warning
  const { showModal, hideModal } = useModal();

  const hasOCRRegion =
    userPreferences.designated_ocr_region &&
    userPreferences.designated_ocr_region.width > 0 &&
    userPreferences.designated_ocr_region.height > 0;

  // Handle tax setting changes (local only, not saved to database)
  const handleTaxSettingChange = (
    field: keyof TaxCalculations,
    value: boolean | number
  ) => {
    const newTaxSettings = { ...taxSettings, [field]: value };
    setTaxSettings(newTaxSettings);
    // Note: We don't recalculate item prices here since the loot table should show raw values
    // Tax calculations are only applied during active sessions
  };

  // Event handlers for overlay lifecycle
  const handleOverlayOpened = () => {
    setStreamingOverlayOpen(true);
  };

  const handleOverlayClosed = () => {
    setStreamingOverlayOpen(false);
  };

  const handleSessionCleanup = (data: any) => {
    // Stop current session if active
    if (session.isActive) {
      setSession(prev => ({
        ...prev,
        isActive: false,
        startTime: undefined,
        itemCounts: new Map()
      }));
    }
    
    // Close overlay if open
    if (streamingOverlayOpen) {
      setStreamingOverlayOpen(false);
    }
  };

  const handleItemDetected = (event: any, data: any) => {
    if (!session.isActive) return;

    setSession(prev => {
      const newItemCounts = new Map(prev.itemCounts);
      const currentCount = newItemCounts.get(data.itemId) || 0;
      newItemCounts.set(data.itemId, currentCount + 1);

      return {
        ...prev,
        itemCounts: newItemCounts
      };
    });
  };

  // Load locations on component mount
  useEffect(() => {
    loadLocations();
  }, []);

  // Update tax settings when user preferences change (reset to saved values)
  useEffect(() => {
    setTaxSettings({
      value_pack: userPreferences.tax_calculations?.value_pack ?? false,
      rich_merchant_ring: userPreferences.tax_calculations?.rich_merchant_ring ?? false,
      family_fame: userPreferences.tax_calculations?.family_fame ?? 0,
    });
  }, [userPreferences.tax_calculations]);

  // Load loot table items when location is selected (tax settings handled in handleTaxSettingChange)
  useEffect(() => {
    if (selectedLocation) {
      loadLootTableItems(selectedLocation.id);
    } else {
      setLootTableItems([]);
    }
  }, [selectedLocation]);

  // Listen for streaming overlay events
  useEffect(() => {
    // Set up the listeners
    window.electronAPI.onStreamingOverlayOpened(handleOverlayOpened);
    window.electronAPI.onStreamingOverlayClosed(handleOverlayClosed);
    window.electronAPI.onStreamingOverlayFocused(() => {
      setIsOverlayFocused(true);
    });
    window.electronAPI.onStreamingOverlayBlurred(() => {
      setIsOverlayFocused(false);
    });

    // Check initial state on mount
    const checkInitialState = async () => {
      try {
        const result = await window.electronAPI.isStreamingOverlayOpen();
        if (result.success) {
          setStreamingOverlayOpen(result.isOpen);
        }
      } catch (error) {
        console.error('Failed to check initial overlay state:', error);
      }
    };

    checkInitialState();

    return () => {
      // Note: IPC listeners in Electron renderer are managed by the main process
    };
  }, []);

  // Prevent page refresh when session is active
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Cmd+R (Mac) or Ctrl+R (Windows/Linux) or F5
      const isRefreshShortcut = 
        (event.metaKey && event.key === 'r') || // Cmd+R (Mac)
        (event.ctrlKey && event.key === 'r') || // Ctrl+R (Windows/Linux)
        event.key === 'F5'; // F5

      if (isRefreshShortcut && (session.isActive || (streamingOverlayOpen && !isOverlayFocused))) {
        event.preventDefault();
        
        const modalId = 'refresh-warning';
        
        // Show confirmation modal
        showModal({
          id: modalId,
          type: 'confirmation',
          title: 'Refresh Warning',
          message: session.isActive 
            ? 'You have an active grinding session. Refreshing will stop your session and all progress will be lost. Are you sure you want to continue?'
            : 'You have a streaming overlay open. Refreshing will close the overlay. Are you sure you want to continue?',
          confirmText: 'Continue',
          cancelText: 'Cancel',
          isDestructive: true,
          onConfirm: () => {
            // Close modal and reload
            hideModal(modalId);
            setTimeout(() => {
              window.location.reload();
            }, 100);
          },
          onClose: () => {
            // Close modal
            hideModal(modalId);
          }
        });
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [session.isActive, streamingOverlayOpen, showModal, hideModal]);

  // Update streaming overlay when session data changes
  useEffect(() => {
    if (streamingOverlayOpen && session.isActive) {
      const overlayData = {
        location: session.location,
        items: lootTableItems,
        itemCounts: Object.fromEntries(session.itemCounts),
        sessionStartTime: session.startTime?.toISOString(),
        grossValue: calculateGrossValue(),
        postTaxValue: calculateTotalValue(),
        taxBreakdown: getTaxBreakdown()
      };
      
      // Update overlay directly
      window.electronAPI.updateStreamingOverlay(overlayData).catch(error => {
        console.error('Failed to update streaming overlay:', error);
      });
    }
  }, [streamingOverlayOpen, session.isActive, session.startTime, session.location, session.itemCounts, lootTableItems]);

  const loadLocations = async () => {
    try {
      setLoading(true);

      // Load locations and loot tables in parallel
      const [locationsResult, lootTablesResult] = await Promise.all([
        window.electronAPI.locations.getActive(),
        window.electronAPI.lootTables.getActive(),
      ]);

      if (locationsResult.success && locationsResult.data) {
        setLocations(locationsResult.data);

        // Create a map of which locations have loot tables with items
        const lootTableMap = new Map<number, boolean>();

        if (lootTablesResult.success && lootTablesResult.data) {
          lootTablesResult.data.forEach((lootTable: LootTable) => {
            // Location has a loot table with items
            const hasItems =
              lootTable.item_ids && lootTable.item_ids.length > 0;
            lootTableMap.set(lootTable.location_id, hasItems);
          });
        }

        // Mark locations without loot tables as false
        locationsResult.data.forEach((location: Location) => {
          if (!lootTableMap.has(location.id)) {
            lootTableMap.set(location.id, false);
          }
        });

        setLocationLootTables(lootTableMap);
      } else {
        console.error("Failed to load locations:", locationsResult.error);
      }
    } catch (error) {
      console.error("Error loading locations:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadLootTableItems = async (locationId: number) => {
    try {
      // Get loot table for location
      const lootTableResult =
        await window.electronAPI.lootTables.getByLocationId(locationId);
      if (!lootTableResult.success || !lootTableResult.data) {
        setLootTableItems([]);
        return;
      }

      const lootTable = lootTableResult.data;
      if (!lootTable.item_ids || lootTable.item_ids.length === 0) {
        setLootTableItems([]);
        return;
      }

      // Get all items
      const itemsResult = await window.electronAPI.items.getActive();
      if (!itemsResult.success || !itemsResult.data) {
        setLootTableItems([]);
        return;
      }

      // Filter items that are in this loot table and calculate prices (without tax)
      const allItems = itemsResult.data || [];
      const lootItems = allItems
        .filter((item) => lootTable.item_ids.includes(item.id))
        .map((item) => calculateItemPrice(item, allItems, false)) // false = don't apply tax calculations
        .filter((item) => item !== null) as ItemWithPrice[];

      setLootTableItems(lootItems);
    } catch (error) {
      console.error("Error loading loot table items:", error);
      setLootTableItems([]);
    }
  };

  const calculateItemPrice = (
    item: Item,
    allItems: Item[],
    applyTaxCalculations: boolean = false
  ): ItemWithPrice | null => {
    let calculatedPrice = 0;
    const userRegion = userPreferences.preferred_region;

    if (item.type === "marketplace") {
      // For marketplace items, find the item in the user's preferred region
      const regionItem = allItems.find(
        (i) =>
          i.bdo_item_id === item.bdo_item_id &&
          i.region === userRegion &&
          i.type === "marketplace"
      );

      let preTaxPrice = 0;
      if (regionItem) {
        // COALESCE(last_sold_price, base_price) for the user's region
        preTaxPrice = regionItem.last_sold_price || regionItem.base_price;
      } else {
        // Fallback to the current item if no region-specific item found
        preTaxPrice = item.last_sold_price || item.base_price;
      }

      if (applyTaxCalculations) {
        // Apply tax calculations for marketplace items
        calculatedPrice = calculatePostTaxValue(
          preTaxPrice,
          taxSettings.value_pack,
          taxSettings.rich_merchant_ring,
          taxSettings.family_fame
        );
      } else {
        // Use raw pre-tax price
        calculatedPrice = preTaxPrice;
      }
    } else if (item.type === "trash_loot") {
      // base_price for trash loot (region-independent, no tax)
      calculatedPrice = item.base_price;
    } else if (
      item.type === "conversion" &&
      item.convertible_to_bdo_item_id &&
      item.conversion_ratio
    ) {
      // Find the target marketplace item in the user's preferred region
      const targetItem = allItems.find(
        (i) =>
          i.bdo_item_id === item.convertible_to_bdo_item_id &&
          i.region === userRegion &&
          i.type === "marketplace"
      );

      if (targetItem) {
        const targetPreTaxPrice = targetItem.last_sold_price || targetItem.base_price;
        
        if (applyTaxCalculations) {
          // Calculate the post-tax value of the target marketplace item
          const targetPostTaxPrice = calculatePostTaxValue(
            targetPreTaxPrice,
            taxSettings.value_pack,
            taxSettings.rich_merchant_ring,
            taxSettings.family_fame
          );
          
          // Use the post-tax price divided by conversion ratio
          calculatedPrice = targetPostTaxPrice / item.conversion_ratio;
        } else {
          // Use the raw pre-tax price divided by conversion ratio
          calculatedPrice = targetPreTaxPrice / item.conversion_ratio;
        }
      } else {
        // Fallback: try to find any item with the convertible_to_bdo_item_id
        const fallbackItem = allItems.find(
          (i) => i.bdo_item_id === item.convertible_to_bdo_item_id
        );
        if (fallbackItem) {
          const targetPreTaxPrice = fallbackItem.last_sold_price || fallbackItem.base_price;
          
          if (applyTaxCalculations) {
            // Calculate the post-tax value of the target marketplace item
            const targetPostTaxPrice = calculatePostTaxValue(
              targetPreTaxPrice,
              taxSettings.value_pack,
              taxSettings.rich_merchant_ring,
              taxSettings.family_fame
            );
            
            // Use the post-tax price divided by conversion ratio
            calculatedPrice = targetPostTaxPrice / item.conversion_ratio;
          } else {
            // Use the raw pre-tax price divided by conversion ratio
            calculatedPrice = targetPreTaxPrice / item.conversion_ratio;
          }
        } else {
          return null; // Skip if target item not found
        }
      }
    }

    return {
      ...item,
      calculatedPrice: Math.round(calculatedPrice),
    };
  };

  const handleStartSession = async () => {
    if (!selectedLocation) {
      console.error("No location selected");
      return;
    }

    try {
      // Save tax settings to database when starting session
      const result = await window.electronAPI.userPreferences.update(
        userPreferences.user_id,
        { tax_calculations: taxSettings }
      );
      
      if (!result.success) {
        console.error("Failed to save tax settings:", result.error);
        // Continue with session start even if tax settings failed to save
      }

      const newSession = {
        isActive: true,
        startTime: new Date(),
        location: selectedLocation,
        itemCounts: new Map(),
      };
      
      setSession(newSession);

    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  const handleStopSession = async () => {
    // Close streaming overlay if it's open
    if (streamingOverlayOpen) {
      try {
        await window.electronAPI.closeStreamingOverlay();
        setStreamingOverlayOpen(false);
      } catch (error) {
        console.error('Failed to close streaming overlay:', error);
      }
    }
    
    // Reset session state
    setSession({ 
      isActive: false, 
      itemCounts: new Map() 
    });
  };

  const handleOpenStreamingOverlay = async () => {
    // Don't allow opening if already open (button should be disabled anyway)
    if (streamingOverlayOpen) {
      return;
    }

    try {
      const overlayData = {
        location: session.location || selectedLocation || undefined, // Use selectedLocation if session hasn't started
        items: lootTableItems,
        itemCounts: Object.fromEntries(session.itemCounts),
        sessionStartTime: session.startTime?.toISOString() || new Date().toISOString(),
        grossValue: session.isActive ? calculateGrossValue() : 0,
        postTaxValue: session.isActive ? calculateTotalValue() : 0,
        taxBreakdown: session.isActive ? getTaxBreakdown() : null
      };
      
      const result = await window.electronAPI.openStreamingOverlay(overlayData);
      
      if (!result.success) {
        console.error('Failed to open streaming overlay:', result.error);
      }
      // Note: We don't set state here - we wait for the 'streaming-overlay-opened' event
    } catch (error) {
      console.error('Error opening streaming overlay:', error);
    }
  };



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
    const currentTime = new Date();
    const diff = currentTime.getTime() - startTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // If session is active, render the ActiveSession component
  if (session.isActive && session.startTime) {
    return (
      <ActiveSession
        session={session}
        lootTableItems={lootTableItems}
        taxSettings={taxSettings}
        userPreferences={userPreferences}
        streamingOverlayOpen={streamingOverlayOpen}
        onStopSession={handleStopSession}
        onOpenStreamingOverlay={handleOpenStreamingOverlay}
        onItemDetected={handleItemDetected}
      />
    );
  }

  return (
    <div className='session-control inactive'>
      <div className='session-header'>
        <div className='session-status'>
          <div className='status-indicator inactive'></div>
          <h3>Loot Detection</h3>
        </div>
      </div>

      {hasOCRRegion ? (
        <div className='session-ready'>
          <div className='location-selection'>
            <label htmlFor='location-select' className='location-label'>
              Select Grinding Location:
            </label>
            <SearchableSelect
              options={locations.filter(location => locationLootTables.get(location.id) || false)}
              value={selectedLocation}
              onChange={setSelectedLocation}
              placeholder="Choose a location..."
              disabled={loading}
              loading={loading}
              getDisplayValue={(location) => `${location.name} (AP: ${location.ap}, DP: ${location.dp})`}
              getOptionDisplay={(location) => ({
                primary: location.name,
                secondary: `AP: ${location.ap}, DP: ${location.dp}`
              })}
              searchFunction={(location, searchTerm) => 
                location.name.toLowerCase().includes(searchTerm.toLowerCase())
              }
            />
          </div>

          {selectedLocation && (
            <>
              {/* Tax Settings - Above loot table */}
              <div className='tax-settings-section'>
                <h5>Tax Calculations</h5>
                <div className='tax-settings-grid'>
                  <div className='tax-setting-item'>
                    <label className='tax-checkbox-label'>
                      <input
                        type='checkbox'
                        checked={taxSettings.value_pack}
                        onChange={(e) =>
                          handleTaxSettingChange('value_pack', e.target.checked)
                        }
                        className='tax-checkbox'
                      />
                      <span className='tax-setting-text'>
                        Value Pack (+30%)
                      </span>
                    </label>
                  </div>
                  
                  <div className='tax-setting-item'>
                    <label className='tax-checkbox-label'>
                      <input
                        type='checkbox'
                        checked={taxSettings.rich_merchant_ring}
                        onChange={(e) =>
                          handleTaxSettingChange('rich_merchant_ring', e.target.checked)
                        }
                        className='tax-checkbox'
                      />
                      <span className='tax-setting-text'>
                        Rich Merchant Ring (+5%)
                      </span>
                    </label>
                  </div>
                  
                  <div className='tax-setting-item family-fame-item'>
                    <label className='tax-fame-label'>
                      <span className='tax-setting-text'>Family Fame:</span>
                      <input
                        type='number'
                        min='0'
                        max={TAX_CONSTANTS.MAX_FAMILY_FAME}
                        value={taxSettings.family_fame}
                        onChange={(e) => {
                          let value = parseInt(e.target.value) || 0;
                          if (value > TAX_CONSTANTS.MAX_FAMILY_FAME) {
                            value = TAX_CONSTANTS.MAX_FAMILY_FAME;
                          }
                          handleTaxSettingChange('family_fame', value);
                        }}
                        className='tax-fame-input'
                        placeholder='0'
                      />
                    </label>
                  </div>
                </div>
                <p style={{ 
                  margin: '8px 0 0 0', 
                  fontSize: '0.75rem', 
                  color: 'var(--text-secondary)', 
                  fontStyle: 'italic',
                  textAlign: 'center'
                }}>
                  Settings will be saved when you start the session
                </p>
              </div>

              <div className='loot-items-section'>
                <h4>Loot Table</h4>
                {lootTableItems.length === 0 ? (
                  <p className='no-items'>
                    No items configured for this location.
                  </p>
                ) : (
                  <div className='loot-items-compact'>
                    {lootTableItems.map((item) => (
                      <div key={item.id} className='loot-item-compact'>
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
                        <div className='item-details'>
                          <span className='item-name' title={item.name}>
                            {item.name}
                          </span>
                          <div className='item-price-container'>
                            <input
                              type='text'
                              value={item.calculatedPrice.toString()}
                              onChange={(e) => {
                                const value = e.target.value;
                                // Allow only numbers and decimal point
                                if (/^\d*\.?\d*$/.test(value) || value === "") {
                                  const newPrice = parseFloat(value) || 0;
                                  setLootTableItems((prev) =>
                                    prev.map((i) =>
                                      i.id === item.id
                                        ? { ...i, calculatedPrice: newPrice }
                                        : i
                                    )
                                  );
                                }
                              }}
                              className='price-input-compact'
                              title={`Price for ${item.name}`}
                              placeholder='0'
                            />
                            <span className='currency-compact'>silver</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className='session-actions'>
            <button
              onClick={handleStartSession}
              className='start-session-button'
              disabled={!selectedLocation || lootTableItems.length === 0}
            >
              Start Loot Detection
            </button>
            <button
              onClick={onOpenSettings}
              className='configure-button secondary'
            >
              Reconfigure Region
            </button>
          </div>
        </div>
      ) : (
        <div className='session-not-ready'>
          <div className='setup-message'>
            <div className='setup-icon'>⚙️</div>
            <h4>Setup Required</h4>
            <p>
              Configure a screen region for automatic loot detection during
              grinding sessions.
            </p>
          </div>

          <div className='session-actions'>
            <button
              onClick={onOpenSettings}
              className='configure-button primary'
            >
              Configure Loot Detection
            </button>
          </div>

          <div className='setup-help'>
            <p className='help-text'>
              💡 Select the area of your screen where loot messages appear in
              BDO
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
