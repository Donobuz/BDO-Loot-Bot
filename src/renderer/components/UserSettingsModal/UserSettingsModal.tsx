import React, { useState, useEffect } from 'react';
import { UserPreferences } from '../../types';
import { BDO_REGIONS } from '../../constants/regions';
import './UserSettingsModal.css';

interface OCRRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  display?: string;
}

interface UserSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPreferences: UserPreferences;
  onSave: (preferences: Partial<UserPreferences>) => Promise<void>;
  isLoading?: boolean;
  focusSection?: 'ocr' | null; // Add prop to focus on specific section
}

export const UserSettingsModal: React.FC<UserSettingsModalProps> = ({
  isOpen,
  onClose,
  currentPreferences,
  onSave,
  isLoading = false,
  focusSection = null
}) => {
  const [preferredRegion, setPreferredRegion] = useState<string>(currentPreferences.preferred_region);
  const [displayRegions, setDisplayRegions] = useState<string[]>(currentPreferences.display_regions);
  const [ocrRegion, setOcrRegion] = useState<OCRRegion | null>(
    currentPreferences.designated_ocr_region || null
  );
  const [saving, setSaving] = useState(false);
  const [selectingRegion, setSelectingRegion] = useState(false);

  // Update local state when preferences change
  useEffect(() => {
    setPreferredRegion(currentPreferences.preferred_region);
    setDisplayRegions(currentPreferences.display_regions);
    setOcrRegion(currentPreferences.designated_ocr_region || null);
  }, [currentPreferences]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Store original overflow style
      const originalStyle = window.getComputedStyle(document.body).overflow;
      
      // Prevent scrolling
      document.body.style.overflow = 'hidden';
      
      // Cleanup function to restore scrolling
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Focus on specific section when modal opens
  useEffect(() => {
    if (isOpen && focusSection === 'ocr') {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        const ocrSection = document.querySelector('.ocr-region-section');
        if (ocrSection) {
          ocrSection.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center' 
          });
          // Add a subtle highlight effect
          ocrSection.classList.add('section-highlight');
          setTimeout(() => {
            ocrSection.classList.remove('section-highlight');
          }, 2000);
        }
      }, 300);
    }
  }, [isOpen, focusSection]);

  const handleDisplayRegionToggle = (regionValue: string) => {
    if (regionValue === 'ALL') {
      if (!displayRegions.includes('ALL')) {
        setDisplayRegions(['ALL']);
      }
    } else {
      // Toggle individual region
      setDisplayRegions(prev => {
        if (prev.includes('ALL')) {
          return [regionValue];
        }
        
        const newRegions = prev.filter(r => r !== 'ALL'); // Remove ALL when selecting individual regions
        
        if (prev.includes(regionValue)) {
          const updatedRegions = newRegions.filter(r => r !== regionValue);
          if (updatedRegions.length === 0) {
            return prev;
          }
          return updatedRegions;
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

  const handleSelectRegion = async () => {
    if (selectingRegion) return;
    
    try {
      setSelectingRegion(true);
      
      // Call Electron API to open region selector
      const result = await window.electronAPI.selectOCRRegion();
      
      if (result.success && result.region) {
        setOcrRegion(result.region);
      }
    } catch (error) {
      console.error('Error selecting OCR region:', error);
    } finally {
      setSelectingRegion(false);
    }
  };

  const handleClearRegion = () => {
    setOcrRegion(null);
  };

  const formatRegionDisplay = (region: OCRRegion | null): string => {
    if (!region) {
      return 'No region selected - click "Select Region" to choose an area of your screen for loot detection';
    }
    
    return `Region: ${region.width}×${region.height} at (${region.x}, ${region.y})${
      region.display ? ` on ${region.display}` : ''
    }`;
  };

  const handleSave = async () => {
    if (saving) return;
    
    try {
      setSaving(true);
      
      // Ensure at least one display region is selected
      const finalDisplayRegions = displayRegions.length === 0 ? [preferredRegion] : displayRegions;
      
      await onSave({
        preferred_region: preferredRegion,
        display_regions: finalDisplayRegions,
        designated_ocr_region: ocrRegion
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
    setOcrRegion(currentPreferences.designated_ocr_region || null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content user-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="user-modal-header">
          <h2>User Settings</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="user-modal-body">
          <div className="settings-section">
            <h3>Default Region</h3>
            <p className="setting-description">
              Region for grind sessions and accurate market pricing for loot.
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

          {/* Modern HR separator */}
          <div className="settings-separator">
            <hr />
          </div>

          <div className="settings-section ocr-region-section">
            <h3>Loot Detection Region</h3>
            <p className="setting-description">
              Select the area of your screen where loot messages appear for automatic detection during grind sessions.
            </p>
            
            <div className="ocr-region-controls">
              <div className={`ocr-region-display ${ocrRegion ? 'has-region' : ''}`}>
                {formatRegionDisplay(ocrRegion)}
              </div>
              
              <div className="ocr-region-buttons">
                <button
                  className="select-region-button"
                  onClick={handleSelectRegion}
                  disabled={selectingRegion || saving || isLoading}
                >
                  {selectingRegion ? 'Selecting...' : 'Select Region'}
                </button>
                
                <button
                  className="clear-region-button"
                  onClick={handleClearRegion}
                  disabled={!ocrRegion || saving || isLoading}
                >
                  Clear Region
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="user-modal-footer">
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