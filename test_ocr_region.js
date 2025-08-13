/**
 * Test script to manually test OCR region
 * This will capture the current OCR region and run OCR on it
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Database connection
const sqlite3 = require('sqlite3').verbose();

async function testOCRRegion() {
  try {
    // Get OCR region from database
    const dbPath = path.join(__dirname, 'data', 'bdo_loot_bot.db');
    const db = new sqlite3.Database(dbPath);

    const userPrefs = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM user_preferences LIMIT 1', (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!userPrefs || !userPrefs.designated_ocr_region) {
      console.log('❌ No OCR region configured in user preferences');
      db.close();
      return;
    }

    const region = JSON.parse(userPrefs.designated_ocr_region);
    console.log('📍 Found OCR Region:', region);

    // Run the main app's OCR test
    console.log('🔍 Starting OCR region test...');
    const electronPath = path.join(__dirname, 'node_modules', '.bin', 'electron');
    const mainScript = path.join(__dirname, 'dist', 'main.js');

    const testProcess = spawn(electronPath, [mainScript, '--test-ocr-region'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'development',
        OCR_TEST_MODE: 'true'
      }
    });

    testProcess.on('close', (code) => {
      console.log(`OCR test completed with code ${code}`);
      db.close();
    });

    testProcess.on('error', (error) => {
      console.error('Failed to start OCR test:', error);
      db.close();
    });

  } catch (error) {
    console.error('Error testing OCR region:', error);
  }
}

testOCRRegion();
