import { Router } from 'express';
import { storage } from '../storage-real';
import { z } from 'zod';
import { db } from '../db';
import { receipts, paymentTokens, merchants, merchantStores } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { squareService } from '../services/square-service';
import crypto from 'crypto';

const router = Router();

// Get all receipts for a user
router.get('/user/:userId', async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const receipts = await storage.getReceiptsByUserId(userId);
    
    res.json({
      success: true,
      receipts: receipts.map(receipt => ({
        id: receipt.id,
        merchantName: receipt.merchantName,
        date: receipt.date,
        total: receipt.total / 100, // Convert from cents
        subtotal: receipt.subtotal ? receipt.subtotal / 100 : 0,
        tax: receipt.tax ? receipt.tax / 100 : 0,
        items: receipt.items || [],
        category: receipt.category,
        tokenId: receipt.tokenId,
        txHash: receipt.txHash,
        isEncrypted: receipt.isEncrypted,
        createdAt: receipt.createdAt
      }))
    });
  } catch (error) {
    console.error('Error fetching user receipts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch receipts' 
    });
  }
});

// Get specific receipt by ID
router.get('/:id', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.id);
    
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }

    const receipt = await storage.getReceiptById(receiptId);
    
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json({
      success: true,
      receipt: {
        id: receipt.id,
        merchantName: receipt.merchantName,
        date: receipt.date,
        total: receipt.total / 100,
        subtotal: receipt.subtotal ? receipt.subtotal / 100 : 0,
        tax: receipt.tax ? receipt.tax / 100 : 0,
        items: receipt.items || [],
        category: receipt.category,
        tokenId: receipt.tokenId,
        txHash: receipt.txHash,
        isEncrypted: receipt.isEncrypted,
        createdAt: receipt.createdAt,
        updatedAt: receipt.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching receipt:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch receipt' 
    });
  }
});

// Create new receipt
const createReceiptSchema = z.object({
  userId: z.number(),
  merchantName: z.string().min(1),
  date: z.string().or(z.date()),
  total: z.number().min(0),
  subtotal: z.number().optional(),
  tax: z.number().optional(),
  items: z.array(z.object({
    name: z.string(),
    price: z.number(),
    quantity: z.number().default(1),
    category: z.string().optional()
  })).optional(),
  category: z.string().optional()
});

router.post('/', async (req, res) => {
  try {
    const validatedData = createReceiptSchema.parse(req.body);
    
    const receiptData = {
      ...validatedData,
      date: new Date(validatedData.date).toISOString(),
      total: Math.round(validatedData.total * 100), // Convert to cents
      subtotal: validatedData.subtotal ? Math.round(validatedData.subtotal * 100) : null,
      tax: validatedData.tax ? Math.round(validatedData.tax * 100) : null,
    };

    const receipt = await storage.createReceipt(receiptData);
    
    res.status(201).json({
      success: true,
      receipt: {
        id: receipt.id,
        merchantName: receipt.merchantName,
        date: receipt.date,
        total: receipt.total / 100,
        subtotal: receipt.subtotal ? receipt.subtotal / 100 : 0,
        tax: receipt.tax ? receipt.tax / 100 : 0,
        items: receipt.items || [],
        category: receipt.category,
        createdAt: receipt.createdAt
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    console.error('Error creating receipt:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create receipt' 
    });
  }
});

// Update receipt
router.put('/:id', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.id);
    
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }

    const updates = req.body;
    
    // Convert monetary amounts to cents if provided
    if (updates.total) updates.total = Math.round(updates.total * 100);
    if (updates.subtotal) updates.subtotal = Math.round(updates.subtotal * 100);
    if (updates.tax) updates.tax = Math.round(updates.tax * 100);

    const receipt = await storage.updateReceipt(receiptId, updates);
    
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json({
      success: true,
      receipt: {
        id: receipt.id,
        merchantName: receipt.merchantName,
        date: receipt.date,
        total: receipt.total / 100,
        subtotal: receipt.subtotal ? receipt.subtotal / 100 : 0,
        tax: receipt.tax ? receipt.tax / 100 : 0,
        items: receipt.items || [],
        category: receipt.category,
        tokenId: receipt.tokenId,
        txHash: receipt.txHash,
        isEncrypted: receipt.isEncrypted,
        updatedAt: receipt.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating receipt:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update receipt' 
    });
  }
});

// Delete receipt
router.delete('/:id', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.id);
    
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }

    const deleted = await storage.deleteReceipt(receiptId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    res.json({
      success: true,
      message: 'Receipt deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting receipt:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to delete receipt' 
    });
  }
});

// Discover unclaimed receipts by payment method
const claimDiscoverySchema = z.object({
  cardLast4: z.string().length(4, 'Card last 4 must be exactly 4 digits'),
  cardType: z.string().min(1, 'Card type is required'),
  userId: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional()
});

router.post('/claim', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const validatedData = claimDiscoverySchema.parse(req.body);
    const { cardLast4, cardType, startDate, endDate } = validatedData;

    // Generate the card hash using the same algorithm as minting
    const cardLast4Hash = squareService.generateCardLast4Hash(cardLast4, cardType);

    // Find matching payment tokens
    const matchingTokens = await db.select({
      receiptId: paymentTokens.receiptId,
      paymentMethod: paymentTokens.paymentMethod,
    })
      .from(paymentTokens)
      .where(
        and(
          eq(paymentTokens.cardLast4Hash, cardLast4Hash),
          eq(paymentTokens.paymentMethod, cardType.toUpperCase())
        )
      );

    if (matchingTokens.length === 0) {
      return res.json({
        success: true,
        receipts: [],
        message: 'No receipts found matching this payment method'
      });
    }

    const receiptIds = matchingTokens.map(t => t.receiptId);

    // Fetch unclaimed receipts with merchant and store info
    const unclaimedReceipts = await db.select({
      id: receipts.id,
      merchantId: receipts.merchantId,
      storeId: receipts.storeId,
      date: receipts.date,
      total: receipts.total,
      subtotal: receipts.subtotal,
      tax: receipts.tax,
      items: receipts.items,
      category: receipts.category,
      claimStatus: receipts.claimStatus,
      merchantName: merchants.name,
      merchantLogo: merchants.logoUrl,
      storeName: merchantStores.name,
      storeAddress: merchantStores.address,
      storeCity: merchantStores.city,
      storeState: merchantStores.state,
    })
      .from(receipts)
      .leftJoin(merchants, eq(receipts.merchantId, merchants.id))
      .leftJoin(merchantStores, eq(receipts.storeId, merchantStores.id))
      .where(
        and(
          eq(receipts.claimStatus, 'unclaimed'),
          inArray(receipts.id, receiptIds)
        )
      );

    // Format response
    const formattedReceipts = unclaimedReceipts.map(receipt => ({
      id: receipt.id,
      merchantName: receipt.merchantName || 'Unknown Merchant',
      merchantLogo: receipt.merchantLogo,
      storeName: receipt.storeName,
      storeLocation: receipt.storeAddress
        ? `${receipt.storeAddress}, ${receipt.storeCity || ''}, ${receipt.storeState || ''}`.trim()
        : null,
      date: receipt.date,
      total: receipt.total / 100, // Convert from cents
      subtotal: receipt.subtotal ? receipt.subtotal / 100 : null,
      tax: receipt.tax ? receipt.tax / 100 : null,
      items: receipt.items || [],
      category: receipt.category,
      claimStatus: receipt.claimStatus
    }));

    res.json({
      success: true,
      receipts: formattedReceipts,
      count: formattedReceipts.length
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    console.error('Error discovering receipts:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to discover receipts' 
    });
  }
});

// Claim a specific receipt
const claimReceiptSchema = z.object({
  userId: z.number()
});

router.post('/claim/:receiptId', async (req, res) => {
  try {
    if (!db) {
      return res.status(500).json({ error: 'Database not available' });
    }

    const receiptId = parseInt(req.params.receiptId);
    
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }

    const validatedData = claimReceiptSchema.parse(req.body);
    const { userId } = validatedData;

    // Check if receipt exists and is unclaimed
    const [existingReceipt] = await db.select()
      .from(receipts)
      .where(eq(receipts.id, receiptId))
      .limit(1);

    if (!existingReceipt) {
      return res.status(404).json({ 
        success: false,
        error: 'Receipt not found' 
      });
    }

    if (existingReceipt.claimStatus === 'claimed') {
      return res.status(400).json({ 
        success: false,
        error: 'Receipt has already been claimed' 
      });
    }

    // Update receipt to claimed status
    const [claimedReceipt] = await db.update(receipts)
      .set({
        claimStatus: 'claimed',
        claimedBy: userId,
        claimedAt: new Date(),
        userId: userId,
        updatedAt: new Date()
      })
      .where(eq(receipts.id, receiptId))
      .returning();

    // Fetch merchant info for response
    const [merchant] = await db.select()
      .from(merchants)
      .where(eq(merchants.id, claimedReceipt.merchantId))
      .limit(1);

    res.json({
      success: true,
      message: 'Receipt claimed successfully',
      receipt: {
        id: claimedReceipt.id,
        merchantName: merchant?.name || 'Unknown Merchant',
        date: claimedReceipt.date,
        total: claimedReceipt.total / 100,
        subtotal: claimedReceipt.subtotal ? claimedReceipt.subtotal / 100 : null,
        tax: claimedReceipt.tax ? claimedReceipt.tax / 100 : null,
        items: claimedReceipt.items || [],
        claimStatus: claimedReceipt.claimStatus,
        claimedAt: claimedReceipt.claimedAt
      }
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: error.errors
      });
    }
    
    console.error('Error claiming receipt:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to claim receipt' 
    });
  }
});

export default router;