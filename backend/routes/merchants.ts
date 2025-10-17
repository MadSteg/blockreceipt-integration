import express from 'express';
import { merchantMatchingService } from '../services/merchantMatchingService';

const router = express.Router();

/**
 * GET /api/merchants/directory
 * Get the entire merchant directory
 */
router.get('/directory', async (req, res) => {
  try {
    const merchants = merchantMatchingService.getAllMerchants();
    res.json(merchants);
  } catch (error) {
    console.error('Error fetching merchant directory:', error);
    res.status(500).json({ message: 'Failed to fetch merchant directory' });
  }
});

/**
 * GET /api/merchants/promo-templates
 * Get all promo templates
 */
router.get('/promo-templates', async (req, res) => {
  try {
    const templates = merchantMatchingService.getAllPromoTemplates();
    res.json(templates);
  } catch (error) {
    console.error('Error fetching promo templates:', error);
    res.status(500).json({ message: 'Failed to fetch promo templates' });
  }
});

/**
 * GET /api/merchants/promo-templates/:merchantId
 * Get promo templates for a specific merchant
 */
router.get('/promo-templates/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const templates = merchantMatchingService.getMerchantPromoTemplates(merchantId);
    
    if (templates.length === 0) {
      res.status(404).json({ message: `No promo templates found for merchant: ${merchantId}` });
      return;
    }
    
    res.json(templates);
  } catch (error) {
    console.error('Error fetching merchant promo templates:', error);
    res.status(500).json({ message: 'Failed to fetch merchant promo templates' });
  }
});

/**
 * POST /api/merchants/match
 * Match a merchant name to a merchant in the directory
 */
router.post('/match', async (req, res) => {
  try {
    const { merchantName } = req.body;
    
    if (!merchantName) {
      res.status(400).json({ message: 'Merchant name is required' });
      return;
    }
    
    const merchant = merchantMatchingService.matchMerchant(merchantName);
    
    if (!merchant) {
      res.status(404).json({ message: 'No matching merchant found' });
      return;
    }
    
    res.json(merchant);
  } catch (error) {
    console.error('Error matching merchant:', error);
    res.status(500).json({ message: 'Failed to match merchant' });
  }
});

/**
 * POST /api/merchants/find-promo
 * Find an applicable promo template for a receipt
 */
router.post('/find-promo', async (req, res) => {
  try {
    const { merchantId, receiptData } = req.body;
    
    if (!merchantId) {
      res.status(400).json({ message: 'Merchant ID is required' });
      return;
    }
    
    const promoTemplate = merchantMatchingService.findApplicablePromo(merchantId, receiptData);
    
    if (!promoTemplate) {
      res.status(404).json({ message: 'No applicable promo template found' });
      return;
    }
    
    res.json(promoTemplate);
  } catch (error) {
    console.error('Error finding promo template:', error);
    res.status(500).json({ message: 'Failed to find promo template' });
  }
});

/**
 * POST /api/merchants/process-receipt
 * Process a receipt and generate applicable coupons
 */
router.post('/process-receipt', async (req, res) => {
  try {
    const { receiptData } = req.body;
    
    if (!receiptData || !receiptData.merchantName) {
      res.status(400).json({ message: 'Receipt data with merchant name is required' });
      return;
    }
    
    const coupons = merchantMatchingService.processReceiptForCoupons(receiptData);
    
    res.json({ coupons });
  } catch (error) {
    console.error('Error processing receipt for coupons:', error);
    res.status(500).json({ message: 'Failed to process receipt for coupons' });
  }
});

/**
 * GET /api/merchants/verification-stats
 * Get merchant verification statistics
 */
router.get('/verification-stats', async (req, res) => {
  try {
    // Mock statistics for now - in production this would query the database
    const stats = {
      verified: 142,
      total: 187,
      byMerchant: {
        WALMART: { verified: 32, total: 41 },
        TARGET: { verified: 28, total: 35 },
        CVS: { verified: 18, total: 24 },
        BESTBUY: { verified: 16, total: 22 },
        // Other merchants...
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching verification stats:', error);
    res.status(500).json({ message: 'Failed to fetch verification stats' });
  }
});

/**
 * GET /api/merchants/:merchantId/stores
 * Get all store locations for a merchant with receipt counts
 */
router.get('/:merchantId/stores', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchantIdNum = parseInt(merchantId);

    if (isNaN(merchantIdNum)) {
      return res.status(400).json({ message: 'Invalid merchant ID' });
    }

    const { db } = await import('../db');
    const { merchantStores, receipts } = await import('@shared/schema');
    const { eq, sql } = await import('drizzle-orm');

    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    // Fetch stores with receipt counts
    const stores = await db
      .select({
        id: merchantStores.id,
        name: merchantStores.name,
        address: merchantStores.address,
        city: merchantStores.city,
        state: merchantStores.state,
        zip: merchantStores.zip,
        squareLocationId: merchantStores.squareLocationId,
        receiptCount: sql<number>`CAST(COUNT(${receipts.id}) AS INTEGER)`,
      })
      .from(merchantStores)
      .leftJoin(receipts, eq(merchantStores.id, receipts.storeId))
      .where(eq(merchantStores.merchantId, merchantIdNum))
      .groupBy(merchantStores.id);

    res.json({ stores });
  } catch (error) {
    console.error('Error fetching merchant stores:', error);
    res.status(500).json({ message: 'Failed to fetch merchant stores' });
  }
});

/**
 * GET /api/merchants/:merchantId/receipts
 * Get all receipts for a merchant with filtering and pagination
 */
router.get('/:merchantId/receipts', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const {
      storeId,
      claimStatus = 'all',
      startDate,
      endDate,
      limit = '50',
      offset = '0'
    } = req.query;

    const merchantIdNum = parseInt(merchantId);
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);

    if (isNaN(merchantIdNum)) {
      return res.status(400).json({ message: 'Invalid merchant ID' });
    }

    const { db } = await import('../db');
    const { receipts, merchantStores, users } = await import('@shared/schema');
    const { eq, and, gte, lte, sql, desc } = await import('drizzle-orm');

    if (!db) {
      return res.status(500).json({ message: 'Database not available' });
    }

    // Build conditions
    const conditions = [eq(receipts.merchantId, merchantIdNum)];

    if (storeId && storeId !== 'all') {
      conditions.push(eq(receipts.storeId, parseInt(storeId as string)));
    }

    if (claimStatus === 'claimed') {
      conditions.push(eq(receipts.claimStatus, 'claimed'));
    } else if (claimStatus === 'unclaimed') {
      conditions.push(eq(receipts.claimStatus, 'unclaimed'));
    }

    if (startDate) {
      conditions.push(gte(receipts.date, new Date(startDate as string)));
    }

    if (endDate) {
      conditions.push(lte(receipts.date, new Date(endDate as string)));
    }

    // Get receipts with joined data
    const receiptsList = await db
      .select({
        id: receipts.id,
        date: receipts.date,
        total: receipts.total,
        subtotal: receipts.subtotal,
        tax: receipts.tax,
        items: receipts.items,
        tokenId: receipts.tokenId,
        txHash: receipts.txHash,
        squareTransactionId: receipts.squareTransactionId,
        claimStatus: receipts.claimStatus,
        claimedAt: receipts.claimedAt,
        autoMinted: receipts.autoMinted,
        createdAt: receipts.createdAt,
        storeName: merchantStores.name,
        storeCity: merchantStores.city,
        storeState: merchantStores.state,
        customerEmail: users.email,
        customerName: users.fullName,
        claimedBy: receipts.claimedBy,
      })
      .from(receipts)
      .leftJoin(merchantStores, eq(receipts.storeId, merchantStores.id))
      .leftJoin(users, eq(receipts.claimedBy, users.id))
      .where(and(...conditions))
      .orderBy(desc(receipts.date))
      .limit(limitNum)
      .offset(offsetNum);

    // Get aggregated stats
    const statsResult = await db
      .select({
        totalReceipts: sql<number>`CAST(COUNT(*) AS INTEGER)`,
        claimedCount: sql<number>`CAST(SUM(CASE WHEN ${receipts.claimStatus} = 'claimed' THEN 1 ELSE 0 END) AS INTEGER)`,
        unclaimedCount: sql<number>`CAST(SUM(CASE WHEN ${receipts.claimStatus} = 'unclaimed' THEN 1 ELSE 0 END) AS INTEGER)`,
        totalRevenue: sql<number>`CAST(SUM(${receipts.total}) AS INTEGER)`,
      })
      .from(receipts)
      .where(and(...conditions));

    const stats = statsResult[0] || {
      totalReceipts: 0,
      claimedCount: 0,
      unclaimedCount: 0,
      totalRevenue: 0,
    };

    res.json({
      receipts: receiptsList,
      stats: {
        totalReceipts: stats.totalReceipts,
        claimed: stats.claimedCount,
        unclaimed: stats.unclaimedCount,
        totalRevenue: stats.totalRevenue,
      },
      pagination: {
        limit: limitNum,
        offset: offsetNum,
        total: stats.totalReceipts,
      },
    });
  } catch (error) {
    console.error('Error fetching merchant receipts:', error);
    res.status(500).json({ message: 'Failed to fetch merchant receipts' });
  }
});

export const merchantRoutes = router;