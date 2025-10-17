import type { Express } from "express";
import { createLogger } from "../logger";
import crypto from "crypto";

const logger = createLogger('merchant-portal');

// In-memory storage for demo - in production this would be in database
const merchantApiKeys = new Map<string, {
  keyId: string;
  merchantId: string;
  storeName: string;
  storeUrl?: string;
  createdAt: Date;
  lastUsed?: Date;
}>();

const merchantAnalytics = new Map<string, {
  totalMints: number;
  thisMonth: number;
  avgTransactionValue: number;
  carbonSaved: number;
  costSavings: number;
  recentTransactions: Array<{
    id: string;
    amount: string;
    customer: string;
    time: string;
    status: 'minted' | 'pending' | 'failed';
  }>;
}>();

// Generate sample data for demo
const generateSampleAnalytics = (merchantId: string) => {
  return {
    totalMints: 1247 + Math.floor(Math.random() * 500),
    thisMonth: 342 + Math.floor(Math.random() * 100),
    avgTransactionValue: 28.50 + (Math.random() * 20),
    carbonSaved: 156 + Math.floor(Math.random() * 50),
    costSavings: 847.20 + (Math.random() * 200),
    recentTransactions: [
      {
        id: `TXN-${Date.now().toString(36).toUpperCase()}`,
        amount: `$${(Math.random() * 50 + 10).toFixed(2)}`,
        customer: `0x${Math.random().toString(16).substring(2, 8)}...${Math.random().toString(16).substring(2, 6)}`,
        time: '2 min ago',
        status: 'minted' as const
      },
      {
        id: `TXN-${(Date.now() - 300000).toString(36).toUpperCase()}`,
        amount: `$${(Math.random() * 50 + 10).toFixed(2)}`,
        customer: `0x${Math.random().toString(16).substring(2, 8)}...${Math.random().toString(16).substring(2, 6)}`,
        time: '5 min ago',
        status: 'minted' as const
      },
      {
        id: `TXN-${(Date.now() - 480000).toString(36).toUpperCase()}`,
        amount: `$${(Math.random() * 50 + 10).toFixed(2)}`,
        customer: `0x${Math.random().toString(16).substring(2, 8)}...${Math.random().toString(16).substring(2, 6)}`,
        time: '8 min ago',
        status: 'pending' as const
      }
    ]
  };
};

export function registerMerchantPortalRoutes(app: Express) {
  // Generate API key for merchant
  app.post('/api/merchant/generate-api-key', (req, res) => {
    try {
      const { storeName, storeUrl } = req.body;
      
      if (!storeName || storeName.trim().length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'Store name is required' 
        });
      }

      // Generate secure API key
      const keyId = `br_${crypto.randomBytes(16).toString('hex')}_${Date.now().toString(36)}`;
      const merchantId = crypto.randomBytes(8).toString('hex');

      // Store API key data
      merchantApiKeys.set(keyId, {
        keyId,
        merchantId,
        storeName: storeName.trim(),
        storeUrl: storeUrl?.trim(),
        createdAt: new Date()
      });

      // Generate initial analytics
      merchantAnalytics.set(merchantId, generateSampleAnalytics(merchantId));

      logger.info(`Generated API key for merchant: ${storeName}`, { merchantId, keyId });

      res.json({
        success: true,
        apiKey: keyId,
        merchantId
      });
    } catch (error) {
      logger.error('Error generating API key:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to generate API key' 
      });
    }
  });

  // Get merchant analytics
  app.get('/api/merchant/analytics/:merchantId', (req, res) => {
    try {
      const { merchantId } = req.params;
      
      const analytics = merchantAnalytics.get(merchantId);
      if (!analytics) {
        // Generate sample analytics if none exist
        const sampleAnalytics = generateSampleAnalytics(merchantId);
        merchantAnalytics.set(merchantId, sampleAnalytics);
        return res.json({ success: true, analytics: sampleAnalytics });
      }

      res.json({ success: true, analytics });
    } catch (error) {
      logger.error('Error fetching analytics:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch analytics' 
      });
    }
  });

  // POS webhook endpoint - this is where merchant POS systems send transaction data
  app.post('/api/pos-webhook', async (req, res) => {
    try {
      const apiKey = req.headers['x-api-key'] as string;
      
      if (!apiKey) {
        return res.status(401).json({ 
          success: false, 
          error: 'API key required in X-API-Key header' 
        });
      }

      const merchantData = merchantApiKeys.get(apiKey);
      if (!merchantData) {
        return res.status(401).json({ 
          success: false, 
          error: 'Invalid API key' 
        });
      }

      // Update last used timestamp
      merchantData.lastUsed = new Date();

      const {
        transactionId,
        amount,
        currency = 'USD',
        customerEmail,
        customerWallet,
        items = [],
        metadata = {}
      } = req.body;

      if (!transactionId || !amount) {
        return res.status(400).json({
          success: false,
          error: 'transactionId and amount are required'
        });
      }

      logger.info(`Received POS webhook from ${merchantData.storeName}`, {
        transactionId,
        amount,
        merchantId: merchantData.merchantId
      });

      const purchaseAmount = parseFloat(amount.toString());
      
      // Process receipt NFT minting
      const receiptData = {
        transactionId,
        merchantName: merchantData.storeName,
        amount: purchaseAmount,
        currency,
        items,
        timestamp: new Date().toISOString(),
        customerEmail,
        customerWallet,
        metadata: {
          ...metadata,
          merchantId: merchantData.merchantId,
          storeUrl: merchantData.storeUrl
        }
      };

      let loyaltyResult = null;
      
      // Process loyalty stamps if customer has a wallet address
      if (customerWallet) {
        try {
          const { loyaltyCardService } = await import('../services/loyaltyCardService');
          
          // Use a demo merchant address for now - in production this would be the actual merchant's blockchain address
          const merchantAddress = `0x${merchantData.merchantId.padStart(40, '0')}`;
          
          loyaltyResult = await loyaltyCardService.processPurchaseForLoyalty(
            customerWallet,
            merchantAddress,
            purchaseAmount,
            transactionId
          );
          
          logger.info('Loyalty stamps processed', {
            customerWallet,
            stampsAwarded: loyaltyResult.stampsAwarded,
            loyaltyTxHash: loyaltyResult.txHash
          });
          
        } catch (loyaltyError) {
          logger.warn('Failed to process loyalty stamps, continuing with receipt', {
            error: loyaltyError,
            customerWallet,
            transactionId
          });
          // Don't fail the entire transaction if loyalty processing fails
        }
      }

      // Update analytics
      const analytics = merchantAnalytics.get(merchantData.merchantId);
      if (analytics) {
        analytics.totalMints += 1;
        analytics.thisMonth += 1;
        analytics.avgTransactionValue = (analytics.avgTransactionValue + purchaseAmount) / 2;
        
        // Add to recent transactions
        analytics.recentTransactions.unshift({
          id: transactionId,
          amount: `$${purchaseAmount.toFixed(2)}`,
          customer: customerWallet || customerEmail || 'Anonymous',
          time: 'Just now',
          status: 'minted'
        });
        
        // Keep only last 10 transactions
        analytics.recentTransactions = analytics.recentTransactions.slice(0, 10);
      }

      const response = {
        success: true,
        message: 'Transaction processed and NFT receipt minted',
        receiptData,
        nftTokenId: `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
      };

      // Include loyalty information if processed
      if (loyaltyResult && loyaltyResult.stampsAwarded > 0) {
        response.loyalty = {
          stampsAwarded: loyaltyResult.stampsAwarded,
          cardId: loyaltyResult.cardId,
          txHash: loyaltyResult.txHash
        };
      }

      res.json(response);

    } catch (error) {
      logger.error('Error processing POS webhook:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to process transaction' 
      });
    }
  });

  // Test webhook endpoint
  app.post('/api/merchant/test-webhook', (req, res) => {
    try {
      const testTransaction = {
        transactionId: `TEST-${Date.now()}`,
        amount: 25.99,
        currency: 'USD',
        customerEmail: 'test@example.com',
        items: [
          { name: 'Test Product', quantity: 1, price: 25.99 }
        ],
        metadata: {
          testMode: true
        }
      };

      logger.info('Sending test webhook transaction', testTransaction);

      res.json({
        success: true,
        message: 'Test webhook sent successfully',
        testTransaction
      });
    } catch (error) {
      logger.error('Error sending test webhook:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to send test webhook' 
      });
    }
  });

  // Get merchant profile
  app.get('/api/merchant/profile/:merchantId', (req, res) => {
    try {
      const { merchantId } = req.params;
      
      // Find merchant by ID
      let merchantProfile = null;
      merchantApiKeys.forEach((data, keyId) => {
        if (data.merchantId === merchantId) {
          merchantProfile = {
            merchantId: data.merchantId,
            storeName: data.storeName,
            storeUrl: data.storeUrl,
            createdAt: data.createdAt,
            lastUsed: data.lastUsed,
            apiKey: keyId
          };
        }
      });

      if (!merchantProfile) {
        return res.status(404).json({
          success: false,
          error: 'Merchant not found'
        });
      }

      res.json({ success: true, profile: merchantProfile });
    } catch (error) {
      logger.error('Error fetching merchant profile:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch merchant profile' 
      });
    }
  });

  logger.info('Merchant portal routes registered successfully');
}