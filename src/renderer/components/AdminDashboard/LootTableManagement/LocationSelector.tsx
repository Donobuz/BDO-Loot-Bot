import React, { useState, useMemo } from 'react';
import { Location } from '../../../types';
import './LocationSelector.css';

interface LocationSelectorProps {
  locations: Location[];
  selectedLocationId: number | null;
  onLocationSelect: (locationId: number) => void;
  lootTables?: any[]; // For showing which locations have loot tables
  onLocationUpdate?: () => void; // Callback for when locations are updated
}

const LocationSelector: React.FC<LocationSelectorProps> = ({
  locations,
  selectedLocationId,
  onLocationSelect,
  lootTables = [],
  onLocationUpdate
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Location>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterMonsterType, setFilterMonsterType] = useState<string>('');
  const [filterHasLootTable, setFilterHasLootTable] = useState<'all' | 'with' | 'without'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25); // Increased for better performance with 30+ locations
  const [viewMode, setViewMode] = useState<'cards' | 'compact'>('compact'); // Default to compact

  // Get unique monster types for filter
  const monsterTypes = useMemo(() => {
    const types = [...new Set(locations.map(loc => loc.monster_type).filter(Boolean))];
    return types.sort();
  }, [locations]);

  // Filter and sort locations
  const filteredAndSortedLocations = useMemo(() => {
    let filtered = locations.filter(location => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        if (!location.name.toLowerCase().includes(query) &&
            !location.monster_type.toLowerCase().includes(query)) {
          return false;
        }
      }

      // Monster type filter
      if (filterMonsterType && location.monster_type !== filterMonsterType) {
        return false;
      }

      // Loot table filter
      if (filterHasLootTable !== 'all') {
        const hasLootTable = lootTables.some(lt => lt.location_id === location.id);
        if (filterHasLootTable === 'with' && !hasLootTable) return false;
        if (filterHasLootTable === 'without' && hasLootTable) return false;
      }

      return true;
    });

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
  }, [locations, searchQuery, sortField, sortDirection, filterMonsterType, filterHasLootTable, lootTables]);

  // Helper function to get location status
  const getLocationStatus = (location: Location) => {
    const lootTable = lootTables.find(lt => lt.location_id === location.id);
    if (!lootTable) {
      return { status: 'error', text: 'Missing Loot Table', className: 'status-error' };
    }
    if (!lootTable.item_ids || lootTable.item_ids.length === 0) {
      return { status: 'empty', text: 'No Items', className: 'status-empty' };
    }
    return { status: 'ready', text: `${lootTable.item_ids.length} Items`, className: 'status-ready' };
  };

  // Pagination with Load More
  const totalPages = Math.ceil(filteredAndSortedLocations.length / itemsPerPage);
  const startIndex = 0; // Always start from beginning
  const endIndex = currentPage * itemsPerPage;
  const paginatedLocations = filteredAndSortedLocations.slice(startIndex, endIndex);
  const hasMoreItems = endIndex < filteredAndSortedLocations.length;

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterMonsterType, filterHasLootTable]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterMonsterType('');
    setFilterHasLootTable('all');
    setSortField('name');
    setSortDirection('asc');
    setCurrentPage(1);
  };

  return (
    <div className="loot-location-selector">
      <div className="loot-location-selector-header">
        <div className="header-left">
          <h3>Select Location</h3>
          <div className="loot-location-stats">
            {filteredAndSortedLocations.length} of {locations.length} locations
          </div>
        </div>
        <div className="view-toggle">
          <button 
            className={`view-btn ${viewMode === 'compact' ? 'active' : ''}`}
            onClick={() => setViewMode('compact')}
            title="Compact View"
          >
            ☰
          </button>
          <button 
            className={`view-btn ${viewMode === 'cards' ? 'active' : ''}`}
            onClick={() => setViewMode('cards')}
            title="Card View"
          >
            ⊞
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="loot-location-filters">
        <div className="loot-search-bar">
          <input
            type="text"
            placeholder="Search locations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="loot-search-input"
          />
        </div>

        <div className="filter-controls">
          <select
            value={filterMonsterType}
            onChange={(e) => setFilterMonsterType(e.target.value)}
            className="filter-select"
          >
            <option value="">All Monster Types</option>
            {monsterTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <select
            value={filterHasLootTable}
            onChange={(e) => setFilterHasLootTable(e.target.value as 'all' | 'with' | 'without')}
            className="filter-select"
          >
            <option value="all">All Locations</option>
            <option value="with">With Loot Table</option>
            <option value="without">Without Loot Table</option>
          </select>

          <select
            value={`${sortField}-${sortDirection}`}
            onChange={(e) => {
              const [field, direction] = e.target.value.split('-') as [keyof Location, 'asc' | 'desc'];
              setSortField(field);
              setSortDirection(direction);
            }}
            className="filter-select"
          >
            <option value="name-asc">Sort by Name (A-Z)</option>
            <option value="name-desc">Sort by Name (Z-A)</option>
            <option value="ap-asc">Sort by AP (Low-High)</option>
            <option value="ap-desc">Sort by AP (High-Low)</option>
            <option value="dp-asc">Sort by DP (Low-High)</option>
            <option value="dp-desc">Sort by DP (High-Low)</option>
          </select>

          <button onClick={clearFilters} className="clear-filters-btn">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Location List */}
      <div className={`loot-location-list ${viewMode}`}>
        {paginatedLocations.length === 0 ? (
          <div className="no-locations">
            {searchQuery || filterMonsterType || filterHasLootTable !== 'all' ? 
              'No locations match your filters.' : 
              'No locations found.'
            }
          </div>
        ) : viewMode === 'compact' ? (
          <table className="locations-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Monster Type</th>
                <th>AP</th>
                <th>DP</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLocations.map(location => {
                const locationStatus = getLocationStatus(location);
                
                return (
                  <tr 
                    key={location.id}
                    className={`loot-location-row ${selectedLocationId === location.id ? 'selected' : ''}`}
                    onClick={() => onLocationSelect(location.id)}
                  >
                    <td className="loot-location-name">{location.name}</td>
                    <td>{location.monster_type}</td>
                    <td>{location.ap}</td>
                    <td>{location.dp}</td>
                    <td>
                      <span className={`status-indicator ${locationStatus.className}`} title={locationStatus.text}>
                        {locationStatus.status === 'ready' ? '●' : locationStatus.status === 'empty' ? '●' : '⚠'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          paginatedLocations.map(location => {
            const locationStatus = getLocationStatus(location);
            
            return (
              <div 
                key={location.id}
                className={`loot-location-item ${selectedLocationId === location.id ? 'selected' : ''} ${viewMode}`}
                onClick={() => onLocationSelect(location.id)}
              >
                <div className="loot-location-card-header">
                  <div className="loot-location-name">
                    {location.name}
                  </div>
                </div>
                
                <div className="loot-location-details">
                  <div className="loot-location-stat">
                    <span className="loot-location-stat-label">AP:</span>
                    <span className="loot-location-stat-value">{location.ap}</span>
                  </div>
                  <div className="loot-location-stat">
                    <span className="loot-location-stat-label">DP:</span>
                    <span className="loot-location-stat-value">{location.dp}</span>
                  </div>
                  <div className="loot-location-monster">{location.monster_type}</div>
                </div>
                
                <div className="loot-location-status">
                  <span className={`loot-table-status ${locationStatus.className}`}>
                    {locationStatus.text}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Load More / Show All */}
      {hasMoreItems && (
        <div className="load-more-section">
          <button 
            onClick={() => setCurrentPage(currentPage + 1)}
            className="load-more-btn"
          >
            Load More ({filteredAndSortedLocations.length - paginatedLocations.length} remaining)
          </button>
          {filteredAndSortedLocations.length > 50 && (
            <button 
              onClick={() => setCurrentPage(Math.ceil(filteredAndSortedLocations.length / itemsPerPage))}
              className="show-all-btn"
            >
              Show All ({filteredAndSortedLocations.length})
            </button>
          )}
        </div>
      )}

      {/* Current showing info */}
      {paginatedLocations.length > 0 && (
        <div className="showing-info">
          Showing {paginatedLocations.length} of {filteredAndSortedLocations.length} locations
        </div>
      )}
    </div>
  );
};

export default LocationSelector;
