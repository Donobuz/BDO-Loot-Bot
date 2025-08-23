import React, { useState, useEffect } from 'react';
import { UserPreferences, TaxCalculations, UserPreferencesUpdate } from '../../types';
import { BDO_REGIONS } from '../../constants/regions';
import { TAX_CONSTANTS } from '../../constants/taxes';
import { formatTaxRate } from '../../utils/taxCalculations';
import Modal from '../Modal/Modal';
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
  onSave: (preferences: UserPreferencesUpdate) => Promise<void>;
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
  const [taxCalculations, setTaxCalculations] = useState<TaxCalculations>({
    value_pack: currentPreferences.tax_calculations?.value_pack || false,
    rich_merchant_ring: currentPreferences.tax_calculations?.rich_merchant_ring || false,
    family_fame: currentPreferences.tax_calculations?.family_fame || 0
  });
  const [saving, setSaving] = useState(false);
  const [selectingRegion, setSelectingRegion] = useState(false);

  // Update local state when preferences change
  useEffect(() => {
    setPreferredRegion(currentPreferences.preferred_region);
    setDisplayRegions(currentPreferences.display_regions);
    setOcrRegion(currentPreferences.designated_ocr_region || null);
    setTaxCalculations({
      value_pack: currentPreferences.tax_calculations?.value_pack || false,
      rich_merchant_ring: currentPreferences.tax_calculations?.rich_merchant_ring || false,
      family_fame: currentPreferences.tax_calculations?.family_fame || 0
    });
  }, [currentPreferences]);

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

  const handleTaxCalculationChange = (field: keyof TaxCalculations, value: boolean | number) => {
    setTaxCalculations(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFamilyFameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Only allow numbers
    if (value === '' || /^\d+$/.test(value)) {
      let numValue = value === '' ? 0 : parseInt(value, 10);
      // Cap at maximum family fame value
      if (numValue > TAX_CONSTANTS.MAX_FAMILY_FAME) {
        numValue = TAX_CONSTANTS.MAX_FAMILY_FAME;
      }
      handleTaxCalculationChange('family_fame', numValue);
    }
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
        designated_ocr_region: ocrRegion,
        tax_calculations: taxCalculations
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
    setTaxCalculations({
      value_pack: currentPreferences.tax_calculations?.value_pack || false,
      rich_merchant_ring: currentPreferences.tax_calculations?.rich_merchant_ring || false,
      family_fame: currentPreferences.tax_calculations?.family_fame || 0
    });
    onClose();
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleCancel} 
      title="User Settings"
      width="720px"
    >
      <div className="user-modal-container">
        {/* Scrollable content */}
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

        <div className="settings-section">
          <h3>Tax Calculations</h3>
          <p className="setting-description">
            Configure your marketplace tax modifiers for accurate post-tax value calculations.
          </p>
          
          <div className="user-settings-tax-grid">
            <div className="tax-checkboxes">
              <div className="tax-card">
                <label className="checkbox-item modern-checkbox">
                  <input
                    type="checkbox"
                    checked={taxCalculations.value_pack}
                    onChange={(e) => handleTaxCalculationChange('value_pack', e.target.checked)}
                    disabled={isLoading || saving}
                  />
                  <span className="checkbox-text">
                    <span className="checkbox-label">Value Pack</span>
                    <span className="checkbox-sublabel">{formatTaxRate(TAX_CONSTANTS.VALUE_PACK_BONUS)} bonus on post-tax amount</span>
                  </span>
                </label>
              </div>

              <div className="tax-card">
                <label className="checkbox-item modern-checkbox">
                  <input
                    type="checkbox"
                    checked={taxCalculations.rich_merchant_ring}
                    onChange={(e) => handleTaxCalculationChange('rich_merchant_ring', e.target.checked)}
                    disabled={isLoading || saving}
                  />
                  <span className="checkbox-text">
                    <span className="checkbox-label">Rich Merchant Ring</span>
                    <span className="checkbox-sublabel">{formatTaxRate(TAX_CONSTANTS.RICH_MERCHANT_RING_BONUS)} bonus on post-tax amount</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="tax-card family-fame-card">
              <label className="input-label">
                <div className="input-info">
                  <span className="input-title">Family Fame</span>
                  <span className="input-description">Trading fame value (7000+ for max {formatTaxRate(TAX_CONSTANTS.MAX_FAMILY_FAME_BONUS)} bonus)</span>
                </div>
                <input
                  type="text"
                  value={taxCalculations.family_fame}
                  onChange={handleFamilyFameChange}
                  disabled={isLoading || saving}
                  placeholder={`Enter fame (max ${TAX_CONSTANTS.MAX_FAMILY_FAME})`}
                  className="fame-input"
                />
              </label>
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

        {/* Sticky action buttons at bottom */}
        <div className="user-modal-header-actions">
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
    </Modal>
  );
};