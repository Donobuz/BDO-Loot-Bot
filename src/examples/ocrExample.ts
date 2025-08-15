import { getOCRService } from '../services/ocr';
import { UserPreferencesService } from '../services/db/userPreferences';

/**
 * Example usage of the BDO Loot Bot OCR system
 */
export class OCRExample {
    private ocrService = getOCRService();
    private userPreferencesService = new UserPreferencesService();

    async initializeExample(userId: string) {
        console.log('🚀 Initializing BDO Loot Bot OCR Example...');

        // 1. Initialize the OCR service
        const initialized = await this.ocrService.initialize();
        if (!initialized) {
            throw new Error('Failed to initialize OCR service');
        }

        // 2. Load user preferences (including OCR region)
        const preferencesResult = await this.userPreferencesService.getPreferences(userId);
        if (preferencesResult.success && preferencesResult.data) {
            this.ocrService.setUserPreferences(preferencesResult.data);
            console.log('✅ User preferences loaded');
        }

        // 3. Set grind location
        const availableLocations = this.ocrService.getAvailableLocations();
        console.log('📍 Available locations:', availableLocations);

        if (availableLocations.includes('polly-forest')) {
            const locationResult = await this.ocrService.setGrindLocation('polly-forest');
            if (locationResult.success) {
                console.log('✅ Location set to Polly Forest');
            }
        }

        console.log('🎯 OCR service ready for loot detection!');
    }

    async startLootSession() {
        console.log('🎮 Starting loot tracking session...');
        
        const sessionResult = this.ocrService.startSession();
        if (sessionResult.success) {
            console.log('✅ Session started successfully');
            return true;
        } else {
            console.error('❌ Failed to start session:', sessionResult.error);
            return false;
        }
    }

    async processTestImage(imagePath: string) {
        console.log(`🔍 Processing test image: ${imagePath}`);
        
        const result = await this.ocrService.processLootImage(imagePath);
        
        if (result.success) {
            console.log(`✅ Found ${result.itemsFound} items:`);
            if (result.items) {
                result.items.forEach(item => {
                    console.log(`  • ${item.quantity}x ${item.item} (${(item.confidence * 100).toFixed(1)}% confidence, ${item.method} match)`);
                });
            }
        } else {
            console.error('❌ OCR processing failed:', result.error);
        }

        return result;
    }

    async processImageBuffer(imageBuffer: Buffer) {
        console.log('🔍 Processing image buffer...');
        
        const result = await this.ocrService.processLootDrop(imageBuffer);
        
        if (result.success) {
            console.log(`✅ Found ${result.itemsFound} items in buffer`);
        } else {
            console.error('❌ Buffer processing failed:', result.error);
        }

        return result;
    }

    getSessionSummary() {
        const summary = this.ocrService.getSessionSummary();
        
        console.log('📊 Session Summary:');
        console.log(`  Location: ${summary.location}`);
        console.log(`  Duration: ${Math.round(summary.duration / 1000)}s`);
        console.log(`  Items collected: ${summary.itemCount}`);
        console.log(`  Silver: ${summary.silver.toLocaleString()}`);
        console.log('  Loot breakdown:');
        
        Object.entries(summary.loot).forEach(([item, count]) => {
            console.log(`    • ${count}x ${item}`);
        });

        return summary;
    }

    endSession() {
        console.log('🏁 Ending loot session...');
        const summary = this.ocrService.endSession();
        return summary;
    }

    getStatus() {
        const status = this.ocrService.getStatus();
        
        console.log('📋 Bot Status:');
        console.log(`  Initialized: ${status.initialized ? '✅' : '❌'}`);
        console.log(`  OCR Ready: ${status.ocrReady ? '✅' : '❌'}`);
        console.log(`  Current Location: ${status.currentLocation || 'None'}`);
        console.log(`  Session Active: ${status.sessionActive ? '✅' : '❌'}`);

        return status;
    }

    reloadTemplates() {
        console.log('🔄 Reloading location templates...');
        this.ocrService.reloadTemplates();
        console.log('✅ Templates reloaded');
    }
}

// Usage example:
/*
async function runExample() {
    const example = new OCRExample();
    
    try {
        // Initialize with user ID
        await example.initializeExample('user123');
        
        // Check status
        example.getStatus();
        
        // Start session
        await example.startLootSession();
        
        // Process a test image (if you have one)
        // await example.processTestImage('path/to/test/image.png');
        
        // Get current status
        example.getSessionSummary();
        
        // End session
        example.endSession();
        
    } catch (error) {
        console.error('Example failed:', error);
    }
}

// runExample();
*/
