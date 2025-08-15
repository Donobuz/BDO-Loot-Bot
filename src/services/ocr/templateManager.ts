import fs from 'fs';
import path from 'path';
import { UserPreferences } from '../db/types';

export interface ItemTemplate {
    name: string;
    variations?: string[];
    fuzzyMatch?: boolean;
    fuzzyPattern?: string;
    minSimilarity?: number;
    value?: number;
}

export interface CropArea {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface TextFilters {
    minConfidence?: number;
    allowedCharacters?: string;
    minLength?: number;
}

export interface Pattern {
    type: string;
    regex: string;
    groups: string[];
}

export interface LocationTemplateData {
    name: string;
    cropArea?: CropArea;
    textFilters?: TextFilters;
    items: ItemTemplate[];
    patterns?: Pattern[];
}

export interface ItemMatcher {
    exact: Set<string>;
    fuzzy: Array<{
        name: string;
        pattern: RegExp;
        minSimilarity: number;
    }>;
}

export interface MatchResult {
    match: boolean;
    item?: string;
    confidence?: number;
    method?: 'exact' | 'fuzzy';
    text?: string;
}

export class LocationTemplate {
    public name: string;
    public items: ItemMatcher;
    public patterns: Pattern[];
    public cropArea?: CropArea;
    public textFilters?: TextFilters;

    constructor(data: LocationTemplateData) {
        this.name = data.name;
        this.items = this.buildItemMatcher(data.items);
        this.patterns = data.patterns || [];
        this.cropArea = data.cropArea;
        this.textFilters = data.textFilters;
    }

    private buildItemMatcher(items: ItemTemplate[]): ItemMatcher {
        const matcher: ItemMatcher = {
            exact: new Set(),
            fuzzy: []
        };

        items.forEach(item => {
            // Exact matches for common items
            matcher.exact.add(item.name.toLowerCase());

            // Add common variations/typos
            if (item.variations) {
                item.variations.forEach(variation => {
                    matcher.exact.add(variation.toLowerCase());
                });
            }

            // Fuzzy matching for complex names
            if (item.fuzzyMatch && item.fuzzyPattern) {
                matcher.fuzzy.push({
                    name: item.name,
                    pattern: new RegExp(item.fuzzyPattern, 'i'),
                    minSimilarity: item.minSimilarity || 0.8
                });
            }
        });

        return matcher;
    }

    public matchItem(text: string): MatchResult {
        const cleanText = text.toLowerCase().trim();

        // Exact match first (fastest)
        if (this.items.exact.has(cleanText)) {
            return { 
                match: true, 
                item: this.findOriginalName(cleanText), 
                confidence: 1.0, 
                method: 'exact' 
            };
        }

        // Pattern matching
        for (const fuzzyItem of this.items.fuzzy) {
            if (fuzzyItem.pattern.test(text)) {
                const similarity = this.calculateSimilarity(text, fuzzyItem.name);
                if (similarity >= fuzzyItem.minSimilarity) {
                    return {
                        match: true,
                        item: fuzzyItem.name,
                        confidence: similarity,
                        method: 'fuzzy'
                    };
                }
            }
        }

        return { match: false, text: cleanText };
    }

    private findOriginalName(cleanText: string): string {
        // This would need to be enhanced to map back from variations to original names
        // For now, return the clean text with proper casing
        return cleanText;
    }

    private calculateSimilarity(str1: string, str2: string): number {
        // Levenshtein distance implementation
        const matrix = Array(str2.length + 1).fill(null).map(() => 
            Array(str1.length + 1).fill(null));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + cost
                );
            }
        }

        const maxLen = Math.max(str1.length, str2.length);
        return (maxLen - matrix[str2.length][str1.length]) / maxLen;
    }
}

export class TemplateManager {
    private templates: Map<string, LocationTemplate>;
    private currentLocation: LocationTemplate | null;
    private userPreferences: UserPreferences | null;

    constructor() {
        this.templates = new Map();
        this.currentLocation = null;
        this.userPreferences = null;
        this.loadTemplates();
    }

    public setUserPreferences(preferences: UserPreferences): void {
        this.userPreferences = preferences;
    }

    public getUserOCRRegion(): CropArea | null {
        return this.userPreferences?.designated_ocr_region || null;
    }

    private loadTemplates(): void {
        try {
            const templatesDir = path.join(__dirname, '../../../resources/templates');
            
            // Create templates directory if it doesn't exist
            if (!fs.existsSync(templatesDir)) {
                fs.mkdirSync(templatesDir, { recursive: true });
                return;
            }

            const templateFiles = fs.readdirSync(templatesDir);

            templateFiles.forEach(file => {
                if (file.endsWith('.json')) {
                    try {
                        const locationName = path.basename(file, '.json');
                        const templateData = JSON.parse(
                            fs.readFileSync(path.join(templatesDir, file), 'utf8')
                        );
                        this.templates.set(locationName, new LocationTemplate(templateData));
                        console.log(`Loaded template for location: ${locationName}`);
                    } catch (error) {
                        console.error(`Error loading template ${file}:`, error);
                    }
                }
            });
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    public setLocation(locationName: string): boolean {
        if (this.templates.has(locationName)) {
            this.currentLocation = this.templates.get(locationName)!;
            return true;
        }
        return false;
    }

    public getCurrentTemplate(): LocationTemplate | null {
        return this.currentLocation;
    }

    public getAllLocations(): string[] {
        return Array.from(this.templates.keys());
    }

    public reloadTemplates(): void {
        this.templates.clear();
        this.currentLocation = null;
        this.loadTemplates();
    }

    public hasLocation(locationName: string): boolean {
        return this.templates.has(locationName);
    }
}
