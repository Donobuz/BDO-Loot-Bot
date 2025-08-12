import React, { useState, useEffect } from "react";
import { UserPreferences, Location, Item, LootTable } from "../../types";
import "./SessionControl.css";

interface SessionControlProps {
  userPreferences: UserPreferences;
  onOpenSettings: () => void;
}

interface SessionState {
  isActive: boolean;
  startTime?: Date;
  location?: Location;
  itemsDetected: number;
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
    itemsDetected: 0,
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
  const [streamingOverlayOpen, setStreamingOverlayOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const hasOCRRegion =
    userPreferences.designated_ocr_region &&
    userPreferences.designated_ocr_region.width > 0 &&
    userPreferences.designated_ocr_region.height > 0;

  // Load locations on component mount
  useEffect(() => {
    loadLocations();
  }, []);

  // Load loot table items when location is selected
  useEffect(() => {
    if (selectedLocation) {
      loadLootTableItems(selectedLocation.id);
    } else {
      setLootTableItems([]);
    }
  }, [selectedLocation]);

  // Listen for streaming overlay close
  useEffect(() => {
    const handleOverlayClosed = () => {
      console.log('Overlay closed, restoring UI');
      setStreamingOverlayOpen(false);
    };

    window.electronAPI.onStreamingOverlayClosed(handleOverlayClosed);

    return () => {
      // Cleanup listener if needed
    };
  }, []);

  // Update timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Update streaming overlay when session data changes
  useEffect(() => {
    if (streamingOverlayOpen && session.isActive) {
      const overlayData = {
        location: session.location,
        items: lootTableItems,
        itemCounts: Object.fromEntries(session.itemCounts)
      };
      console.log('Updating overlay with data:', overlayData);
      window.electronAPI.updateStreamingOverlay(overlayData).catch(error => {
        console.error('Failed to update streaming overlay:', error);
      });
    }
  }, [streamingOverlayOpen, session.location, session.itemCounts, lootTableItems]);

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

      // Filter items that are in this loot table and calculate prices
      const allItems = itemsResult.data || [];
      const lootItems = allItems
        .filter((item) => lootTable.item_ids.includes(item.id))
        .map((item) => calculateItemPrice(item, allItems))
        .filter((item) => item !== null) as ItemWithPrice[];

      setLootTableItems(lootItems);
    } catch (error) {
      console.error("Error loading loot table items:", error);
      setLootTableItems([]);
    }
  };

  const calculateItemPrice = (
    item: Item,
    allItems: Item[]
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

      if (regionItem) {
        // COALESCE(last_sold_price, base_price) for the user's region
        calculatedPrice = regionItem.last_sold_price || regionItem.base_price;
      } else {
        // Fallback to the current item if no region-specific item found
        calculatedPrice = item.last_sold_price || item.base_price;
      }
    } else if (item.type === "trash_loot") {
      // base_price for trash loot (region-independent)
      calculatedPrice = item.base_price;
    } else if (
      item.type === "conversion" &&
      item.convertible_to_bdo_item_id &&
      item.conversion_ratio
    ) {
      // Find the target item in the user's preferred region
      const targetItem = allItems.find(
        (i) =>
          i.bdo_item_id === item.convertible_to_bdo_item_id &&
          i.region === userRegion &&
          i.type === "marketplace"
      );

      if (targetItem) {
        const targetPrice = targetItem.last_sold_price || targetItem.base_price;
        calculatedPrice = targetPrice / item.conversion_ratio;
      } else {
        // Fallback: try to find any item with the convertible_to_bdo_item_id
        const fallbackItem = allItems.find(
          (i) => i.bdo_item_id === item.convertible_to_bdo_item_id
        );
        if (fallbackItem) {
          const targetPrice =
            fallbackItem.last_sold_price || fallbackItem.base_price;
          calculatedPrice = targetPrice / item.conversion_ratio;
        } else {
          return null; // Skip if target item not found
        }
      }
    }

    return {
      ...item,
      calculatedPrice,
    };
  };

  const handleStartSession = async () => {
    if (!hasOCRRegion || !selectedLocation) {
      return; // This shouldn't happen as button should be disabled
    }

    try {
      // TODO: Start OCR scanning with the designated region
      setSession({
        isActive: true,
        startTime: new Date(),
        location: selectedLocation,
        itemsDetected: 0,
        itemCounts: new Map(),
      });

      console.log("Starting session at location:", selectedLocation.name);
      console.log("OCR region:", userPreferences.designated_ocr_region);
      console.log("Loot items to detect:", lootTableItems);
    } catch (error) {
      console.error("Failed to start session:", error);
    }
  };

  const handleStopSession = () => {
    setSession({ 
      isActive: false, 
      itemsDetected: 0, 
      itemCounts: new Map() 
    });
    console.log("Session stopped");
  };

  const handleOpenStreamingOverlay = async () => {
    try {
      const overlayData = {
        location: session.location,
        items: lootTableItems,
        itemCounts: Object.fromEntries(session.itemCounts)
      };
      console.log('Sending overlay data:', overlayData);
      const result = await window.electronAPI.openStreamingOverlay(overlayData);
      
      if (result.success) {
        setStreamingOverlayOpen(true);
        console.log('Streaming overlay opened');
      } else {
        console.error('Failed to open streaming overlay:', result.error);
      }
    } catch (error) {
      console.error('Failed to open streaming overlay:', error);
    }
  };



  const formatSessionDuration = (startTime: Date): string => {
    const diff = currentTime.getTime() - startTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  if (session.isActive && session.startTime) {
    return (
      <div className='session-control active'>
        <div className='session-header'>
          <div className='session-status'>
            <div className='status-indicator active'></div>
            <h3>Active Session</h3>
          </div>
          <div className='session-duration'>
            {formatSessionDuration(session.startTime)}
          </div>
        </div>

        <div className='session-stats'>
          <div className='stat'>
            <span className='stat-label'>Total Items:</span>
            <span className='stat-value'>{session.itemsDetected}</span>
          </div>
          <div className='stat'>
            <span className='stat-label'>Location:</span>
            <span className='stat-value'>{session.location?.name}</span>
          </div>
        </div>

        {!streamingOverlayOpen && (
          <div className='active-loot-items'>
            <h4>Loot Detected</h4>
            <div className='active-items-grid'>
            {lootTableItems.map(item => {
              const count = session.itemCounts.get(item.id) || 0;
              const totalValue = count * item.calculatedPrice;
              
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
            <div className='overlay-icon'>🎥</div>
            <h4>Streaming Overlay Active</h4>
            <p>Loot tracking is displayed in the overlay window to save resources.</p>
          </div>
        )}

        <div className='session-actions'>
          <button onClick={handleStopSession} className='stop-session-button'>
            Stop Session
          </button>
          <button 
            onClick={handleOpenStreamingOverlay}
            className='streaming-overlay-button'
          >
            🎥 Open Streaming Overlay
          </button>
        </div>
      </div>
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
            <select
              id='location-select'
              value={selectedLocation?.id || ""}
              onChange={(e) => {
                const locationId = parseInt(e.target.value);
                const location =
                  locations.find((l) => l.id === locationId) || null;
                setSelectedLocation(location);
              }}
              className='location-dropdown'
              disabled={loading}
            >
              <option value=''>
                {loading ? "Loading locations..." : "Choose a location..."}
              </option>
              {locations
                .filter(
                  (location) => locationLootTables.get(location.id) || false
                )
                .map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} (AP: {location.ap}, DP: {location.dp})
                  </option>
                ))}
            </select>
          </div>

          {selectedLocation && (
            <div className='loot-items-section'>
              <h4>Loot Items ({lootTableItems.length})</h4>
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
