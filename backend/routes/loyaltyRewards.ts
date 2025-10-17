import { Router } from 'express';
import { z } from 'zod';
import { LoyaltyRewardsService } from '../services/loyaltyRewardsService';
import { db } from '../db';
import { merchantRewardPools, merchants, nftPool, loyaltyPoints } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

const router = Router();

/**
 * GET /api/loyalty/points/:userId/:merchantId
 * Get user's loyalty points balance for a specific merchant
 */
router.get('/points/:userId/:merchantId', async (req, res) => {
  try {
    const { userId, merchantId } = req.params;
    
    const balance = await LoyaltyRewardsService.getUserPointsBalance(
      parseInt(userId),
      parseInt(merchantId)
    );
    
    res.json({
      success: true,
      data: {
        userId: parseInt(userId),
        merchantId: parseInt(merchantId),
        pointsBalance: balance
      }
    });
  } catch (error) {
    console.error('Error fetching points balance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch points balance'
    });
  }
});

/**
 * GET /api/loyalty/history/:userId
 * Get user's reward history across all merchants
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { merchantId } = req.query;
    
    const history = await LoyaltyRewardsService.getUserRewardHistory(
      parseInt(userId),
      merchantId ? parseInt(merchantId as string) : undefined
    );
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('Error fetching reward history:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reward history'
    });
  }
});

/**
 * POST /api/loyalty/redeem
 * Redeem loyalty points for rewards
 */
router.post('/redeem', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.number(),
      merchantId: z.number(),
      pointsToRedeem: z.number().min(1),
      redemptionType: z.string().default('discount')
    });
    
    const data = schema.parse(req.body);
    
    const result = await LoyaltyRewardsService.redeemPoints(
      data.userId,
      data.merchantId,
      data.pointsToRedeem,
      data.redemptionType
    );
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: {
          discountAmount: result.discountAmount,
          pointsRedeemed: data.pointsToRedeem
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error redeeming points:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to redeem points'
    });
  }
});

/**
 * GET /api/loyalty/merchant/:merchantId/pool
 * Get merchant's reward pool information
 */
router.get('/merchant/:merchantId/pool', async (req, res) => {
  try {
    const { merchantId } = req.params;
    
    const [pool] = await db
      .select()
      .from(merchantRewardPools)
      .where(
        and(
          eq(merchantRewardPools.merchantId, parseInt(merchantId)),
          eq(merchantRewardPools.isActive, true)
        )
      );
    
    if (!pool) {
      return res.json({
        success: true,
        data: null,
        message: 'No active reward pool found'
      });
    }
    
    // Get NFTs in the pool
    const nfts = await db
      .select()
      .from(nftPool)
      .where(
        and(
          eq(nftPool.merchantId, parseInt(merchantId)),
          eq(nftPool.enabled, true)
        )
      );
    
    res.json({
      success: true,
      data: {
        pool,
        availableNFTs: nfts.length,
        nftsByTier: {
          basic: nfts.filter(n => n.tier === 'basic').length,
          premium: nfts.filter(n => n.tier === 'premium').length,
          luxury: nfts.filter(n => n.tier === 'luxury').length
        }
      }
    });
  } catch (error) {
    console.error('Error fetching merchant pool:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch merchant reward pool'
    });
  }
});

/**
 * POST /api/loyalty/merchant/pool
 * Create a new merchant reward pool
 */
router.post('/merchant/pool', async (req, res) => {
  try {
    const schema = z.object({
      merchantId: z.number(),
      name: z.string().min(1),
      description: z.string().optional(),
      totalFunded: z.number().min(0), // In cents
      ourCommissionRate: z.number().min(0).max(100).default(10),
      endDate: z.string().optional()
    });
    
    const data = schema.parse(req.body);
    
    const [newPool] = await db.insert(merchantRewardPools).values({
      merchantId: data.merchantId,
      name: data.name,
      description: data.description,
      totalFunded: data.totalFunded,
      ourCommissionRate: data.ourCommissionRate,
      endDate: data.endDate ? new Date(data.endDate) : undefined
    }).returning();
    
    res.json({
      success: true,
      message: 'Reward pool created successfully',
      data: newPool
    });
  } catch (error) {
    console.error('Error creating reward pool:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create reward pool'
    });
  }
});

/**
 * POST /api/loyalty/merchant/nft
 * Add NFT to merchant's pool
 */
router.post('/merchant/nft', async (req, res) => {
  try {
    const schema = z.object({
      merchantId: z.number(),
      nftId: z.string(),
      name: z.string().min(1),
      image: z.string().url(),
      description: z.string(),
      tier: z.enum(['basic', 'premium', 'luxury']),
      metadataUri: z.string(),
      categories: z.array(z.string())
    });
    
    const data = schema.parse(req.body);
    
    const [newNFT] = await db.insert(nftPool).values(data).returning();
    
    res.json({
      success: true,
      message: 'NFT added to merchant pool successfully',
      data: newNFT
    });
  } catch (error) {
    console.error('Error adding NFT to pool:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to add NFT to pool'
    });
  }
});

export default router;