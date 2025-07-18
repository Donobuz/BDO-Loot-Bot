import React, { useState, useEffect, useMemo } from 'react';
import './LocationManagement.css';
import { Location } from '../../../types';

const MONSTER_TYPES = ['Kamasylvian', 'Demi-Human', 'Human'];

const LocationManagement: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<keyof Location>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [formData, setFormData] = useState({
    name: '',
    ap: '',
    total_ap: '',
    dp: '',
    monster_type: ''
  });

  useEffect(() => {
    loadLocations();
  }, []);

  const loadLocations = async () => {
    try {
      setLoading(true);
      const result = await window.electronAPI.locations.getAll();
      if (result.success) {
        setLocations(result.data || []);
      } else {
        console.error('Failed to load locations:', result.error);
      }
    } catch (error) {
      console.error('Error loading locations:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort locations based on search query, archive status, and sorting
  const filteredLocations = useMemo(() => {
    let filtered = locations.filter(location => 
      showArchived ? location.archived : !location.archived
    );

    // Search only by name
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(location => 
        location.name.toLowerCase().includes(query)
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
  }, [locations, showArchived, searchQuery, sortField, sortDirection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Please enter a location name');
      return;
    }

    try {
      const locationData = {
        name: formData.name.trim(),
        ap: parseInt(formData.ap) || 0,
        total_ap: parseInt(formData.total_ap) || 0,
        dp: parseInt(formData.dp) || 0,
        monster_type: formData.monster_type.trim() || 'Unknown'
      };

      let result;
      if (editingLocation) {
        result = await window.electronAPI.locations.update(editingLocation.id, locationData);
      } else {
        result = await window.electronAPI.locations.create(locationData);
      }

      if (result.success) {
        await loadLocations();
        handleCloseModal();
      } else {
        alert(`Failed to ${editingLocation ? 'update' : 'create'} location: ${result.error}`);
      }
    } catch (error) {
      console.error('Error saving location:', error);
      alert('An error occurred while saving the location');
    }
  };

  const handleEdit = (location: Location) => {
    setEditingLocation(location);
    setFormData({
      name: location.name,
      ap: location.ap.toString(),
      total_ap: location.total_ap.toString(),
      dp: location.dp.toString(),
      monster_type: location.monster_type
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingLocation(null);
    setFormData({
      name: '',
      ap: '',
      total_ap: '',
      dp: '',
      monster_type: ''
    });
  };

  const handleOpenModal = () => {
    setShowModal(true);
  };

  const handleArchive = async (location: Location) => {
    if (window.confirm(`Are you sure you want to archive "${location.name}"?`)) {
      try {
        const result = await window.electronAPI.locations.archive(location.id);
        if (result.success) {
          await loadLocations();
        } else {
          alert(`Failed to archive location: ${result.error}`);
        }
      } catch (error) {
        console.error('Error archiving location:', error);
        alert('An error occurred while archiving the location');
      }
    }
  };

  const handleRestore = async (id: number) => {
    try {
      const result = await window.electronAPI.locations.unarchive(id);
      if (result.success) {
        await loadLocations();
      } else {
        alert('Failed to restore location: ' + result.error);
      }
    } catch (error) {
      console.error('Error restoring location:', error);
      alert('An error occurred while restoring the location');
    }
  };

  const handleSort = (field: keyof Location) => {
    if (sortField === field) {
      // If clicking the same field, toggle direction
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it as sort field with ascending direction
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: keyof Location) => {
    if (sortField !== field) {
      return '⇅'; // Smaller double arrow when not sorted
    }
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="location-management">
      {/* Header */}
      <div className="location-management-header">
        <h2>Locations</h2>
        <div className="header-controls">
          <button 
            className={`btn ${showArchived ? 'btn-warning' : 'btn-secondary'}`}
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? 'Hide Archived' : 'Show Archived'}
          </button>
          <button className="btn btn-primary" onClick={handleOpenModal}>
            Add Location
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
            placeholder="Search locations by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Locations Table */}
      {loading ? (
        <div className="loading">Loading locations...</div>
      ) : filteredLocations.length === 0 ? (
        <div className="no-locations">
          {searchQuery ? 'No locations match your search criteria' : 'No locations found. Create your first location!'}
        </div>
      ) : (
        <div className="locations-table-container">
          <table className="locations-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('name')} style={{ cursor: 'pointer' }}>
                  Name {getSortIcon('name')}
                </th>
                <th onClick={() => handleSort('monster_type')} style={{ cursor: 'pointer' }}>
                  Monster Type {getSortIcon('monster_type')}
                </th>
                <th onClick={() => handleSort('ap')} style={{ cursor: 'pointer' }}>
                  AP {getSortIcon('ap')}
                </th>
                <th onClick={() => handleSort('total_ap')} style={{ cursor: 'pointer' }}>
                  Total AP {getSortIcon('total_ap')}
                </th>
                <th onClick={() => handleSort('dp')} style={{ cursor: 'pointer' }}>
                  DP {getSortIcon('dp')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLocations.map((location) => (
                <tr key={location.id} className={location.archived ? 'archived' : ''}>
                  <td className="location-name">{location.name}</td>
                  <td>{location.monster_type}</td>
                  <td>{location.ap}</td>
                  <td>{location.total_ap}</td>
                  <td>{location.dp}</td>
                  <td>
                    <div className="actions">
                      {location.archived ? (
                        <button
                          className="btn btn-small btn-success"
                          onClick={() => handleRestore(location.id)}
                        >
                          Restore
                        </button>
                      ) : (
                        <>
                          <button
                            className="btn btn-small btn-secondary"
                            onClick={() => handleEdit(location)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn btn-small btn-warning"
                            onClick={() => handleArchive(location)}
                          >
                            Archive
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="location-form-modal" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingLocation ? 'Edit Location' : 'Add New Location'}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                ✕
              </button>
            </div>
            
            <form className="location-form" onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="name">Location Name:</label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter location name"
                  required
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="ap">AP:</label>
                  <input
                    type="number"
                    id="ap"
                    value={formData.ap}
                    onChange={(e) => setFormData({ ...formData, ap: e.target.value })}
                    placeholder="Attack Power"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="total_ap">Total AP:</label>
                  <input
                    type="number"
                    id="total_ap"
                    value={formData.total_ap}
                    onChange={(e) => setFormData({ ...formData, total_ap: e.target.value })}
                    placeholder="Total Attack Power"
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="dp">DP:</label>
                  <input
                    type="number"
                    id="dp"
                    value={formData.dp}
                    onChange={(e) => setFormData({ ...formData, dp: e.target.value })}
                    placeholder="Defense Power"
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="monster_type">Monster Type:</label>
                <select
                  id="monster_type"
                  value={formData.monster_type}
                  onChange={(e) => setFormData({ ...formData, monster_type: e.target.value })}
                  required
                >
                  <option value="">Select monster type</option>
                  {MONSTER_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-actions">
                <button type="button" className="btn btn-secondary" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingLocation ? 'Update Location' : 'Create Location'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LocationManagement;
