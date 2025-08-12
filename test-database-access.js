// Test script to verify database access with service role key
require("dotenv").config();
import { createClient } from "@supabase/supabase-js";

async function testDatabaseAccess() {
  console.log("🔍 Testing database access...");

  // Test with service role key
  const serviceClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Test with anon key (should fail if RLS is properly set up)
  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );

  try {
    console.log("\n📋 Testing service role access...");
    const { data: serviceData, error: serviceError } = await serviceClient
      .from("users")
      .select("count")
      .limit(1);

    if (serviceError) {
      console.log("❌ Service role failed:", serviceError.message);
    } else {
      console.log("✅ Service role access works!");
    }

    console.log(
      "\n📖 Testing anonymous read access (should work for your website)..."
    );
    const { data: anonData, error: anonError } = await anonClient
      .from("users")
      .select("id")
      .limit(1);

    if (anonError) {
      console.log("❌ Anonymous read access blocked:", anonError.message);
      console.log("   This means your website won't be able to read data!");
    } else {
      console.log("✅ Anonymous read access works - perfect for your website!");
    }

    console.log("\n🚫 Testing anonymous write access (should fail)...");
    const { data: writeData, error: writeError } = await anonClient
      .from("users")
      .insert({ discord_id: "test", username: "test" });

    if (writeError) {
      console.log(
        "✅ Anonymous write access properly blocked:",
        writeError.message
      );
    } else {
      console.log("❌ Anonymous write access works - SECURITY ISSUE!");
    }
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testDatabaseAccess();
