/**
 * Fetch-Competitive Loyalty Routes
 * 
 * API endpoints for the optimized loyalty system
 * Provides Fetch-like experience with seamless rewards
 */

import express from 'express';
import { z } from 'zod';
import { FetchCompetitiveLoyaltyService } from '../services/fetchCompetitiveLoyaltyService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Get User Loyalty Profile
 * GET /api/loyalty/profile/:userId
 */
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await FetchCompetitiveLoyaltyService.getUserLoyaltyProfile(
      parseInt(userId)
    );

    res.json({
      success: true,
      data: profile
    });

  } catch (error) {
    logger.error(`[Loyalty] Error getting user profile: ${error}`);
    res.status(500).json({ error: 'Failed to get user profile' });
  }
});

/**
 * Process Receipt Rewards
 * POST /api/loyalty/process-receipt
 */
router.post('/process-receipt', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.number(),
      merchantId: z.number(),
      amount: z.number(),
      items: z.array(z.object({
        name: z.string(),
        price: z.number(),
        category: z.string().optional(),
        tags: z.array(z.string()).optional()
      })),
      timestamp: z.string().transform(str => new Date(str))
    });

    const receiptData = schema.parse(req.body);

    const result = await FetchCompetitiveLoyaltyService.processReceiptRewards(
      receiptData.userId,
      receiptData.merchantId,
      receiptData
    );

    res.json(result);

  } catch (error) {
    logger.error(`[Loyalty] Error processing receipt rewards: ${error}`);
    res.status(500).json({ error: 'Failed to process receipt rewards' });
  }
});

/**
 * Redeem Points
 * POST /api/loyalty/redeem
 */
router.post('/redeem', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.number(),
      rewardId: z.string(),
      pointsToRedeem: z.number()
    });

    const redeemData = schema.parse(req.body);

    const result = await FetchCompetitiveLoyaltyService.redeemPoints(
      redeemData.userId,
      redeemData.rewardId,
      redeemData.pointsToRedeem
    );

    res.json(result);

  } catch (error) {
    logger.error(`[Loyalty] Error redeeming points: ${error}`);
    res.status(500).json({ error: 'Failed to redeem points' });
  }
});

/**
 * Get Available Rewards
 * GET /api/loyalty/rewards/:userId
 */
router.get('/rewards/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const rewards = await FetchCompetitiveLoyaltyService.getAvailableRewards(
      parseInt(userId)
    );

    res.json({
      success: true,
      data: rewards,
      count: rewards.length
    });

  } catch (error) {
    logger.error(`[Loyalty] Error getting available rewards: ${error}`);
    res.status(500).json({ error: 'Failed to get available rewards' });
  }
});

/**
 * Get User Dashboard
 * GET /api/loyalty/dashboard/:userId
 */
router.get('/dashboard/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    // Get user profile
    const profile = await FetchCompetitiveLoyaltyService.getUserLoyaltyProfile(
      parseInt(userId)
    );

    // Get available rewards
    const rewards = await FetchCompetitiveLoyaltyService.getAvailableRewards(
      parseInt(userId)
    );

    // Get recent activity (simplified)
    const recentActivity = [
      {
        type: 'points_earned',
        description: 'Earned 50 points from coffee purchase',
        timestamp: new Date(),
        value: 50
      },
      {
        type: 'reward_available',
        description: 'New gift card available!',
        timestamp: new Date(),
        value: 0
      }
    ];

    res.json({
      success: true,
      data: {
        profile,
        rewards,
        recentActivity,
        summary: {
          totalPoints: profile.totalPoints,
          availablePoints: profile.availablePoints,
          tier: profile.tier,
          nextTierProgress: profile.nextTierProgress,
          totalReceipts: profile.totalReceipts,
          totalSpent: profile.totalSpent
        }
      }
    });

  } catch (error) {
    logger.error(`[Loyalty] Error getting user dashboard: ${error}`);
    res.status(500).json({ error: 'Failed to get user dashboard' });
  }
});

/**
 * Get Tier Benefits
 * GET /api/loyalty/tier-benefits/:tier
 */
router.get('/tier-benefits/:tier', async (req, res) => {
  try {
    const { tier } = req.params;

    const tierBenefits = {
      bronze: {
        name: 'Bronze',
        pointsRequired: 0,
        benefits: [
          'Earn 1 point per dollar spent',
          'Access to basic rewards',
          'Email support'
        ],
        multipliers: {
          points: 1.0,
          nft: 0.05
        }
      },
      silver: {
        name: 'Silver',
        pointsRequired: 1000,
        benefits: [
          'Earn 1.2 points per dollar spent',
          'Access to premium rewards',
          'Priority support',
          'Exclusive offers'
        ],
        multipliers: {
          points: 1.2,
          nft: 0.08
        }
      },
      gold: {
        name: 'Gold',
        pointsRequired: 5000,
        benefits: [
          'Earn 1.5 points per dollar spent',
          'Access to luxury rewards',
          'VIP support',
          'Early access to new features',
          'Birthday bonus'
        ],
        multipliers: {
          points: 1.5,
          nft: 0.12
        }
      },
      platinum: {
        name: 'Platinum',
        pointsRequired: 10000,
        benefits: [
          'Earn 2 points per dollar spent',
          'Access to all rewards',
          'Dedicated account manager',
          'Exclusive events',
          'Custom rewards'
        ],
        multipliers: {
          points: 2.0,
          nft: 0.20
        }
      }
    };

    const benefits = tierBenefits[tier as keyof typeof tierBenefits];

    if (!benefits) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    res.json({
      success: true,
      data: benefits
    });

  } catch (error) {
    logger.error(`[Loyalty] Error getting tier benefits: ${error}`);
    res.status(500).json({ error: 'Failed to get tier benefits' });
  }
});

/**
 * Get Merchant Rewards
 * GET /api/loyalty/merchant/:merchantId/rewards
 */
router.get('/merchant/:merchantId/rewards', async (req, res) => {
  try {
    const { merchantId } = req.params;

    // Placeholder for merchant-specific rewards
    const merchantRewards = {
      merchantId: parseInt(merchantId),
      merchantName: 'Sample Merchant',
      basePointsPerDollar: 1,
      bonusMultipliers: [
        {
          category: 'coffee',
          multiplier: 2.0,
          description: 'Double points on coffee'
        },
        {
          category: 'organic',
          multiplier: 1.5,
          description: '50% bonus on organic items'
        }
      ],
      specialOffers: [
        {
          id: 'offer_1',
          name: 'Weekend Special',
          description: 'Extra 25 points on weekend purchases',
          pointsRequired: 0,
          rewardValue: 25,
          expirationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isActive: true
        }
      ],
      giftCards: [
        {
          id: 'gc_1',
          name: 'Merchant Gift Card',
          value: 10,
          pointsRequired: 1000,
          isActive: true
        }
      ]
    };

    res.json({
      success: true,
      data: merchantRewards
    });

  } catch (error) {
    logger.error(`[Loyalty] Error getting merchant rewards: ${error}`);
    res.status(500).json({ error: 'Failed to get merchant rewards' });
  }
});

/**
 * Get Leaderboard
 * GET /api/loyalty/leaderboard
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    // Placeholder for leaderboard data
    const leaderboard = [
      {
        rank: 1,
        userId: 1,
        phoneNumber: '+1234567890',
        totalPoints: 15000,
        tier: 'platinum',
        receipts: 45,
        spent: 2500
      },
      {
        rank: 2,
        userId: 2,
        phoneNumber: '+1234567891',
        totalPoints: 12000,
        tier: 'gold',
        receipts: 38,
        spent: 2000
      },
      {
        rank: 3,
        userId: 3,
        phoneNumber: '+1234567892',
        totalPoints: 8500,
        tier: 'gold',
        receipts: 32,
        spent: 1500
      }
    ];

    res.json({
      success: true,
      data: leaderboard.slice(0, parseInt(limit as string)),
      count: leaderboard.length
    });

  } catch (error) {
    logger.error(`[Loyalty] Error getting leaderboard: ${error}`);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

/**
 * Get User Activity
 * GET /api/loyalty/activity/:userId
 */
router.get('/activity/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    // Placeholder for user activity
    const activity = [
      {
        id: 'activity_1',
        type: 'points_earned',
        description: 'Earned 50 points from coffee purchase',
        timestamp: new Date(),
        value: 50,
        merchant: 'Coffee Shop'
      },
      {
        id: 'activity_2',
        type: 'reward_earned',
        description: 'Earned Starbucks gift card',
        timestamp: new Date(),
        value: 10,
        merchant: 'BlockReceipt'
      },
      {
        id: 'activity_3',
        type: 'tier_upgrade',
        description: 'Upgraded to Silver tier',
        timestamp: new Date(),
        value: 0,
        merchant: 'BlockReceipt'
      }
    ];

    res.json({
      success: true,
      data: activity.slice(0, parseInt(limit as string)),
      count: activity.length
    });

  } catch (error) {
    logger.error(`[Loyalty] Error getting user activity: ${error}`);
    res.status(500).json({ error: 'Failed to get user activity' });
  }
});

/**
 * Get Reward Categories
 * GET /api/loyalty/categories
 */
router.get('/categories', async (req, res) => {
  try {
    const categories = [
      {
        id: 'gift_cards',
        name: 'Gift Cards',
        description: 'Redeem points for gift cards',
        icon: 'gift',
        color: '#4CAF50'
      },
      {
        id: 'discounts',
        name: 'Discounts',
        description: 'Get discounts on future purchases',
        icon: 'percent',
        color: '#FF9800'
      },
      {
        id: 'nfts',
        name: 'NFTs',
        description: 'Collect exclusive digital assets',
        icon: 'image',
        color: '#9C27B0'
      },
      {
        id: 'experiences',
        name: 'Experiences',
        description: 'Special experiences and events',
        icon: 'star',
        color: '#F44336'
      }
    ];

    res.json({
      success: true,
      data: categories
    });

  } catch (error) {
    logger.error(`[Loyalty] Error getting categories: ${error}`);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

export default router;
