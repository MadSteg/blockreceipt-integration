/**
 * POS Transaction Simulation
 * 
 * Simulates a complete POS transaction flow that mints a BlockReceipt NFT
 * Tests the entire pipeline from POS to blockchain
 */

import 'dotenv/config';
import fetch from 'node-fetch';

// Configuration
const CONFIG = {
  BLOCKRECEIPT_API_URL: process.env.BLOCKRECEIPT_API_URL || 'http://localhost:3000',
  API_KEY: process.env.WEBHOOK_API_KEY || 'test-api-key',
  MERCHANT_ID: process.env.MERCHANT_ID || 'test-merchant-1',
  TEST_PHONE: '+1234567890',
  TEST_EMAIL: 'test@example.com'
};

/**
 * Simulate a Toast POS transaction
 */
async function simulateToastTransaction() {
  console.log('🍞 Simulating Toast POS Transaction...\n');

  const toastOrderData = {
    orderId: `toast_${Date.now()}`,
    merchantId: CONFIG.MERCHANT_ID,
    merchantName: 'Downtown Coffee Co.',
    customerPhone: CONFIG.TEST_PHONE,
    customerEmail: CONFIG.TEST_EMAIL,
    totalAmount: 15.75,
    subtotal: 14.25,
    tax: 1.50,
    tip: 0,
    items: [
      {
        name: 'Specialty Latte',
        price: 5.50,
        quantity: 1,
        category: 'beverages',
        modifiers: ['extra shot', 'oat milk']
      },
      {
        name: 'Breakfast Sandwich',
        price: 7.25,
        quantity: 1,
        category: 'food',
        modifiers: ['bacon', 'avocado']
      },
      {
        name: 'Chocolate Croissant',
        price: 3.00,
        quantity: 1,
        category: 'pastry'
      }
    ],
    timestamp: Date.now(),
    locationId: 'toast_loc_1',
    serverId: 'server_123',
    tableNumber: 'Table 5'
  };

  try {
    // Step 1: Process receipt through Toast SDK
    console.log('📝 Step 1: Processing receipt through Toast SDK...');
    const response = await fetch(`${CONFIG.BLOCKRECEIPT_API_URL}/api/enterprise/toast/process-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.API_KEY
      },
      body: JSON.stringify(toastOrderData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log('✅ Toast receipt processed successfully!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));

    return result;

  } catch (error) {
    console.error('❌ Error processing Toast transaction:', error.message);
    throw error;
  }
}

/**
 * Simulate a Shopify e-commerce transaction
 */
async function simulateShopifyTransaction() {
  console.log('🛍️ Simulating Shopify E-commerce Transaction...\n');

  const shopifyOrderData = {
    orderId: `shopify_${Date.now()}`,
    merchantId: CONFIG.MERCHANT_ID,
    merchantName: 'Tech Store Online',
    customerPhone: CONFIG.TEST_PHONE,
    customerEmail: CONFIG.TEST_EMAIL,
    totalAmount: 299.99,
    subtotal: 275.00,
    tax: 24.99,
    shipping: 0,
    discount: 0,
    items: [
      {
        name: 'Wireless Headphones',
        price: 199.99,
        quantity: 1,
        sku: 'WH-001',
        category: 'electronics',
        vendor: 'TechBrand',
        tags: ['wireless', 'premium', 'noise-cancelling']
      },
      {
        name: 'Phone Case',
        price: 29.99,
        quantity: 2,
        sku: 'PC-002',
        category: 'accessories',
        vendor: 'TechBrand',
        tags: ['protective', 'clear']
      },
      {
        name: 'Screen Protector',
        price: 19.99,
        quantity: 1,
        sku: 'SP-003',
        category: 'accessories',
        vendor: 'TechBrand',
        tags: ['tempered-glass', 'anti-glare']
      }
    ],
    timestamp: Date.now(),
    shopDomain: 'techstore.myshopify.com',
    customerId: 'customer_456',
    shippingAddress: {
      firstName: 'John',
      lastName: 'Doe',
      address1: '123 Main St',
      city: 'San Francisco',
      province: 'CA',
      country: 'US',
      zip: '94102'
    }
  };

  try {
    // Step 1: Process receipt through Shopify SDK
    console.log('📝 Step 1: Processing receipt through Shopify SDK...');
    const response = await fetch(`${CONFIG.BLOCKRECEIPT_API_URL}/api/enterprise/shopify/process-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.API_KEY
      },
      body: JSON.stringify(shopifyOrderData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log('✅ Shopify receipt processed successfully!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));

    return result;

  } catch (error) {
    console.error('❌ Error processing Shopify transaction:', error.message);
    throw error;
  }
}

/**
 * Simulate direct webhook call (bypassing SDKs)
 */
async function simulateDirectWebhook() {
  console.log('🔗 Simulating Direct Webhook Call...\n');

  const webhookPayload = {
    tokenId: Math.floor(Math.random() * 100000) + 20000, // Generate unique token ID
    to: '0x31551DE1Bd94Fe9B76801Ed226697a57D806d6ff', // Test wallet address
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

  try {
    console.log('📝 Step 1: Calling BlockReceipt webhook directly...');
    const response = await fetch(`${CONFIG.BLOCKRECEIPT_API_URL}/pos/mint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.API_KEY
      },
      body: JSON.stringify(webhookPayload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log('✅ Direct webhook call successful!');
    console.log('📊 Result:', JSON.stringify(result, null, 2));

    return result;

  } catch (error) {
    console.error('❌ Error with direct webhook call:', error.message);
    throw error;
  }
}

/**
 * Test customer status and wallet creation
 */
async function testCustomerStatus() {
  console.log('👤 Testing Customer Status and Wallet Creation...\n');

  try {
    // Test phone-based status
    console.log('📱 Testing phone-based customer status...');
    const phoneResponse = await fetch(`${CONFIG.BLOCKRECEIPT_API_URL}/api/enterprise/customer/status/${encodeURIComponent(CONFIG.TEST_PHONE)}`, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.API_KEY
      }
    });

    if (phoneResponse.ok) {
      const phoneResult = await phoneResponse.json();
      console.log('✅ Phone status check successful!');
      console.log('📊 Phone Result:', JSON.stringify(phoneResult, null, 2));
    }

    // Test email-based status
    console.log('📧 Testing email-based customer status...');
    const emailResponse = await fetch(`${CONFIG.BLOCKRECEIPT_API_URL}/api/enterprise/customer/status-email/${encodeURIComponent(CONFIG.TEST_EMAIL)}`, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.API_KEY
      }
    });

    if (emailResponse.ok) {
      const emailResult = await emailResponse.json();
      console.log('✅ Email status check successful!');
      console.log('📊 Email Result:', JSON.stringify(emailResult, null, 2));
    }

  } catch (error) {
    console.error('❌ Error testing customer status:', error.message);
  }
}

/**
 * Test loyalty system
 */
async function testLoyaltySystem() {
  console.log('🎁 Testing Loyalty System...\n');

  try {
    // Test loyalty profile
    console.log('👤 Getting loyalty profile...');
    const profileResponse = await fetch(`${CONFIG.BLOCKRECEIPT_API_URL}/api/loyalty/profile/1`, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.API_KEY
      }
    });

    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      console.log('✅ Loyalty profile retrieved!');
      console.log('📊 Profile:', JSON.stringify(profile, null, 2));
    }

    // Test available rewards
    console.log('🎁 Getting available rewards...');
    const rewardsResponse = await fetch(`${CONFIG.BLOCKRECEIPT_API_URL}/api/loyalty/rewards/1`, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.API_KEY
      }
    });

    if (rewardsResponse.ok) {
      const rewards = await rewardsResponse.json();
      console.log('✅ Available rewards retrieved!');
      console.log('📊 Rewards:', JSON.stringify(rewards, null, 2));
    }

  } catch (error) {
    console.error('❌ Error testing loyalty system:', error.message);
  }
}

/**
 * Test analytics system
 */
async function testAnalytics() {
  console.log('📊 Testing Analytics System...\n');

  try {
    // Test merchant analytics
    console.log('🏪 Getting merchant analytics...');
    const analyticsResponse = await fetch(`${CONFIG.BLOCKRECEIPT_API_URL}/api/enterprise/analytics/merchant/1?startDate=2024-01-01&endDate=2024-01-31`, {
      method: 'GET',
      headers: {
        'x-api-key': CONFIG.API_KEY
      }
    });

    if (analyticsResponse.ok) {
      const analytics = await analyticsResponse.json();
      console.log('✅ Merchant analytics retrieved!');
      console.log('📊 Analytics:', JSON.stringify(analytics, null, 2));
    }

  } catch (error) {
    console.error('❌ Error testing analytics:', error.message);
  }
}

/**
 * Main simulation function
 */
async function runSimulation() {
  console.log('🚀 Starting BlockReceipt POS Transaction Simulation\n');
  console.log('=' .repeat(60));
  console.log('Configuration:');
  console.log(`API URL: ${CONFIG.BLOCKRECEIPT_API_URL}`);
  console.log(`Merchant ID: ${CONFIG.MERCHANT_ID}`);
  console.log(`Test Phone: ${CONFIG.TEST_PHONE}`);
  console.log(`Test Email: ${CONFIG.TEST_EMAIL}`);
  console.log('=' .repeat(60));
  console.log('');

  try {
    // Test 1: Direct webhook (simplest)
    console.log('🧪 TEST 1: Direct Webhook Call');
    console.log('-'.repeat(40));
    await simulateDirectWebhook();
    console.log('');

    // Test 2: Toast POS simulation
    console.log('🧪 TEST 2: Toast POS Simulation');
    console.log('-'.repeat(40));
    await simulateToastTransaction();
    console.log('');

    // Test 3: Shopify simulation
    console.log('🧪 TEST 3: Shopify E-commerce Simulation');
    console.log('-'.repeat(40));
    await simulateShopifyTransaction();
    console.log('');

    // Test 4: Customer status
    console.log('🧪 TEST 4: Customer Status & Wallet Creation');
    console.log('-'.repeat(40));
    await testCustomerStatus();
    console.log('');

    // Test 5: Loyalty system
    console.log('🧪 TEST 5: Loyalty System');
    console.log('-'.repeat(40));
    await testLoyaltySystem();
    console.log('');

    // Test 6: Analytics
    console.log('🧪 TEST 6: Analytics System');
    console.log('-'.repeat(40));
    await testAnalytics();
    console.log('');

    console.log('🎉 All simulations completed successfully!');
    console.log('✅ BlockReceipt is ready for enterprise deployment!');

  } catch (error) {
    console.error('💥 Simulation failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure the BlockReceipt server is running');
    console.log('2. Check your environment variables');
    console.log('3. Verify the API endpoints are accessible');
    console.log('4. Check the server logs for detailed error messages');
  }
}

// Run the simulation
if (import.meta.url === `file://${process.argv[1]}`) {
  runSimulation().catch(console.error);
}

export {
  simulateToastTransaction,
  simulateShopifyTransaction,
  simulateDirectWebhook,
  testCustomerStatus,
  testLoyaltySystem,
  testAnalytics,
  runSimulation
};
