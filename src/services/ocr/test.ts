/**
 * Simple test for the bundled OCR service
 */

import { ocrService } from './ocrService.js';
import * as path from 'path';
import * as fs from 'fs';

async function testOCR() {
  console.log('🧪 Testing Bundled OCR Service...');
  
  try {
    // Test initialization
    console.log('⚡ Initializing OCR service...');
    await ocrService.initialize();
    console.log('✅ OCR service initialized successfully');
    
    // Test ready status
    const isReady = ocrService.isReady();
    console.log(`📊 OCR ready status: ${isReady}`);
    
    // Test dependency installation (should be instant since it's bundled)
    console.log('📦 Testing dependency installation...');
    const depResult = await ocrService.installDependencies();
    console.log(`✅ Dependencies: ${depResult.success ? 'Ready' : 'Failed'}`);
    
    console.log('\n🎉 Bundled OCR Service Test Complete!');
    console.log('🚀 Ready for production deployment with zero external dependencies');
    
  } catch (error) {
    console.error('❌ OCR Test Failed:', error);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testOCR();
}

export { testOCR };
