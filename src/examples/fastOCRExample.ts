/**
 * FastOCR Integration Example
 * Shows how to use DXCam + PaddleOCR + BDO Template Matching
 * for ultra-fast real-time loot detection
 */

import { FastOCRService } from '../services/ocr/fastOCR';
import { OCRRegion } from '../renderer/types';

// Example usage of the FastOCR service
export async function runFastOCRExample() {
  console.log('=== FastOCR Integration Example ===');
  console.log('DXCam + PaddleOCR + BDO Template Matching');
  
  // Initialize the FastOCR service
  const fastOCR = new FastOCRService();
  
  try {
    console.log('1. Initializing FastOCR service (DXCam + PaddleOCR + BDOLootBot)...');
    const initialized = await fastOCR.initialize();
    
    if (!initialized) {
      console.error('❌ Failed to initialize FastOCR service');
      return;
    }
    
    console.log('✅ FastOCR service initialized successfully!');
    console.log('   - DXCam: GPU-accelerated screen capture ready');
    console.log('   - PaddleOCR: High-performance OCR engine ready');
    console.log('   - BDOLootBot: Template matching system ready');

    // Example OCR region (typical loot area in BDO)
    // In real usage, this would come from user_preferences.designated_ocr_region
    const testRegion: OCRRegion = {
      x: 100,
      y: 200, 
      width: 400,
      height: 300
    };

    console.log('\n2. Testing single loot region processing...');
    const result = await fastOCR.processLootRegion(testRegion);
    
    if (result.success) {
      console.log(`✅ Processed loot region in ${result.stats?.total_time}ms`);
      console.log(`   - Screen capture: ${result.stats?.capture_time}ms`);
      console.log(`   - OCR processing: ${result.stats?.ocr_time}ms`);
      console.log(`   - Items found: ${result.itemsFound}`);
      
      if (result.items && result.items.length > 0) {
        console.log('\n   Found loot items:');
        result.items.forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.item} x${item.quantity}`);
          console.log(`      Confidence: ${Math.round(item.confidence * 100)}%`);
          console.log(`      Match type: ${item.method}`);
          console.log(`      Original OCR: "${item.originalText}"`);
        });
      }
    } else {
      console.error('❌ Loot region processing failed:', result.error);
    }

    console.log('\n3. Testing continuous loot monitoring...');
    console.log('   Starting 5-second monitoring demo...');
    
    const monitoringStarted = await fastOCR.startLootMonitoring(testRegion, 500);
    
    if (monitoringStarted) {
      console.log('✅ Continuous loot monitoring started');
      console.log('   Monitoring every 500ms for real-time loot detection');
      
      // Let it run for 5 seconds
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      fastOCR.stopLootMonitoring();
      console.log('✅ Monitoring stopped after 5 seconds');
    } else {
      console.error('❌ Failed to start continuous monitoring');
    }

    // Show monitoring status
    const status = fastOCR.getMonitoringStatus();
    console.log('\n4. Final monitoring status:');
    console.log(`   Active: ${status.active}`);
    console.log(`   Region: ${status.region ? `${status.region.x},${status.region.y} ${status.region.width}x${status.region.height}` : 'None'}`);

  } catch (error) {
    console.error('❌ FastOCR example failed:', error);
  } finally {
    // Clean up resources
    console.log('\n5. Cleaning up FastOCR resources...');
    fastOCR.cleanup();
    console.log('✅ FastOCR example completed');
  }
}

// Usage with user preferences OCR region
export async function runFastOCRWithUserPreferences() {
  console.log('=== FastOCR with User Preferences Integration ===');
  
  // In a real implementation, you would get this from:
  // const userPrefs = await getUserPreferences();
  // const ocrRegion = userPrefs.designated_ocr_region;
  
  const mockUserOCRRegion: OCRRegion = {
    x: 150,
    y: 250,
    width: 500,
    height: 350
  };

  const fastOCR = new FastOCRService();
  
  try {
    await fastOCR.initialize();
    console.log('FastOCR initialized with user designated region');
    
    // Process the user's designated OCR region
    const result = await fastOCR.processLootRegion(mockUserOCRRegion);
    console.log('User region processed:', result.success ? '✅' : '❌');
    
  } finally {
    fastOCR.cleanup();
  }
}

// Export for use in other examples or main application
export { FastOCRService };
