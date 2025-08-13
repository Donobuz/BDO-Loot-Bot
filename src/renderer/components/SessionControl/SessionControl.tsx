import React, { useState, useEffect } from "react";
import { UserPreferences, Location, Item, LootTable } from "../../types";
import { useModal } from "../../contexts/ModalContext";
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
  const [currentTime, setCurrentTime] = useState(new Date());

  // Modal context for refresh warning
  const { showModal, hideModal } = useModal();

  const hasOCRRegion =
    userPreferences.designated_ocr_region &&
    userPreferences.designated_ocr_region.width > 0 &&
    userPreferences.designated_ocr_region.height > 0;

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

  // Load loot table items when location is selected
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
    window.electronAPI.onSessionCleanup(handleSessionCleanup);

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
        itemCounts: Object.fromEntries(session.itemCounts),
        sessionStartTime: session.startTime?.toISOString()
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
    if (!selectedLocation) {
      console.error("No location selected");
      return;
    }

    try {
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
        sessionStartTime: session.startTime?.toISOString() || new Date().toISOString()
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
      totalValue += count * item.calculatedPrice;
    });
    return totalValue;
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
          <div className='session-controls'>
            <div className='session-duration'>
              {formatSessionDuration(session.startTime)}
            </div>
            {!streamingOverlayOpen && (
              <button 
                onClick={handleOpenStreamingOverlay}
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
            <span className='stat-label'>Total Value:</span>
            <span className='stat-value'>{calculateTotalValue().toLocaleString()} silver</span>
          </div>
          <div className='stat'>
            <span className='stat-label'>Location:</span>
            <span className='stat-value'>{session.location?.name}</span>
          </div>
        </div>

        {!streamingOverlayOpen && (
          <div className='active-loot-items'>
            <h4>Loot</h4>
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
            <h4>Streaming Overlay Active</h4>
            <p>Loot tracking is displayed in the overlay window to save resources.</p>
          </div>
        )}

        <div className='session-actions'>
          <button onClick={handleStopSession} className='stop-session-button'>
            Stop Session
          </button>
          {/* Test button for item detection */}
          {lootTableItems.length > 0 && (
            <button 
              onClick={() => handleItemDetected(null, { itemName: lootTableItems[0].name, itemId: lootTableItems[0].id })}
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
              🧪 Test Item Detection
            </button>
          )}
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
