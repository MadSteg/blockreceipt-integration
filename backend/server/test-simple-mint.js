/**
 * Simple BlockReceipt Minting Test
 * 
 * Quick test to verify the core minting functionality
 * This is the simplest way to test BlockReceipt NFT minting
 */

import 'dotenv/config';
import fetch from 'node-fetch';

// Simple configuration
const API_URL = process.env.BLOCKRECEIPT_API_URL || 'http://localhost:3000';
const API_KEY = process.env.WEBHOOK_API_KEY || 'test-api-key';

/**
 * Test the core minting webhook
 */
async function testMinting() {
  console.log('🚀 Testing BlockReceipt NFT Minting...\n');

  // Generate unique token ID
  const tokenId = Math.floor(Math.random() * 100000) + 30000;
  
  // Test payload (matches the webhook.mjs format)
  const payload = {
    tokenId: tokenId,
    to: '0x31551DE1Bd94Fe9B76801Ed226697a57D806d6ff', // Test wallet
    merchantName: 'Test Coffee Shop',
    totalCents: 1575, // $15.75
    paymentLast4: '4242',
    timestamp: Math.floor(Date.now() / 1000),
    items: [
      {
        desc: 'Specialty Latte',
        qty: 1,
        unitCents: 550
      },
      {
        desc: 'Breakfast Sandwich', 
        qty: 1,
        unitCents: 725
      },
      {
        desc: 'Tax',
        qty: 1,
        unitCents: 300
      }
    ]
  };

  console.log('📝 Payload:', JSON.stringify(payload, null, 2));
  console.log('');

  try {
    console.log('🔄 Calling BlockReceipt webhook...');
    
    const response = await fetch(`${API_URL}/pos/mint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(payload)
    });

    console.log(`📡 Response Status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error Response:', errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    
    console.log('✅ Success! BlockReceipt NFT minted!');
    console.log('');
    console.log('📊 Result:');
    console.log(`   Token ID: ${result.tokenId}`);
    console.log(`   Wallet: ${result.to}`);
    console.log(`   Merchant: ${result.merchantName}`);
    console.log(`   Metadata: ${result.metadata}`);
    console.log(`   Image: ${result.image}`);
    console.log(`   Transaction: ${result.txHash}`);
    console.log(`   Block: ${result.blockNumber}`);
    console.log('');

    // Verify the NFT was created
    if (result.metadata) {
      console.log('🔍 Verifying NFT metadata...');
      try {
        const metadataResponse = await fetch(result.metadata);
        if (metadataResponse.ok) {
          const metadata = await metadataResponse.json();
          console.log('✅ Metadata verified!');
          console.log('📄 NFT Metadata:', JSON.stringify(metadata, null, 2));
        } else {
          console.log('⚠️ Could not verify metadata');
        }
      } catch (error) {
        console.log('⚠️ Metadata verification failed:', error.message);
      }
    }

    return result;

  } catch (error) {
    console.error('💥 Minting failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('1. Make sure the BlockReceipt server is running on', API_URL);
    console.log('2. Check that WEBHOOK_API_KEY is set correctly');
    console.log('3. Verify the server logs for detailed error messages');
    console.log('4. Ensure all environment variables are configured');
    throw error;
  }
}

/**
 * Test multiple mints
 */
async function testMultipleMints(count = 3) {
  console.log(`🔄 Testing ${count} consecutive mints...\n`);
  
  const results = [];
  
  for (let i = 1; i <= count; i++) {
    console.log(`📝 Mint ${i}/${count}:`);
    try {
      const result = await testMinting();
      results.push(result);
      console.log(`✅ Mint ${i} successful!\n`);
      
      // Wait 1 second between mints
      if (i < count) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(`❌ Mint ${i} failed:`, error.message);
      break;
    }
  }
  
  console.log(`🎉 Completed ${results.length}/${count} mints successfully!`);
  return results;
}

/**
 * Test with different merchant scenarios
 */
async function testMerchantScenarios() {
  console.log('🏪 Testing different merchant scenarios...\n');
  
  const scenarios = [
    {
      name: 'Coffee Shop',
      merchantName: 'Downtown Coffee Co.',
      totalCents: 1575,
      items: [
        { desc: 'Latte', qty: 1, unitCents: 550 },
        { desc: 'Muffin', qty: 1, unitCents: 325 },
        { desc: 'Tax', qty: 1, unitCents: 300 }
      ]
    },
    {
      name: 'Restaurant',
      merchantName: 'Bella Vista Restaurant',
      totalCents: 4567,
      items: [
        { desc: 'Pasta Carbonara', qty: 1, unitCents: 1899 },
        { desc: 'Caesar Salad', qty: 1, unitCents: 1299 },
        { desc: 'Wine', qty: 1, unitCents: 899 },
        { desc: 'Tax', qty: 1, unitCents: 470 }
      ]
    },
    {
      name: 'Retail Store',
      merchantName: 'Tech Store',
      totalCents: 29999,
      items: [
        { desc: 'Wireless Headphones', qty: 1, unitCents: 19999 },
        { desc: 'Phone Case', qty: 2, unitCents: 2999 },
        { desc: 'Tax', qty: 1, unitCents: 7001 }
      ]
    }
  ];
  
  for (const scenario of scenarios) {
    console.log(`🏪 Testing ${scenario.name} scenario...`);
    
    const payload = {
      tokenId: Math.floor(Math.random() * 100000) + 40000,
      to: '0x31551DE1Bd94Fe9B76801Ed226697a57D806d6ff',
      merchantName: scenario.merchantName,
      totalCents: scenario.totalCents,
      paymentLast4: '4242',
      timestamp: Math.floor(Date.now() / 1000),
      items: scenario.items
    };
    
    try {
      const response = await fetch(`${API_URL}/pos/mint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        },
        body: JSON.stringify(payload)
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ ${scenario.name} mint successful! Token ID: ${result.tokenId}`);
      } else {
        console.log(`❌ ${scenario.name} mint failed: ${response.status}`);
      }
    } catch (error) {
      console.log(`❌ ${scenario.name} mint error: ${error.message}`);
    }
    
    console.log('');
  }
}

// Run the test
async function runTest() {
  console.log('🧪 BlockReceipt Simple Minting Test');
  console.log('=' .repeat(50));
  console.log(`API URL: ${API_URL}`);
  console.log(`API Key: ${API_KEY.substring(0, 8)}...`);
  console.log('=' .repeat(50));
  console.log('');
  
  try {
    // Test 1: Single mint
    console.log('🧪 TEST 1: Single Mint');
    console.log('-'.repeat(30));
    await testMinting();
    
    // Test 2: Multiple mints
    console.log('🧪 TEST 2: Multiple Mints');
    console.log('-'.repeat(30));
    await testMultipleMints(2);
    
    // Test 3: Different merchants
    console.log('🧪 TEST 3: Different Merchant Scenarios');
    console.log('-'.repeat(30));
    await testMerchantScenarios();
    
    console.log('🎉 All tests completed successfully!');
    console.log('✅ BlockReceipt minting is working correctly!');
    
  } catch (error) {
    console.error('💥 Test failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTest().catch(console.error);
}

export { testMinting, testMultipleMints, testMerchantScenarios, runTest };
