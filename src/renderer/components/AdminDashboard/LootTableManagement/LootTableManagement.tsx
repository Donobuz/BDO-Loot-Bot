import React, { useState, useEffect } from 'react';
import { LootTable, Location, Item } from '../../../types';
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
  const [isCreating, setIsCreating] = useState(false);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load locations, loot tables, and items
      const [locationsResult, lootTablesResult, itemsResult] = await Promise.all([
        window.electronAPI.locations.getActive(),
        window.electronAPI.lootTables.getActive(),
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

  const createLootTable = async (locationId: number) => {
    try {
      setIsCreating(true);
      const result = await window.electronAPI.lootTables.create({
        location_id: locationId,
        item_ids: [],
        archived: null
      });

      if (result.success) {
        setSelectedLootTable(result.data!);
        setLootTables(prev => [...prev, result.data!]);
        setIsCreating(false);
      } else {
        setError(result.error || 'Failed to create loot table');
      }
    } catch (err) {
      console.error('Error creating loot table:', err);
      setError(err instanceof Error ? err.message : 'Failed to create loot table');
    } finally {
      setIsCreating(false);
    }
  };

  const addItemToLootTable = async () => {
    if (!selectedLootTable || !selectedItemId) return;

    try {
      const result = await window.electronAPI.lootTables.addItem(selectedLootTable.id, selectedItemId);
      if (result.success) {
        setSelectedLootTable(result.data!);
        setLootTables(prev => 
          prev.map(lt => lt.id === selectedLootTable.id ? result.data! : lt)
        );
        setShowAddItemModal(false);
        setSelectedItemId(null);
      } else {
        setError(result.error || 'Failed to add item to loot table');
      }
    } catch (err) {
      console.error('Error adding item to loot table:', err);
      setError(err instanceof Error ? err.message : 'Failed to add item to loot table');
    }
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

  if (loading) {
    return (
      <div className="loot-table-management">
        <div className="loading">
          <div className="loading-spinner"></div>
          <p>Loading loot table data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loot-table-management">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={loadData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="loot-table-management">
      <div className="header">
        <h2>Loot Table Management</h2>
        <p>Manage loot tables for each location</p>
      </div>

      <div className="loot-table-content">
        <div className="location-selector">
          <h3>Select Location</h3>
          <div className="location-list">
            {locations.map(location => (
              <div 
                key={location.id}
                className={`location-item ${selectedLocationId === location.id ? 'selected' : ''}`}
                onClick={() => handleLocationSelect(location.id)}
              >
                <div className="location-info">
                  <h4>{location.name}</h4>
                  <p>AP: {location.ap} | DP: {location.dp}</p>
                  <p>Monster: {location.monster_type}</p>
                </div>
                <div className="location-status">
                  {lootTables.some(lt => lt.location_id === location.id) ? (
                    <span className="has-loot-table">Has Loot Table</span>
                  ) : (
                    <span className="no-loot-table">No Loot Table</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="loot-table-editor">
          {selectedLocationId ? (
            <div className="loot-table-content">
              <div className="loot-table-header">
                <h3>Loot Table for {getLocationById(selectedLocationId)?.name}</h3>
                {!selectedLootTable && (
                  <button 
                    onClick={() => createLootTable(selectedLocationId)}
                    className="create-loot-table-btn"
                    disabled={isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Create Loot Table'}
                  </button>
                )}
              </div>

              {selectedLootTable ? (
                <div className="loot-table-items">
                  <div className="items-header">
                    <h4>Items in Loot Table ({selectedLootTable.item_ids.length})</h4>
                    <button 
                      onClick={openAddItemModal}
                      className="add-item-btn"
                    >
                      + Add Item
                    </button>
                  </div>

                  <div className="items-list">
                    {selectedLootTable.item_ids.length === 0 ? (
                      <p className="no-items">No items in this loot table yet. Click "Add Item" to get started.</p>
                    ) : (
                      selectedLootTable.item_ids.map(itemId => {
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
                                {item.region && <p>Region: {item.region}</p>}
                              </div>
                            </div>
                            <button 
                              onClick={() => removeItemFromLootTable(itemId)}
                              className="remove-item-btn"
                            >
                              Remove
                            </button>
                          </div>
                        ) : null;
                      })
                    )}
                  </div>
                </div>
              ) : (
                <p className="no-loot-table-message">
                  This location doesn't have a loot table yet. Create one to start adding items.
                </p>
              )}
            </div>
          ) : (
            <div className="no-location-selected">
              <p>Select a location from the list to view or edit its loot table.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItemModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add Item to Loot Table</h3>
              <button 
                onClick={() => setShowAddItemModal(false)}
                className="modal-close"
              >
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="item-selector">
                <label>Select Item:</label>
                <select 
                  value={selectedItemId || ''}
                  onChange={(e) => setSelectedItemId(Number(e.target.value) || null)}
                >
                  <option value="">-- Select an item --</option>
                  {availableItems.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name} (ID: {item.bdo_item_id}) - {item.type}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => setShowAddItemModal(false)}
                className="cancel-btn"
              >
                Cancel
              </button>
              <button 
                onClick={addItemToLootTable}
                className="add-btn"
                disabled={!selectedItemId}
              >
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
