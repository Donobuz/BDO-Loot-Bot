/**
 * Simple OCR region test - captures current region and shows what OCR sees
 */

const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

// Import sqlite3
const sqlite3 = require('sqlite3').verbose();

async function testCurrentOCRRegion() {
  console.log('🔍 Testing current OCR region...');
  
  try {
    // Get the region from database
    const dbPath = path.join(__dirname, 'data', 'bdo_loot_bot.db');
    
    if (!fs.existsSync(dbPath)) {
      console.log('❌ Database not found at:', dbPath);
      return;
    }

    const db = new sqlite3.Database(dbPath);

    const userPrefs = await new Promise((resolve, reject) => {
      db.get('SELECT designated_ocr_region FROM user_preferences LIMIT 1', (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    db.close();

    if (!userPrefs || !userPrefs.designated_ocr_region) {
      console.log('❌ No OCR region found in user preferences');
      return;
    }

    const region = JSON.parse(userPrefs.designated_ocr_region);
    console.log('📍 OCR Region:', region);
    console.log(`   Position: (${region.x}, ${region.y})`);
    console.log(`   Size: ${region.width} x ${region.height}`);

    // Check if region looks valid
    if (region.width <= 0 || region.height <= 0) {
      console.log('❌ Invalid region dimensions');
      return;
    }

    console.log('✅ Region appears valid');
    console.log('');
    console.log('📸 Next steps:');
    console.log('1. Check the debug screenshot: debug-screenshots/ocr-debug-0-*.png');
    console.log('2. Verify this matches where BDO shows loot messages');
    console.log('3. Make sure BDO is running and visible');
    console.log('4. Try killing some mobs to generate loot messages');
    console.log('');
    console.log('🔧 If the area is wrong, go to Settings → Configure Loot Detection');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testCurrentOCRRegion();
