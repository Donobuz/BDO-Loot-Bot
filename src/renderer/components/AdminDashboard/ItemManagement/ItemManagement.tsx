import React, { useState, useEffect, useMemo } from 'react';
import './ItemManagement.css';
import { Item } from '../../../types';
import ImageUpload from '../../ImageUpload';
import { ProcessedImage } from '../../../utils/imageUtils';
import { useModal } from '../../../contexts/ModalContext';
import { useConfirmation } from '../../../utils/modalHelpers';
import Modal from '../../Modal/Modal';

const REGIONS = ['NA', 'EU', 'SEA', 'MENA', 'KR', 'RU', 'JP', 'TH', 'TW', 'SA'];

type RegionStatus = 'pending' | 'loading' | 'success' | 'error' | 'skipped' | 'unarchived';

interface RegionStatusItem {
  region: string;
  status: RegionStatus;
  message?: string;
  itemName?: string;
}

const ItemManagement: React.FC = () => {
  const { showModal: showModalGlobal, hideModal } = useModal();
  const showConfirmationModal = useConfirmation(showModalGlobal, hideModal);
  
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [showCreationStatusModal, setShowCreationStatusModal] = useState(false);
  const [regionStatuses, setRegionStatuses] = useState<RegionStatusItem[]>([]);
  const [creationInProgress, setCreationInProgress] = useState(false);
  const [statusModalType, setStatusModalType] = useState<'create' | 'sync'>('create');
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Item>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedRegion, setSelectedRegion] = useState('ALL');
  const [selectedRegions, setSelectedRegions] = useState<string[]>(REGIONS);
  const [formData, setFormData] = useState({
    bdo_item_id: ''
  });
  const [pendingImage, setPendingImage] = useState<ProcessedImage | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [showBulkEditModal, setShowBulkEditModal] = useState(false);
  const [bulkEditingBdoItemId, setBulkEditingBdoItemId] = useState<number | null>(null);
  const [bulkEditItems, setBulkEditItems] = useState<Item[]>([]);
  const [showSimpleModal, setShowSimpleModal] = useState(false);

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.items.getAll();
      if (result.success) {
        setItems(result.data || []);
      } else {
        console.error('Failed to load items:', result.error);
      }
    } catch (error) {
      console.error('Error loading items:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort items based on search query, archive status, region, and sorting
  const filteredItems = useMemo(() => {
    let filtered = items.filter(item => 
      showArchived ? item.archived : !item.archived
    );

    // Filter by selected region
    if (selectedRegion !== 'ALL') {
      filtered = filtered.filter(item => item.region === selectedRegion);
    }

    // Search by name or BDO item ID
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name.toLowerCase().includes(query) ||
        item.bdo_item_id.toString().includes(query)
      );
    }

    // Sort the filtered results
    filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortDirection === 'asc' ? -1 : 1;
      if (bValue == null) return sortDirection === 'asc' ? 1 : -1;

      // Handle string sorting
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return filtered;
  }, [items, showArchived, searchQuery, sortField, sortDirection, selectedRegion]);

  // Group items by bdo_item_id for hierarchical display (only when viewing all regions)
  const groupedItems = useMemo(() => {
    if (selectedRegion !== 'ALL') return {};
    
    return filteredItems.reduce((groups, item) => {
      const bdoId = item.bdo_item_id;
      if (!groups[bdoId]) {
        groups[bdoId] = [];
      }
      groups[bdoId].push(item);
      return groups;
    }, {} as Record<number, Item[]>);
  }, [filteredItems, selectedRegion]);

  // State for tracking which item groups are expanded
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());

  const toggleGroupExpansion = (bdoItemId: number) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(bdoItemId)) {
        newSet.delete(bdoItemId);
      } else {
        newSet.add(bdoItemId);
      }
      return newSet;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.bdo_item_id.trim()) {
      alert('Please enter a BDO Item ID');
      return;
    }

    const bdoItemId = parseInt(formData.bdo_item_id) || 0;
    if (bdoItemId <= 0) {
      alert('Please enter a valid BDO Item ID');
      return;
    }

    try {
      setSyncing(true);
      
      if (editingItem) {
        // For editing, update the bdo_item_id
        const result = await window.electronAPI.items.update(editingItem.id, {
          bdo_item_id: bdoItemId
        });
        
        if (result.success) {
          await loadItems();
          handleCloseModal();
        } else {
          alert(`Failed to update item: ${result.error}`);
        }
      } else {
        // Initialize region statuses
        const initialStatuses: RegionStatusItem[] = REGIONS.map(region => ({
          region,
          status: 'pending' as RegionStatus,
          message: 'Waiting...'
        }));
        
        setRegionStatuses(initialStatuses);
        setStatusModalType('create');
        setShowCreationStatusModal(true);
        setCreationInProgress(true);
        handleCloseModal(); // Close the input modal
        
        // For new items, create one for each region with rate limiting
        let successCount = 0;
        let errorCount = 0;
        let skippedCount = 0;
        
        for (let i = 0; i < REGIONS.length; i++) {
          const region = REGIONS[i];
          
          // Update status to loading
          setRegionStatuses(prev => prev.map(status => 
            status.region === region 
              ? { ...status, status: 'loading' as RegionStatus, message: 'Creating...' }
              : status
          ));
          
          try {
            // Rate limit: 1000ms delay between API calls
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            const result = await window.electronAPI.items.createFromAPI(bdoItemId, region);
            
            if (result.unarchived) {
              successCount++;
              setRegionStatuses(prev => prev.map(status => 
                status.region === region 
                  ? { 
                      ...status, 
                      status: 'unarchived' as RegionStatus, 
                      message: 'Unarchived existing item',
                      itemName: result.data?.name 
                    }
                  : status
              ));
            } else if (result.skipped) {
              skippedCount++;
              setRegionStatuses(prev => prev.map(status => 
                status.region === region 
                  ? { 
                      ...status, 
                      status: 'skipped' as RegionStatus, 
                      message: 'Already exists' 
                    }
                  : status
              ));
            } else if (result.success) {
              successCount++;
              setRegionStatuses(prev => prev.map(status => 
                status.region === region 
                  ? { 
                      ...status, 
                      status: 'success' as RegionStatus, 
                      message: 'Created successfully',
                      itemName: result.data?.name 
                    }
                  : status
              ));
            } else {
              errorCount++;
              setRegionStatuses(prev => prev.map(status => 
                status.region === region 
                  ? { 
                      ...status, 
                      status: 'error' as RegionStatus, 
                      message: result.error || 'Unknown error' 
                    }
                  : status
              ));
            }
          } catch (error) {
            errorCount++;
            setRegionStatuses(prev => prev.map(status => 
              status.region === region 
                ? { 
                    ...status, 
                    status: 'error' as RegionStatus, 
                    message: 'Network error' 
                  }
                : status
            ));
          }
        }
        
        setCreationInProgress(false);
        
        // Handle image upload for new items if there's a pending image
        if (pendingImage && successCount > 0) {
          console.log(`📸 Uploading image for BDO Item ID ${bdoItemId}...`);
          
          try {
            // Convert the file to a Uint8Array for the IPC call
            const arrayBuffer = await pendingImage.file.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Upload image once and apply to all items with this bdo_item_id
            const imageUploadResult = await window.electronAPI.items.uploadImageForBdoItem(
              bdoItemId, 
              uint8Array, 
              pendingImage.file.name
            );
            
            if (imageUploadResult.success) {
              console.log(`✅ Image uploaded successfully and applied to ${imageUploadResult.data?.updatedItems || 0} items`);
            } else {
              console.warn('Failed to upload image:', imageUploadResult.error);
              // Don't show alert here as items were created successfully
            }
          } catch (imageError) {
            console.warn('Failed to upload image:', imageError);
            // Don't show alert here as items were created successfully
          }
        }
        
        await loadItems();
      }
    } catch (error) {
      console.error('Error saving item:', error);
      alert('An error occurred while saving the item');
      setCreationInProgress(false);
    } finally {
      setSyncing(false);
    }
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      bdo_item_id: item.bdo_item_id.toString()
    });
    handleOpenModal();
  };

  const handleCloseModal = () => {
    setEditingItem(null);
    setFormData({
      bdo_item_id: ''
    });
    setPendingImage(null);
    setImageUploadError(null);
    setShowSimpleModal(false);
  };

  const handleOpenModal = () => {
    setShowSimpleModal(true);
  };

  const handleArchive = async (item: Item) => {
    const confirmed = await showConfirmationModal({
      title: 'Archive Item',
      message: `Are you sure you want to archive "${item.name}" from the ${item.region} region?`,
      confirmText: 'Archive',
      onConfirm: () => {}, // Will be handled by the promise resolution
      isDestructive: true
    });

    if (confirmed) {
      try {
        const result = await window.electronAPI.items.archive(item.id);
        if (result.success) {
          await loadItems();
        } else {
          alert(`Failed to archive item: ${result.error}`);
        }
      } catch (error) {
        console.error('Error archiving item:', error);
        alert('An error occurred while archiving the item');
      }
    }
  };

  const handleRestore = async (id: number) => {
    try {
      const result = await window.electronAPI.items.unarchive(id);
      if (result.success) {
        await loadItems();
      } else {
        alert('Failed to restore item: ' + result.error);
      }
    } catch (error) {
      console.error('Error restoring item:', error);
      alert('An error occurred while restoring the item');
    }
  };

  const handleSyncPrices = async () => {
    if (selectedRegions.length === 0) {
      alert('Please select at least one region to sync');
      return;
    }

    const regionList = selectedRegions.join(', ');
    const confirmed = await showConfirmationModal({
      title: 'Sync Item Prices',
      message: `Sync all item prices from ${regionList}? This will update prices for all existing items and may take a few moments.`,
      confirmText: 'Sync Prices',
      onConfirm: () => {} // Will be handled by the promise resolution
    });

    if (confirmed) {
      try {
        setSyncing(true);
        
        // Initialize region statuses for sync
        const initialStatuses: RegionStatusItem[] = selectedRegions.map(region => ({
          region,
          status: 'pending' as RegionStatus,
          message: 'Waiting...'
        }));
        
        setRegionStatuses(initialStatuses);
        setStatusModalType('sync');
        setShowCreationStatusModal(true);
        setCreationInProgress(true);
        
        let totalUpdated = 0;
        let successCount = 0;
        let errorCount = 0;
        
        // Rate limit: 1000ms delay between API calls
        for (let i = 0; i < selectedRegions.length; i++) {
          const region = selectedRegions[i];
          
          // Update status to loading
          setRegionStatuses(prev => prev.map(status => 
            status.region === region 
              ? { ...status, status: 'loading' as RegionStatus, message: 'Syncing prices...' }
              : status
          ));
          
          try {
            // Rate limit: 1000ms delay between API calls
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
            
            const result = await window.electronAPI.items.syncPrices(region);
            
            if (result.success) {
              successCount++;
              const updatedItems = result.updated || 0;
              totalUpdated += updatedItems;
              
              setRegionStatuses(prev => prev.map(status => 
                status.region === region 
                  ? { 
                      ...status, 
                      status: 'success' as RegionStatus, 
                      message: `Updated ${updatedItems} items`
                    }
                  : status
              ));
            } else {
              errorCount++;
              setRegionStatuses(prev => prev.map(status => 
                status.region === region 
                  ? { 
                      ...status, 
                      status: 'error' as RegionStatus, 
                      message: result.error || 'Sync failed'
                    }
                  : status
              ));
            }
          } catch (error) {
            errorCount++;
            setRegionStatuses(prev => prev.map(status => 
              status.region === region 
                ? { 
                    ...status, 
                    status: 'error' as RegionStatus, 
                    message: 'Network error'
                  }
                : status
            ));
          }
        }
        
        setCreationInProgress(false);
        await loadItems();
        
      } catch (error) {
        console.error('Error syncing prices:', error);
        setCreationInProgress(false);
      } finally {
        setSyncing(false);
      }
    }
  };

  const handleRegionToggle = (region: string) => {
    setSelectedRegions(prev => 
      prev.includes(region) 
        ? prev.filter(r => r !== region)
        : [...prev, region]
    );
  };

  const handleOpenSyncModal = () => {
    setShowSyncModal(true);
  };

  const handleCloseSyncModal = () => {
    setShowSyncModal(false);
  };

  const handleCloseCreationStatusModal = () => {
    setShowCreationStatusModal(false);
    setRegionStatuses([]);
  };

  const handleImageProcessed = (processedImage: ProcessedImage | null) => {
    setPendingImage(processedImage);
    setImageUploadError(null);
  };

  const handleImageRemoved = async () => {
    if (editingItem?.id) {
      try {
        const result = await window.electronAPI.items.removeImage(editingItem.id);
        if (result.success) {
          await loadItems(); // Refresh the items list
          // Update the editing item to reflect the change
          setEditingItem(prev => prev ? { ...prev, image_url: undefined } : null);
        } else {
          setImageUploadError(result.error || 'Failed to remove image');
        }
      } catch (error) {
        console.error('Error removing image:', error);
        setImageUploadError('An error occurred while removing the image');
      }
    }
    setPendingImage(null);
  };

  const handleImageUpload = async (itemId: number, processedImage: ProcessedImage) => {
    try {
      // Convert the file to a Uint8Array for the IPC call (Buffer is not available in renderer)
      const arrayBuffer = await processedImage.file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      const result = await window.electronAPI.items.uploadImage(itemId, uint8Array, processedImage.file.name);
      
      if (result.success) {
        await loadItems(); // Refresh the items list
        // Update the editing item to reflect the change
        if (editingItem) {
          setEditingItem(prev => prev ? { ...prev, image_url: result.data?.image_url } : null);
        }
        setPendingImage(null);
        return true;
      } else {
        setImageUploadError(result.error || 'Failed to upload image');
        return false;
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      setImageUploadError('An error occurred while uploading the image');
      return false;
    }
  };

  const getStatusIcon = (status: RegionStatus) => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'loading':
        return ''; // No icon for loading state
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'skipped':
        return '⚠';
      default:
        return '⏳';
    }
  };

  const getCompletedCount = () => {
    return regionStatuses.filter(s => s.status !== 'pending' && s.status !== 'loading').length;
  };

  const handleSort = (field: keyof Item) => {
    if (sortField === field) {
      // If clicking the same field, toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it as sort field with ascending direction
      setSortField(field);
      setSortDirection('asc');
    }
  };



  const handleBulkEdit = async (bdoItemId: number) => {
    try {
      // Get all items with this bdo_item_id
      const result = await window.electronAPI.items.getByBdoItemId(bdoItemId);
      if (result.success && result.data) {
        setBulkEditingBdoItemId(bdoItemId);
        setBulkEditItems(result.data);
        setShowBulkEditModal(true);
        setPendingImage(null);
        setImageUploadError(null);
      } else {
        alert(`Failed to load items: ${result.error}`);
      }
    } catch (error) {
      console.error('Error loading items for bulk edit:', error);
      alert('Failed to load items for bulk edit');
    }
  };

  const handleCloseBulkEditModal = () => {
    setShowBulkEditModal(false);
    setBulkEditingBdoItemId(null);
    setBulkEditItems([]);
    setPendingImage(null);
    setImageUploadError(null);
  };

  const handleBulkImageUpload = async () => {
    if (!bulkEditingBdoItemId || !pendingImage) {
      return;
    }

    try {
      setSyncing(true);
      console.log(`📸 Bulk uploading image for BDO Item ID ${bulkEditingBdoItemId}...`);
      
      // Convert the file to a Uint8Array for the IPC call
      const arrayBuffer = await pendingImage.file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Upload image once and apply to all items with this bdo_item_id
      const imageUploadResult = await window.electronAPI.items.uploadImageForBdoItem(
        bulkEditingBdoItemId, 
        uint8Array, 
        pendingImage.file.name
      );
      
      if (imageUploadResult.success) {
        console.log(`✅ Bulk image uploaded successfully and applied to ${imageUploadResult.data?.updatedItems || 0} items`);
        await loadItems();
        handleCloseBulkEditModal();
        alert(`✅ Image updated for ${imageUploadResult.data?.updatedItems || 0} items across all regions!`);
      } else {
        setImageUploadError(imageUploadResult.error || 'Failed to upload image');
      }
    } catch (imageError) {
      console.error('Failed to upload bulk image:', imageError);
      setImageUploadError('An error occurred while uploading the image');
    } finally {
      setSyncing(false);
    }
  };

  const handleBulkImageRemove = async () => {
    if (!bulkEditingBdoItemId) {
      return;
    }

    const itemName = bulkEditItems[0]?.name || 'items';
    const confirmed = await showConfirmationModal({
      title: 'Remove Images',
      message: `Are you sure you want to remove the image from all "${itemName}" items across all regions?`,
      confirmText: 'Remove Images',
      onConfirm: () => {}, // Will be handled by the promise resolution
      isDestructive: true
    });

    if (confirmed) {
      try {
        setSyncing(true);
        console.log(`🗑️ Bulk removing images for BDO Item ID ${bulkEditingBdoItemId}...`);
        
        // Remove images from all items with this bdo_item_id
        let successCount = 0;
        for (const item of bulkEditItems) {
          try {
            const result = await window.electronAPI.items.removeImage(item.id);
            if (result.success) {
              successCount++;
            }
          } catch (error) {
            console.warn(`Failed to remove image from item ${item.id}:`, error);
          }
        }
        
        await loadItems();
        handleCloseBulkEditModal();
        alert(`✅ Image removed from ${successCount}/${bulkEditItems.length} items!`);
      } catch (error) {
        console.error('Failed to remove bulk images:', error);
        alert('Failed to remove images');
      } finally {
        setSyncing(false);
      }
    }
  };

  const getSortIcon = (field: keyof Item) => {
    if (sortField !== field) {
      return '⇅'; // Double arrow when not sorted
    }
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(1)}M`;
    } else if (price >= 1000) {
      return `${(price / 1000).toFixed(1)}K`;
    }
    return price.toLocaleString();
  };

  return (
    <div className="item-management">
      {/* Header */}
      <div className="item-management-header">
        <h2>Items</h2>
        <div className="header-controls">
          <div className="region-filter">
            <select 
              value={selectedRegion} 
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="region-select"
            >
              <option value="ALL">All Regions</option>
              {REGIONS.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          <button 
            className={`btn ${showArchived ? 'btn-warning' : 'btn-secondary'}`}
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
          <button 
            className="btn btn-success" 
            onClick={handleOpenSyncModal}
            disabled={syncing}
          >
            {syncing ? 'Syncing...' : 'Sync Prices'}
          </button>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            Add Item
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-bar">
        <div className="search-container">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="search-input"
            placeholder="Search items by name or BDO ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Items Table */}
      {loading ? (
        <div className="loading">Loading items...</div>
      ) : filteredItems.length === 0 ? (
        <div className="no-items">
          {searchQuery ? 'No items match your search criteria' : 'No items found. Create your first item!'}
        </div>
      ) : (
        <div className="items-table-container">
          <table className="items-table">
            <thead>
              <tr>
                <th></th>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                  Name {getSortIcon('name')}
                </th>
                <th onClick={() => handleSort('bdo_item_id')} style={{ cursor: 'pointer' }}>
                  BDO ID {getSortIcon('bdo_item_id')}
                </th>
                <th>
                  {selectedRegion === 'ALL' ? 'Region(s)' : 'Region'}
                </th>
                <th onClick={() => handleSort('base_price')} style={{ cursor: 'pointer' }}>
                  Base Price {getSortIcon('base_price')}
                </th>
                <th onClick={() => handleSort('last_sold_price')} style={{ cursor: 'pointer' }}>
                  Last Sold {getSortIcon('last_sold_price')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {selectedRegion === 'ALL' ? (
                // Show grouped items when viewing all regions
                Object.entries(groupedItems).map(([bdoItemId, itemGroup]) => {
                  const representativeItem = itemGroup[0]; // Use first item as representative
                  const isExpanded = expandedGroups.has(parseInt(bdoItemId));
                  const hasMultipleRegions = itemGroup.length > 1;
                  
                  return (
                    <React.Fragment key={`group-${bdoItemId}`}>
                      {/* Main item row */}
                      <tr className={`item-group-header ${representativeItem.archived ? 'archived' : ''}`}>
                        <td>
                          <div className="item-image-cell">
                            {representativeItem.image_url ? (
                              <img
                                src={representativeItem.image_url}
                                alt={representativeItem.name}
                                className="item-image-thumbnail"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = 'none';
                                }}
                              />
                            ) : (
                              <div className="item-image-placeholder">
                                📦
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="item-name">
                          <div className="item-group-name">
                            {hasMultipleRegions && (
                              <button
                                className="expand-toggle"
                                onClick={() => toggleGroupExpansion(parseInt(bdoItemId))}
                                title={isExpanded ? 'Collapse regions' : 'Expand regions'}
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            )}
                            <span>{representativeItem.name}</span>
                          </div>
                        </td>
                        <td>{representativeItem.bdo_item_id}</td>
                        <td>
                          {hasMultipleRegions ? (
                            <div className="multiple-regions-container">
                              <span className="multiple-regions">Multiple Regions</span>
                              <span className="region-count">({itemGroup.length} regions)</span>
                            </div>
                          ) : (
                            <span className={`region-badge region-${representativeItem.region.toLowerCase()}`}>
                              {representativeItem.region}
                            </span>
                          )}
                        </td>
                        <td>{hasMultipleRegions ? '—' : formatPrice(representativeItem.base_price)}</td>
                        <td>{hasMultipleRegions ? '—' : formatPrice(representativeItem.last_sold_price)}</td>
                        <td>
                          <div className="actions">
                            {representativeItem.archived ? (
                              <button
                                className="btn btn-small btn-success"
                                onClick={() => handleRestore(representativeItem.id)}
                              >
                                Restore All
                              </button>
                            ) : (
                              <>
                                {hasMultipleRegions && (
                                  <button
                                    className="btn btn-small btn-primary"
                                    onClick={() => handleBulkEdit(parseInt(bdoItemId))}
                                    title="Bulk edit all regions for this item"
                                  >
                                    Bulk Edit
                                  </button>
                                )}
                                {!hasMultipleRegions && (
                                  <>
                                    <button
                                      className="btn btn-small btn-secondary"
                                      onClick={() => handleEdit(representativeItem)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="btn btn-small btn-warning"
                                      onClick={() => handleArchive(representativeItem)}
                                    >
                                      Archive
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* Expanded region rows */}
                      {hasMultipleRegions && isExpanded && itemGroup.map((item) => (
                        <tr key={`region-${item.id}`} className={`region-row ${item.archived ? 'archived' : ''}`}>
                          <td></td>
                          <td className="region-item-name">
                            <span className="region-indent">└─ {item.region}</span>
                          </td>
                          <td></td>
                          <td>
                            <span className={`region-badge region-${item.region.toLowerCase()}`}>
                              {item.region}
                            </span>
                          </td>
                          <td>{formatPrice(item.base_price)}</td>
                          <td>{formatPrice(item.last_sold_price)}</td>
                          <td>
                            <div className="actions">
                              {item.archived ? (
                                <button
                                  className="btn btn-small btn-success"
                                  onClick={() => handleRestore(item.id)}
                                >
                                  Restore
                                </button>
                              ) : (
                                <>
                                  <button
                                    className="btn btn-small btn-secondary"
                                    onClick={() => handleEdit(item)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-small btn-warning"
                                    onClick={() => handleArchive(item)}
                                  >
                                    Archive
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              ) : (
                // Show individual items when viewing specific region
                filteredItems.map((item) => (
                  <tr key={item.id} className={item.archived ? 'archived' : ''}>
                    <td>
                      <div className="item-image-cell">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="item-image-thumbnail"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                        ) : (
                          <div className="item-image-placeholder">
                            📦
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="item-name">{item.name}</td>
                    <td>{item.bdo_item_id}</td>
                    <td>
                      <span className={`region-badge region-${item.region.toLowerCase()}`}>
                        {item.region}
                      </span>
                    </td>
                    <td>{formatPrice(item.base_price)}</td>
                    <td>{formatPrice(item.last_sold_price)}</td>
                    <td>
                      <div className="actions">
                        {item.archived ? (
                          <button
                            className="btn btn-small btn-success"
                            onClick={() => handleRestore(item.id)}
                          >
                            Restore
                          </button>
                        ) : (
                          <>
                            <button
                              className="btn btn-small btn-secondary"
                              onClick={() => handleEdit(item)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-small btn-warning"
                              onClick={() => handleArchive(item)}
                            >
                              Archive
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="item-form-modal" onClick={handleCloseSyncModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Select Regions to Sync</h3>
              <button className="close-btn" onClick={handleCloseSyncModal}>
                ✕
              </button>
            </div>
            
            <div className="sync-modal-body">
              <p>Select which regions you want to sync item prices from:</p>
              <div className="region-checkboxes">
                {REGIONS.map(region => (
                  <label key={region} className="region-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedRegions.includes(region)}
                      onChange={() => handleRegionToggle(region)}
                    />
                    <span className="checkmark"></span>
                    {region}
                  </label>
                ))}
              </div>
              
              <div className="sync-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseSyncModal}>
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSyncPrices}
                  disabled={selectedRegions.length === 0 || syncing}
                >
                  {syncing ? 'Syncing...' : `Sync ${selectedRegions.length} Region${selectedRegions.length !== 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Creation Status Modal */}
      {showCreationStatusModal && (
        <div className="creation-status-modal">
          <div className="creation-status-content">
            <div className="creation-status-header">
              <h3>{statusModalType === 'create' ? 'Creating Items' : 'Syncing Prices'}</h3>
              <div className="creation-progress">
                <span>{getCompletedCount()}/{statusModalType === 'create' ? REGIONS.length : selectedRegions.length} regions completed</span>
                {!creationInProgress && (
                  <button className="close-btn" onClick={handleCloseCreationStatusModal}>
                    ✕
                  </button>
                )}
              </div>
            </div>
            
            <div className="region-status-list">
              {regionStatuses.map((regionStatus) => (
                <div key={regionStatus.region} className={`region-status-item ${regionStatus.status}`}>
                  <div className="region-info">
                    <div className="region-name">{regionStatus.region}</div>
                    <div className="region-message">
                      {regionStatus.itemName ? `${regionStatus.itemName} - ${regionStatus.message}` : regionStatus.message}
                    </div>
                  </div>
                  <div className={`region-status-icon ${regionStatus.status}`}>
                    {getStatusIcon(regionStatus.status)}
                  </div>
                </div>
              ))}
            </div>
            
            {!creationInProgress && (
              <div className="creation-actions">
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleCloseCreationStatusModal}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEditModal && (
        <div className="item-form-modal" onClick={handleCloseBulkEditModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Bulk Edit: {bulkEditItems[0]?.name || 'Items'}</h3>
              <button className="close-btn" onClick={handleCloseBulkEditModal}>
                ✕
              </button>
            </div>
            
            <div className="bulk-edit-content">
              <div className="bulk-edit-info">
                <p><strong>BDO Item ID:</strong> {bulkEditingBdoItemId}</p>
                <p><strong>Regions:</strong> {bulkEditItems.length} items across {bulkEditItems.map(item => item.region).join(', ')}</p>
                <p>Changes made here will apply to all regional variants of this item.</p>
              </div>

              <div className="form-group">
                <label>Item Image:</label>
                <ImageUpload
                  currentImageUrl={bulkEditItems[0]?.image_url}
                  onImageProcessed={handleImageProcessed}
                  onImageRemoved={() => setPendingImage(null)}
                  disabled={syncing}
                />
                {imageUploadError && (
                  <div className="upload-error" style={{ marginTop: '8px' }}>
                    {imageUploadError}
                  </div>
                )}
                <small style={{ color: 'var(--text-muted)', marginTop: '8px', display: 'block' }}>
                  Upload an image to update all {bulkEditItems.length} regional variants of this item.
                </small>
              </div>

              <div className="bulk-edit-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseBulkEditModal}>
                  Cancel
                </button>
                {pendingImage && (
                  <button 
                    type="button" 
                    className="btn btn-primary" 
                    onClick={handleBulkImageUpload}
                    disabled={syncing}
                  >
                    {syncing ? 'Uploading...' : `Update Image for All ${bulkEditItems.length} Items`}
                  </button>
                )}
                {bulkEditItems[0]?.image_url && !pendingImage && (
                  <button 
                    type="button" 
                    className="btn btn-warning" 
                    onClick={handleBulkImageRemove}
                    disabled={syncing}
                  >
                    {syncing ? 'Removing...' : `Remove Image from All ${bulkEditItems.length} Items`}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Simple Modal for Add/Edit Item */}
      <Modal
        isOpen={showSimpleModal}
        onClose={handleCloseModal}
        title={editingItem ? 'Edit Item' : 'Add New Item'}
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="bdo_item_id">BDO Item ID:</label>
            <input
              type="text"
              id="bdo_item_id"
              value={formData.bdo_item_id}
              onChange={(e) => {
                // Only allow numbers
                const value = e.target.value.replace(/[^0-9]/g, '');
                setFormData({ ...formData, bdo_item_id: value });
              }}
              placeholder="Enter BDO Item ID (e.g., 721003)"
              required
              autoFocus
            />
            <small style={{ color: '#666', marginTop: '8px', display: 'block' }}>
              The item name and prices will be automatically fetched from the BDO API for all regions
            </small>
          </div>

          {/* Only show image upload when adding new items */}
          {!editingItem && (
            <div className="form-group">
              <label>Item Image:</label>
              <ImageUpload
                onImageProcessed={(processedImage) => {
                  setPendingImage(processedImage);
                  setImageUploadError(null);
                }}
                onImageRemoved={() => {
                  setPendingImage(null);
                  setImageUploadError(null);
                }}
                maxWidth={200}
                maxHeight={200}
              />
              {imageUploadError && (
                <small style={{ color: '#f38ba8', marginTop: '8px', display: 'block' }}>
                  {imageUploadError}
                </small>
              )}
              <small style={{ color: '#666', marginTop: '8px', display: 'block' }}>
                This image will be applied to all items created from this BDO Item ID
              </small>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="btn-secondary" onClick={handleCloseModal}>
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              {editingItem ? 'Update Item' : 'Create Item'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ItemManagement;
