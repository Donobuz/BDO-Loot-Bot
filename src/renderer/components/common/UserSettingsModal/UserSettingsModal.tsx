import React, { useState, useEffect } from 'react';
import { UserPreferences } from '../../../types';
import { BDO_REGIONS } from '../../../constants/regions';
import './UserSettingsModal.css';

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPreferences: UserPreferences;
  onSave: (preferences: Partial<UserPreferences>) => Promise<void>;
  isLoading?: boolean;
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  currentPreferences,
  onSave,
  isLoading = false
}) => {
  const [preferredRegion, setPreferredRegion] = useState<string>(currentPreferences.preferred_region);
  const [displayRegions, setDisplayRegions] = useState<string[]>(currentPreferences.display_regions);
  const [saving, setSaving] = useState(false);

  // Update local state when preferences change
  useEffect(() => {
    setPreferredRegion(currentPreferences.preferred_region);
    setDisplayRegions(currentPreferences.display_regions);
  }, [currentPreferences]);

  const handleDisplayRegionToggle = (regionValue: string) => {
    if (regionValue === 'ALL') {
      // Toggle ALL - if ALL is selected, deselect everything else, otherwise select ALL
      if (displayRegions.includes('ALL')) {
        setDisplayRegions([]);
      } else {
        setDisplayRegions(['ALL']);
      }
    } else {
      // Toggle individual region
      setDisplayRegions(prev => {
        const newRegions = prev.filter(r => r !== 'ALL'); // Remove ALL when selecting individual regions
        
        if (prev.includes(regionValue)) {
          // Deselecting a region
          return newRegions.filter(r => r !== regionValue);
        } else {
          // Selecting a region
          const updatedRegions = [...newRegions, regionValue];
          
          // Check if all individual regions are now selected
          const allIndividualRegions = BDO_REGIONS.map(r => r.value);
          const hasAllIndividualRegions = allIndividualRegions.every(region => 
            updatedRegions.includes(region)
          );
          
          if (hasAllIndividualRegions) {
            // If all individual regions are selected, switch to "ALL"
            return ['ALL'];
          }
          
          return updatedRegions;
        }
      });
    }
  };

  const handleSave = async () => {
    if (saving) return;
    
    try {
      setSaving(true);
      
      // Ensure at least one display region is selected
      const finalDisplayRegions = displayRegions.length === 0 ? [preferredRegion] : displayRegions;
      
      await onSave({
        preferred_region: preferredRegion,
        display_regions: finalDisplayRegions
      });
      
      onClose();
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    // Reset to current preferences
    setPreferredRegion(currentPreferences.preferred_region);
    setDisplayRegions(currentPreferences.display_regions);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>User Settings</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="settings-section">
            <h3>Default Region</h3>
            <p className="setting-description">
              Your preferred region for loot tables and default data display
            </p>
            
            <div className="dropdown-container">
              <select
                value={preferredRegion}
                onChange={(e) => setPreferredRegion(e.target.value)}
                disabled={isLoading || saving}
                className="region-dropdown"
              >
                {BDO_REGIONS.map(region => (
                  <option key={region.value} value={region.value}>
                    {region.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="settings-section">
            <h3>Display Regions</h3>
            <p className="setting-description">
              Select which regions to show in statistics and data aggregation
            </p>
            
            <div className="checkbox-grid">
              {/* ALL option - special styling */}
              <label 
                className="checkbox-item all-regions modern-checkbox"
                style={{ cursor: isLoading || saving ? 'not-allowed' : 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={displayRegions.includes('ALL')}
                  onChange={() => handleDisplayRegionToggle('ALL')}
                  disabled={isLoading || saving}
                />
                <span className="checkbox-text">
                  <span className="checkbox-label">All Regions</span>
                  <span className="checkbox-sublabel">Aggregate data from all regions</span>
                </span>
              </label>

              {/* Separator */}
              <div className="separator">
                <hr />
                <span>Individual Regions</span>
              </div>

              {/* Individual regions - grid layout */}
              <div className="individual-regions">
                {BDO_REGIONS.map(region => (
                  <label 
                    key={region.value} 
                    className="checkbox-item modern-checkbox"
                    style={{ cursor: isLoading || saving ? 'not-allowed' : 'pointer' }}
                  >
                    <input
                      type="checkbox"
                      checked={displayRegions.includes(region.value)}
                      onChange={() => handleDisplayRegionToggle(region.value)}
                      disabled={isLoading || saving}
                    />
                    <span className="checkbox-text">
                      <span className="checkbox-label">{region.label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button 
            className="cancel-button" 
            onClick={handleCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button 
            className="save-button" 
            onClick={handleSave}
            disabled={saving || isLoading}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};
