/**
 * Enterprise BlockReceipt Server
 * 
 * Full enterprise server with all features:
 * - Core webhook functionality
 * - Toast/Shopify POS integration
 * - Auto wallet creation
 * - Loyalty system
 * - Analytics dashboard
 * - Privacy data sharing
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import our enterprise routes
import enterprisePosRoutes from './routes/enterprise-pos.js';
import enterpriseAnalyticsRoutes from './routes/enterprise-analytics.js';
import fetchCompetitiveLoyaltyRoutes from './routes/fetch-competitive-loyalty.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/healthz', (req, res) => {
  res.json({ 
    ok: true, 
    ts: Date.now(),
    version: '1.0.0',
    features: [
      'Core NFT Minting',
      'Toast POS Integration', 
      'Shopify Integration',
      'Auto Wallet Creation',
      'Loyalty System',
      'Analytics Dashboard',
      'Privacy Data Sharing'
    ]
  });
});

// Register enterprise routes
app.use('/api/enterprise/pos', enterprisePosRoutes);
app.use('/api/enterprise/analytics', enterpriseAnalyticsRoutes);
app.use('/api/loyalty', fetchCompetitiveLoyaltyRoutes);

// Core webhook endpoint (from original webhook.mjs)
app.post('/pos/mint', async (req, res) => {
  try {
    // Import the original webhook logic
    const { mintReceipt } = await import('./webhook.mjs');
    await mintReceipt(req, res);
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('🚀 BlockReceipt Enterprise Server Started!');
  console.log(`📍 Server running on port ${PORT}`);
  console.log('🔗 Available endpoints:');
  console.log('   • POST /pos/mint - Core NFT minting');
  console.log('   • GET /healthz - Health check');
  console.log('   • /api/enterprise/pos/* - POS integrations');
  console.log('   • /api/enterprise/analytics/* - Analytics');
  console.log('   • /api/loyalty/* - Loyalty system');
  console.log('');
  console.log('✅ All enterprise features are ready!');
});
