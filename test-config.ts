// Simple test script to check configuration
import * as dotenv from 'dotenv';

dotenv.config();

console.log('=== Environment Check ===');
console.log('DISCORD_CLIENT_ID:', process.env.DISCORD_CLIENT_ID);
console.log('DISCORD_CLIENT_SECRET:', process.env.DISCORD_CLIENT_SECRET ? '[SET]' : '[NOT SET]');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL);
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '[SET]' : '[NOT SET]');

// Test Supabase connection
import { databaseService } from './src/services/db';

async function testDatabase() {
  try {
    console.log('\n=== Database Test ===');
    await databaseService.testConnection();
  } catch (error) {
    console.error('Database test failed:', error);
  }
}

testDatabase();
