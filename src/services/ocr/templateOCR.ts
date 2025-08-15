import { TemplateManager, LocationTemplate } from './templateManager';
import { PortableOCR, OCRResult } from './portableOCR';
import { UserPreferences } from '../db/types/user';
import { CropArea, TextFilters, Pattern } from '../db/types/ocr';

export interface LootMatch {
    item: string;
    quantity: number;
    confidence: number;
    method: 'exact' | 'fuzzy';
    originalText: string;
    bbox: number[][];
}

export interface ProcessResult {
    success: boolean;
    matches?: LootMatch[];
    location?: string;
    error?: string;
}

export interface QuantityMatch {
    quantity: number;
    item?: string;
}

export class TemplateOCR {
    private templateManager: TemplateManager;
    private ocrEngine: PortableOCR;
    private isInitialized: boolean;

    constructor() {
        this.templateManager = new TemplateManager();
        this.ocrEngine = new PortableOCR();
        this.isInitialized = false;
    }

    public async initialize(): Promise<boolean> {
        try {
            const ocrReady = await this.ocrEngine.initialize();
            this.isInitialized = ocrReady;
            return this.isInitialized;
        } catch (error) {
            console.error('Failed to initialize TemplateOCR:', error);
            return false;
        }
    }

    public setUserPreferences(preferences: UserPreferences): void {
        this.templateManager.setUserPreferences(preferences);
    }

    public setLocation(locationName: string): boolean {
        return this.templateManager.setLocation(locationName);
    }

    public getAllLocations(): string[] {
        return this.templateManager.getAllLocations();
    }

    public async processLootArea(imageBuffer: Buffer): Promise<ProcessResult> {
        if (!this.isInitialized) {
            return {
                success: false,
                error: 'OCR engine not initialized. Call initialize() first.'
            };
        }

        const template = this.templateManager.getCurrentTemplate();
        if (!template) {
            return {
                success: false,
                error: 'No location template selected. Please set a location first.'
            };
        }

        try {
            // 1. Get OCR region from user preferences
            const ocrRegion = this.templateManager.getUserOCRRegion();
            
            // 2. Crop image if region is specified
            let processedBuffer = imageBuffer;
            if (ocrRegion) {
                processedBuffer = await this.cropImage(imageBuffer, ocrRegion);
            }

            // 3. Apply template-specific preprocessing
            processedBuffer = await this.preprocessForTemplate(processedBuffer, template);

            // 4. Perform OCR
            const ocrResults = await this.ocrEngine.recognizeTextFromBuffer(processedBuffer);

            // 5. Match results against template
            const matchedItems = this.matchAgainstTemplate(ocrResults, template);

            return matchedItems;
        } catch (error) {
            return {
                success: false,
                error: `Failed to process loot area: ${error}`
            };
        }
    }

    public async processLootImage(imagePath: string): Promise<ProcessResult> {
        if (!this.isInitialized) {
            return {
                success: false,
                error: 'OCR engine not initialized. Call initialize() first.'
            };
        }

        const template = this.templateManager.getCurrentTemplate();
        if (!template) {
            return {
                success: false,
                error: 'No location template selected. Please set a location first.'
            };
        }

        try {
            const ocrResults = await this.ocrEngine.recognizeText(imagePath);
            const matchedItems = this.matchAgainstTemplate(ocrResults, template);
            return matchedItems;
        } catch (error) {
            return {
                success: false,
                error: `Failed to process loot image: ${error}`
            };
        }
    }

    private async cropImage(imageBuffer: Buffer, cropArea: CropArea): Promise<Buffer> {
        // TODO: Implement image cropping using sharp or canvas
        // For now, return the original buffer
        // You'll need to install sharp: npm install sharp @types/sharp
        
        /*
        const sharp = require('sharp');
        return await sharp(imageBuffer)
            .extract({
                left: cropArea.x,
                top: cropArea.y,
                width: cropArea.width,
                height: cropArea.height
            })
            .png()
            .toBuffer();
        */
        
        return imageBuffer;
    }

    private async preprocessForTemplate(imageBuffer: Buffer, template: LocationTemplate): Promise<Buffer> {
        // TODO: Apply template-specific image preprocessing
        // Different locations might need different contrast/brightness adjustments
        // For now, return the original buffer
        
        /*
        const sharp = require('sharp');
        return await sharp(imageBuffer)
            .greyscale()
            .normalize()
            .sharpen()
            .png()
            .toBuffer();
        */
        
        return imageBuffer;
    }

    private matchAgainstTemplate(ocrResults: OCRResult, template: LocationTemplate): ProcessResult {
        const matches: LootMatch[] = [];

        if (!ocrResults.success || !ocrResults.results) {
            return {
                success: false,
                error: ocrResults.error || 'OCR failed'
            };
        }

        for (const result of ocrResults.results) {
            const text = result.text;

            // Apply text filters
            if (!this.passesTextFilters(text, template.textFilters)) {
                continue;
            }

            // Try to match against template items
            const itemMatch = template.matchItem(text);

            if (itemMatch.match && itemMatch.item) {
                // Check for quantity patterns
                const quantityMatch = this.extractQuantity(text, template.patterns);

                matches.push({
                    item: itemMatch.item,
                    quantity: quantityMatch.quantity,
                    confidence: itemMatch.confidence || 0,
                    method: itemMatch.method || 'exact',
                    originalText: text,
                    bbox: result.bbox
                });
            }
        }

        return {
            success: true,
            matches: matches,
            location: template.name
        };
    }

    private passesTextFilters(text: string, filters?: TextFilters): boolean {
        if (!filters) return true;

        // Character whitelist
        if (filters.allowedCharacters) {
            const allowedSet = new Set(filters.allowedCharacters);
            for (const char of text) {
                if (!allowedSet.has(char)) {
                    return false;
                }
            }
        }

        // Minimum length
        if (filters.minLength && text.length < filters.minLength) {
            return false;
        }

        return true;
    }

    private extractQuantity(text: string, patterns: Pattern[]): QuantityMatch {
        for (const pattern of patterns) {
            if (pattern.type === 'quantity') {
                const match = text.match(new RegExp(pattern.regex));
                if (match) {
                    return {
                        quantity: parseInt(match[1]) || 1,
                        item: match[2]
                    };
                }
            }
        }
        return { quantity: 1 };
    }

    public isReady(): boolean {
        return this.isInitialized && this.ocrEngine.isReady();
    }

    public reloadTemplates(): void {
        this.templateManager.reloadTemplates();
    }
}
