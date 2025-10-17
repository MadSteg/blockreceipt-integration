/**
 * Merchant Plugin Routes
 * 
 * These routes handle the no-code merchant plugin integration for creating
 * NFT receipts during the e-commerce checkout process.
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { merchants, apiKeys } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = express.Router();

// Validate merchant API key
const validateApiKey = async (req: Request, res: Response, next: Function) => {
  const apiKey = req.body.apiKey || req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key is required' });
  }
  
  try {
    // Look up the API key in the database
    const [keyRecord] = await db.select()
      .from(apiKeys)
      .where(eq(apiKeys.key, apiKey));
    
    if (!keyRecord) {
      return res.status(401).json({ error: 'Invalid API key' });
    }
    
    // Check if key is active
    if (!keyRecord.isActive) {
      return res.status(401).json({ error: 'API key is not active' });
    }
    
    // Add merchantId to the request for use in route handlers
    req.body.authenticatedMerchantId = keyRecord.merchantId;
    next();
  } catch (error) {
    console.error('Error validating API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Create a new merchant API key
router.post('/api-keys', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'You must be logged in to create an API key' });
    }
    
    const schema = z.object({
      merchantId: z.number(),
      name: z.string().min(1).max(100),
    });
    
    const validationResult = schema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: validationResult.error.format() 
      });
    }
    
    const { merchantId, name } = validationResult.data;
    
    // Mock merchant verification since database is temporarily disabled
    const mockMerchant = { id: merchantId, name: 'Demo Merchant' };
    
    // Generate a unique API key
    const generatedKey = `br_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    
    // Mock API key creation
    const apiKey = {
      id: Math.floor(Math.random() * 1000),
      key: generatedKey,
      name,
      merchantId,
      isActive: true,
      createdAt: new Date(),
    };
    
    res.status(201).json({
      id: apiKey.id,
      key: apiKey.key,
      name: apiKey.name,
      createdAt: apiKey.createdAt,
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get merchant API keys
router.get('/api-keys', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'You must be logged in to view API keys' });
    }
    
    const merchantId = parseInt(req.query.merchantId as string);
    
    if (isNaN(merchantId)) {
      return res.status(400).json({ error: 'Valid merchantId is required' });
    }
    
    // Fetch the API keys for the merchant
    // Mock API keys list since database is temporarily disabled
    const keys = [
      {
        id: 1,
        name: 'Demo API Key',
        createdAt: new Date(),
        lastUsed: null,
        isActive: true,
      },
      {
        id: 2, 
        name: 'Test Integration Key',
        createdAt: new Date(),
        lastUsed: new Date(),
        isActive: true,
      }
    ];
    
    res.json(keys);
  } catch (error) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get merchant integration code snippet
router.get('/integration-code', async (req: Request, res: Response) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'You must be logged in to get integration code' });
    }
    
    const merchantId = parseInt(req.query.merchantId as string);
    const apiKey = req.query.apiKey as string;
    
    if (isNaN(merchantId) || !apiKey) {
      return res.status(400).json({ error: 'Valid merchantId and apiKey are required' });
    }
    
    // Generate an HTML/JS code snippet that merchants can embed
    const integrationCode = `
<!-- BlockReceipt.ai Plugin -->
<div id="blockreceiptai-container"></div>
<script src="https://cdn.blockreceiptai.com/plugin.js"></script>
<script>
  // Initialize the BlockReceipt.ai plugin
  document.addEventListener('DOMContentLoaded', function() {
    BlockReceiptAI.init({
      apiKey: "${apiKey}",
      merchantId: "${merchantId}",
      containerId: "blockreceiptai-container",
      theme: "auto", // light, dark, or auto
      onReceiptSelected: function(tier, price) {
        console.log('Selected tier:', tier, 'Price:', price);
        // Update your checkout total here
      },
      onComplete: function(receiptData) {
        console.log('Receipt created:', receiptData);
        // Handle completion - maybe redirect to a receipt view page
      }
    });
  });
</script>
<!-- End BlockReceipt.ai Plugin -->
    `.trim();
    
    res.json({ code: integrationCode });
  } catch (error) {
    console.error('Error generating integration code:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new receipt (used by merchant plugins)
router.post('/create-receipt', validateApiKey, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      tier: z.enum(["standard", "premium", "luxury"]),
      orderDetails: z.object({
        items: z.array(z.object({
          name: z.string(),
          price: z.number(),
          quantity: z.number(),
          sku: z.string().optional(),
        })),
        subtotal: z.number(),
        tax: z.number(),
        total: z.number(),
        orderId: z.string(),
      }),
      authenticatedMerchantId: z.number(), // Added by middleware
    });
    
    const validationResult = schema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation error', 
        details: validationResult.error.format() 
      });
    }
    
    const { tier, orderDetails, authenticatedMerchantId } = validationResult.data;
    
    // For the MVP, we'll create a simplified receipt without blockchain interaction
    // This will be replaced with real blockchain minting in production
    
    // In a real implementation, this would:
    // 1. Create a receipt in the database
    // 2. Queue a blockchain transaction to mint the NFT
    // 3. Return a receipt ID and transaction status
    
    // For now, we'll simulate success and return mock data
    const mockReceiptData = {
      id: Math.floor(Math.random() * 10000),
      tier,
      merchantId: authenticatedMerchantId,
      status: 'created',
      transactionHash: '0x' + Math.random().toString(16).substring(2, 42),
      createdAt: new Date().toISOString(),
      viewUrl: `/receipts/view/${Math.floor(Math.random() * 10000)}`,
    };
    
    // In production, we would update the API key's lastUsed timestamp
    
    // Return the receipt data to the client
    res.status(201).json(mockReceiptData);
  } catch (error) {
    console.error('Error creating receipt:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;