/**
 * Quick FastOCR Test Script
 * Tests if the DXCam + PaddleOCR integration is working
 */

import { FastOCRService } from '../services/ocr/fastOCR';

async function testFastOCR() {
    console.log('=== FastOCR Integration Test ===');
    
    const fastOCR = new FastOCRService();
    
    try {
        console.log('1. Initializing FastOCR...');
        const initialized = await fastOCR.initialize();
        
        if (initialized) {
            console.log('✅ FastOCR initialized successfully!');
            
            // Test basic functionality
            console.log('2. Testing OCR service...');
            const testResult = await fastOCR.test();
            console.log('✅ OCR test result:', testResult);
            
            console.log('3. Testing with a sample region...');
            const testRegion = { x: 100, y: 100, width: 200, height: 100 };
            const result = await fastOCR.processRegion(testRegion);
            console.log('✅ Region processing result:', result.success);
            
        } else {
            console.error('❌ FastOCR initialization failed');
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        fastOCR.cleanup();
        console.log('🧹 Cleanup completed');
    }
}

// Export for use in main process
export { testFastOCR };
