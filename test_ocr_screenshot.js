const { OCRService } = require('./src/services/ocr/ocrService');
const path = require('path');
const fs = require('fs');

async function testOCROnScreenshot() {
    console.log('🔍 Testing OCR on BDO loot screenshot...\n');
    
    const ocrService = new OCRService();
    
    try {
        // Initialize OCR
        console.log('Initializing OCR service...');
        await ocrService.initialize();
        console.log('✅ OCR service initialized\n');
        
        // Test image path (you'll need to save your screenshot here)
        const imagePath = path.join(__dirname, 'test_images', 'bdo_loot_screenshot.png');
        
        if (!fs.existsSync(imagePath)) {
            console.log('❌ Please save your screenshot as:', imagePath);
            console.log('   Then run this script again.');
            return;
        }
        
        console.log('📸 Processing image:', imagePath);
        
        // Extract items using your bundled OCR
        const startTime = Date.now();
        const result = await ocrService.extractItems(imagePath);
        const processingTime = Date.now() - startTime;
        
        console.log(`⏱️  Processing time: ${processingTime}ms\n`);
        
        if (result.success && result.items) {
            console.log('🎯 DETECTED ITEMS:');
            console.log('==================');
            
            result.items.forEach((item, index) => {
                console.log(`${index + 1}. "${item.name}" (confidence: ${(item.confidence * 100).toFixed(1)}%)`);
            });
            
            console.log(`\n📊 SUMMARY:`);
            console.log(`   Total items detected: ${result.items.length}`);
            
            if (result.raw_results) {
                console.log(`   Raw text regions: ${result.raw_results.length}`);
            }
        } else {
            console.log('❌ No items detected or error occurred');
            if (result.error) {
                console.log('Error:', result.error);
            }
        }
        
        // Also extract raw text to see everything it found
        console.log('\n🔍 RAW TEXT EXTRACTION:');
        console.log('========================');
        
        const textResult = await ocrService.extractText(imagePath);
        if (textResult.success && textResult.results) {
            textResult.results.forEach((text, index) => {
                console.log(`${index + 1}. "${text.text}" (confidence: ${(text.confidence * 100).toFixed(1)}%)`);
            });
        }
        
    } catch (error) {
        console.error('❌ Error testing OCR:', error);
    }
}

// Run the test
testOCROnScreenshot().catch(console.error);
