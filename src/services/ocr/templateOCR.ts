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
    rawOCRResults?: Array<{
        text: string;
        confidence: number;
        bbox: number[][];
    }>;
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
            console.log('Initializing TemplateOCR...');
            const ocrReady = await this.ocrEngine.initialize();
            console.log('OCR Engine initialization result:', ocrReady);
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

    public async processLootArea(imageBuffer: Buffer, debugMode: boolean = false): Promise<ProcessResult> {
        if (!this.isInitialized) {
            return {
                success: false,
                error: 'OCR engine not initialized. Call initialize() first.'
            };
        }

        try {
            console.log('Processing loot area, buffer size:', imageBuffer.length);
            
            // 1. Preprocess the image for better OCR accuracy
            const preprocessedBuffer = await this.preprocessImageForOCR(imageBuffer, debugMode);

            // 2. Perform OCR on the preprocessed image
            const ocrResults = await this.ocrEngine.recognizeTextFromBuffer(preprocessedBuffer);

            if (!ocrResults.success) {
                console.error('OCR processing failed:', ocrResults.error);
                return {
                    success: false,
                    error: ocrResults.error || 'OCR processing failed'
                };
            }

            // 3. Debug logging - log all detected text
            if (debugMode && ocrResults.results) {
                console.log('=== OCR DEBUG RESULTS ===');
                console.log('Total results found:', ocrResults.results.length);
                ocrResults.results.forEach((result, index) => {
                    console.log(`Text ${index + 1}: "${result.text}" (confidence: ${result.confidence?.toFixed(2) || 'N/A'})`);
                });
                console.log('========================');
            }

            // 4. Clean and filter the OCR results
            const cleanedResults = this.cleanOCRResults(ocrResults.results || []);

            console.log(`OCR found ${ocrResults.results?.length || 0} raw results, ${cleanedResults.length} after cleaning`);

            // 5. Return processed results
            return {
                success: true,
                matches: [], // BDOLootBot will handle the matching
                rawOCRResults: cleanedResults
            };
        } catch (error) {
            console.error('Failed to process loot area:', error);
            return {
                success: false,
                error: `Failed to process loot area: ${error}`
            };
        }
    }

    private async preprocessImageForOCR(imageBuffer: Buffer, debugMode: boolean = false): Promise<Buffer> {
        try {
            const sharp = require('sharp');
            
            // Apply enhanced preprocessing specifically for light/transparent backgrounds
            let processedBuffer = await sharp(imageBuffer)
                // Convert to grayscale for better contrast
                .greyscale()
                // Normalize to use full range
                .normalize()
                // Apply aggressive contrast enhancement for light backgrounds
                .linear(2.5, -30) // multiply by 2.5, subtract 30 to darken background
                // Apply gaussian blur to reduce noise, then sharpen
                .blur(0.3)
                .sharpen({ sigma: 2, m1: 1, m2: 3, x1: 2, y1: 10 })
                // Convert to PNG for better quality
                .png({ quality: 100, compressionLevel: 0 })
                .toBuffer();

            // Save debug image if requested
            if (debugMode) {
                const fs = require('fs');
                const path = require('path');
                const debugDir = path.join(process.cwd(), 'debug-screenshots');
                if (!fs.existsSync(debugDir)) {
                    fs.mkdirSync(debugDir, { recursive: true });
                }
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                const debugPath = path.join(debugDir, `ocr-preprocessed-${timestamp}.png`);
                fs.writeFileSync(debugPath, processedBuffer);
                console.log(`Debug preprocessed image saved: ${debugPath}`);
            }

            return processedBuffer;
        } catch (error) {
            console.error('Image preprocessing failed, using original:', error);
            return imageBuffer; // Fallback to original
        }
    }

    private cleanOCRResults(results: Array<{ text: string; confidence: number; bbox: number[][] }>): Array<{ text: string; confidence: number; bbox: number[][] }> {
        return results
            .filter(result => {
                // Filter out very low confidence results
                if (result.confidence < 0.25) return false; // Lowered from 0.3 to catch more items
                
                // Filter out very short text (likely noise)
                if (result.text.trim().length < 2) return false;
                
                // Filter out text that's just numbers or special characters
                if (/^[\d\s\-_.,!@#$%^&*()]+$/.test(result.text.trim())) return false;
                
                return true;
            })
            .map(result => ({
                ...result,
                // Clean up the text
                text: result.text
                    // Remove extra whitespace
                    .trim()
                    .replace(/\s+/g, ' ')
                    // Fix common OCR mistakes
                    .replace(/[|]/g, 'l')  // | -> l
                    .replace(/[0]/g, 'O')  // 0 -> O (in item names)
                    .replace(/[5]/g, 'S')  // 5 -> S (in item names)
                    .replace(/[1]/g, 'I')  // 1 -> I (in item names)
                    .replace(/[8]/g, 'B')  // 8 -> B (in item names)
            }))
            .sort((a, b) => b.confidence - a.confidence); // Sort by confidence
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

    // New method to enable debug mode for testing
    public async processLootAreaWithDebug(imageBuffer: Buffer): Promise<ProcessResult> {
        return this.processLootArea(imageBuffer, true);
    }
}
