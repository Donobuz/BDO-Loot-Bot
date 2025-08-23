import { useState, useEffect } from 'react';
import { LootTable, Location, Item } from '../../../types';
import { SearchableSelect } from '../../SearchableSelect';
import Modal from '../../Modal/Modal';
import LocationSelector from './LocationSelector';
import './LootTableManagement.css';

interface LootTableManagementProps {}

export default function LootTableManagement({}: LootTableManagementProps) {
  const [lootTables, setLootTables] = useState<LootTable[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);
  const [selectedLootTable, setSelectedLootTable] = useState<LootTable | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [_, setSelectedItemId] = useState<number | null>(null);
  const [stagedItems, setStagedItems] = useState<Item[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load active locations, loot tables, and items
      const [locationsResult, lootTablesResult, itemsResult] = await Promise.all([
        window.electronAPI.locations.getActive(),
        window.electronAPI.lootTables.getAll(),
        window.electronAPI.items.getActive()
      ]);

      if (!locationsResult.success) {
        throw new Error(locationsResult.error || 'Failed to load locations');
      }
      if (!lootTablesResult.success) {
        throw new Error(lootTablesResult.error || 'Failed to load loot tables');
      }
      if (!itemsResult.success) {
        throw new Error(itemsResult.error || 'Failed to load items');
      }

      setLocations(locationsResult.data || []);
      setLootTables(lootTablesResult.data || []);
      setItems(itemsResult.data || []);

    } catch (err) {
      console.error('Error loading data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const loadLootTableForLocation = async (locationId: number) => {
    try {
      const result = await window.electronAPI.lootTables.getByLocationId(locationId);
      if (result.success) {
        setSelectedLootTable(result.data || null);
      } else {
        setError(result.error || 'Failed to load loot table');
      }
    } catch (err) {
      console.error('Error loading loot table:', err);
      setError(err instanceof Error ? err.message : 'Failed to load loot table');
    }
  };

  const addItemToLootTable = async () => {
    if (!selectedLootTable || stagedItems.length === 0) return;

    try {
      // Add all staged items to the loot table
      for (const item of stagedItems) {
        const result = await window.electronAPI.lootTables.addItem(selectedLootTable.id, item.id);
        if (result.success) {
          setSelectedLootTable(result.data!);
          setLootTables(prev => 
            prev.map(lt => lt.id === selectedLootTable.id ? result.data! : lt)
          );
        } else {
          setError(result.error || `Failed to add item: ${item.name}`);
          return; // Stop on first error
        }
      }

      // Close modal and reset state
      setShowAddItemModal(false);
      setStagedItems([]);
      setSelectedItemId(null);
    } catch (err) {
      console.error('Error adding items to loot table:', err);
      setError(err instanceof Error ? err.message : 'Failed to add items to loot table');
    }
  };

  const addItemToStaging = (itemId: number) => {
    const item = availableItems.find(item => item.id === itemId);
    if (item && !stagedItems.find(staged => staged.bdo_item_id === item.bdo_item_id)) {
      setStagedItems(prev => [...prev, item]);
    }
  };

  const removeItemFromStaging = (bdoItemId: number) => {
    setStagedItems(prev => prev.filter(item => item.bdo_item_id !== bdoItemId));
  };

  const removeItemFromLootTable = async (itemId: number) => {
    if (!selectedLootTable) return;

    try {
      const result = await window.electronAPI.lootTables.removeItem(selectedLootTable.id, itemId);
      if (result.success) {
        setSelectedLootTable(result.data!);
        setLootTables(prev => 
          prev.map(lt => lt.id === selectedLootTable.id ? result.data! : lt)
        );
      } else {
        setError(result.error || 'Failed to remove item from loot table');
      }
    } catch (err) {
      console.error('Error removing item from loot table:', err);
      setError(err instanceof Error ? err.message : 'Failed to remove item from loot table');
    }
  };

  const handleLocationSelect = (locationId: number) => {
    setSelectedLocationId(locationId);
    loadLootTableForLocation(locationId);
  };

  const openAddItemModal = () => {
    // Filter out items that are already in the loot table
    const currentItemIds = selectedLootTable?.item_ids || [];
    const available = items.filter(item => !currentItemIds.includes(item.id));
    setAvailableItems(available);
    setShowAddItemModal(true);
  };

  const getItemById = (itemId: number): Item | undefined => {
    return items.find(item => item.id === itemId);
  };

  const getLocationById = (locationId: number): Location | undefined => {
    return locations.find(location => location.id === locationId);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter out items that are already in the current loot table and deduplicate by bdo_item_id
  const filteredAvailableItems = availableItems
    .filter(item => {
      if (!selectedLootTable) return true;
      // Check if any item in the loot table has the same bdo_item_id
      const lootTableItems = selectedLootTable.item_ids.map(id => getItemById(id)).filter(Boolean) as Item[];
      return !lootTableItems.some(lootItem => lootItem.bdo_item_id === item.bdo_item_id);
    })
    .filter((item, index, array) => {
      // Deduplicate by bdo_item_id - keep only the first occurrence
      return array.findIndex(i => i.bdo_item_id === item.bdo_item_id) === index;
    });

  if (loading) {
    return (
      <div className="loot-table-management">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <h3>Loading Loot Table Management</h3>
          <p>Fetching locations, items, and loot tables...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loot-table-management">
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>Error Loading Data</h3>
          <p>{error}</p>
          <button onClick={loadData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="loot-table-management">
      {error && (
        <div className="error-message">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="header">
        <h2>Loot Table Management</h2>
        <p>Manage loot tables for each location</p>
      </div>

      {/* Location Selector */}
      <div className="location-selector-section">
        <LocationSelector
          locations={locations}
          selectedLocationId={selectedLocationId}
          onLocationSelect={handleLocationSelect}
          lootTables={lootTables}
          onLocationUpdate={loadData}
        />
      </div>

      {/* Loot Table Content */}
      {selectedLocationId && (
        <div className="loot-table-section">
          <div className="loot-table-header">
            <div className="header-info">
              <h3>{getLocationById(selectedLocationId)?.name} - Loot Table</h3>
              <p>{getLocationById(selectedLocationId)?.monster_type}</p>
            </div>
            <div className="header-actions">
              {selectedLootTable && (
                <button 
                  onClick={openAddItemModal}
                  className="add-item-btn"
                >
                  + Add Item
                </button>
              )}
            </div>
          </div>

          {selectedLootTable ? (
            <div className="loot-table-items">
              <div className="items-header">
                <h4>Items in this loot table ({selectedLootTable.item_ids.length})</h4>
              </div>
              
              {selectedLootTable.item_ids.length === 0 ? (
                <div className="no-items">
                  <p>No items in this loot table yet.</p>
                  <p>Click "Add Item" to get started.</p>
                </div>
              ) : (
                <div className="items-list">
                  {selectedLootTable.item_ids.map(itemId => {
                    const item = getItemById(itemId);
                    return item ? (
                      <div key={itemId} className="loot-table-item">
                        <div className="item-info">
                          {item.image_url && (
                            <img 
                              src={item.image_url} 
                              alt={item.name}
                              className="item-image"
                            />
                          )}
                          <div className="item-details">
                            <h5>{item.name}</h5>
                            <p>BDO ID: {item.bdo_item_id}</p>
                            <p>Type: {item.type}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => removeItemFromLootTable(itemId)}
                          className="remove-item-btn"
                          title="Remove this item"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="no-loot-table lt-error-state">
              <p>⚠️ This location is missing its loot table!</p>
              <p>This should not happen. Please contact support or try refreshing the page.</p>
            </div>
          )}
        </div>
      )}

      {/* Add Item Modal */}
      <Modal 
        isOpen={showAddItemModal} 
        onClose={() => {
          setShowAddItemModal(false);
          setStagedItems([]);
          setSelectedItemId(null);
        }}
        title="Add Items to Loot Table"
        width="800px"
      >
        <div className="modal-content-full">
          <div className="add-item-section">
            <h4>Select Item to Add</h4>
            <div className="item-selection-row">
              <SearchableSelect
                options={filteredAvailableItems}
                value={null} // Always null since we reset after selection
                onChange={(item) => {
                  if (item) {
                    addItemToStaging(item.id);
                  }
                }}
                placeholder="Search and select an item to add..."
                getDisplayValue={(item) => `${item.name} (${item.type})`}
                getOptionDisplay={(item) => ({
                  primary: item.name,
                  secondary: `ID: ${item.bdo_item_id} • ${item.type} • ${item.base_price.toLocaleString()} silver`
                })}
                searchFunction={(item, searchTerm) => {
                  const term = searchTerm.toLowerCase();
                  return (
                    item.name.toLowerCase().includes(term) ||
                    item.type.toLowerCase().includes(term) ||
                    item.bdo_item_id.toString().includes(term)
                  );
                }}
              />
            </div>
          </div>

          {stagedItems.length > 0 && (
            <div className="staging-section">
              <h4>Staged Items ({stagedItems.length})</h4>
              <div className="staged-items-grid">
                {stagedItems.map(item => (
                  <div key={item.bdo_item_id} className="staged-item">
                    <span className="staged-item-name">{item.name}</span>
                    <span className="staged-item-details">(ID: {item.bdo_item_id}) - {item.type}</span>
                    <button 
                      onClick={() => removeItemFromStaging(item.bdo_item_id)}
                      className="remove-staged-btn"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button onClick={() => {
              setShowAddItemModal(false);
              setStagedItems([]);
              setSelectedItemId(null);
            }} className="btn btn-secondary">
              Cancel
            </button>
            <button 
              onClick={addItemToLootTable} 
              disabled={stagedItems.length === 0}
              className="btn btn-primary"
            >
              Add Item{stagedItems.length !== 1 ? 's' : ''}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
