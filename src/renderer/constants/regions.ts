// Available BDO regions
export const BDO_REGIONS = [
  { value: 'NA', label: 'North America' },
  { value: 'EU', label: 'Europe' },
  { value: 'SEA', label: 'Southeast Asia' },
  { value: 'MENA', label: 'Middle East & Africa' },
  { value: 'KR', label: 'Korea' },
  { value: 'RU', label: 'Russia' },
  { value: 'JP', label: 'Japan' },
  { value: 'TH', label: 'Thailand' },
  { value: 'TW', label: 'Taiwan' },
  { value: 'SA', label: 'South America' },
] as const;

export type BDORegion = typeof BDO_REGIONS[number]['value'];

// Default region
export const DEFAULT_REGION: BDORegion = 'NA';

// Helper function to get region display name
export const getRegionLabel = (region: string): string => {
  const regionData = BDO_REGIONS.find(r => r.value === region);
  return regionData ? regionData.label : region.toUpperCase();
};
