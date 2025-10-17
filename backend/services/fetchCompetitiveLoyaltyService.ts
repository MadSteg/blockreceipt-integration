/**
 * Fetch-Competitive Loyalty Service
 * 
 * Optimized loyalty system to compete with Fetch and other receipt apps
 * Focuses on seamless user experience and valuable rewards
 */

import { logger } from '../utils/logger';
import { db } from '../db';
import { userReceipts, loyaltyPoints, rewardClaims, merchants } from '@shared/schema';
import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';

export interface FetchLikeReward {
  id: string;
  type: 'points' | 'gift_card' | 'nft' | 'discount';
  value: number;
  description: string;
  merchant: string;
  category: string;
  expirationDate?: Date;
  isRedeemed: boolean;
  redeemedAt?: Date;
}

export interface UserLoyaltyProfile {
  userId: number;
  phoneNumber: string;
  totalPoints: number;
  availablePoints: number;
  redeemedPoints: number;
  totalReceipts: number;
  totalSpent: number;
  averageOrderValue: number;
  favoriteMerchants: Array<{
    merchantId: number;
    merchantName: string;
    receipts: number;
    spent: number;
    points: number;
  }>;
  recentRewards: FetchLikeReward[];
  upcomingExpirations: FetchLikeReward[];
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  nextTierProgress: number;
}

export interface MerchantRewardProgram {
  merchantId: number;
  merchantName: string;
  basePointsPerDollar: number;
  bonusMultipliers: Array<{
    category: string;
    multiplier: number;
    description: string;
  }>;
  specialOffers: Array<{
    id: string;
    name: string;
    description: string;
    pointsRequired: number;
    rewardValue: number;
    expirationDate: Date;
    isActive: boolean;
  }>;
  giftCards: Array<{
    id: string;
    name: string;
    value: number;
    pointsRequired: number;
    isActive: boolean;
  }>;
}

export class FetchCompetitiveLoyaltyService {
  
  /**
   * Get user's complete loyalty profile
   * This is the main function that powers the user experience
   */
  static async getUserLoyaltyProfile(userId: number): Promise<UserLoyaltyProfile> {
    try {
      logger.info(`[Fetch Loyalty] Getting loyalty profile for user ${userId}`);

      // Get user's basic stats
      const [userStats] = await db
        .select({
          totalPoints: sql<number>`COALESCE(SUM(${loyaltyPoints.points}), 0)`,
          redeemedPoints: sql<number>`COALESCE(SUM(CASE WHEN ${loyaltyPoints.isRedeemed} = true THEN ${loyaltyPoints.points} ELSE 0 END), 0)`,
          totalReceipts: sql<number>`COUNT(DISTINCT ${userReceipts.id})`,
          totalSpent: sql<number>`COALESCE(SUM(${userReceipts.amount}), 0)`,
          averageOrderValue: sql<number>`COALESCE(AVG(${userReceipts.amount}), 0)`
        })
        .from(loyaltyPoints)
        .leftJoin(userReceipts, eq(loyaltyPoints.userId, userReceipts.userId))
        .where(eq(loyaltyPoints.userId, userId));

      // Get favorite merchants
      const favoriteMerchants = await this.getFavoriteMerchants(userId);

      // Get recent rewards
      const recentRewards = await this.getRecentRewards(userId);

      // Get upcoming expirations
      const upcomingExpirations = await this.getUpcomingExpirations(userId);

      // Calculate tier and progress
      const { tier, nextTierProgress } = this.calculateUserTier(userStats.totalPoints);

      const profile: UserLoyaltyProfile = {
        userId,
        phoneNumber: '', // Would come from user profile
        totalPoints: userStats.totalPoints,
        availablePoints: userStats.totalPoints - userStats.redeemedPoints,
        redeemedPoints: userStats.redeemedPoints,
        totalReceipts: userStats.totalReceipts,
        totalSpent: userStats.totalSpent,
        averageOrderValue: userStats.averageOrderValue,
        favoriteMerchants,
        recentRewards,
        upcomingExpirations,
        tier,
        nextTierProgress
      };

      logger.info(`[Fetch Loyalty] Loyalty profile generated for user ${userId}`);

      return profile;

    } catch (error) {
      logger.error(`[Fetch Loyalty] Error getting loyalty profile: ${error}`);
      throw new Error(`Failed to get loyalty profile: ${error.message}`);
    }
  }

  /**
   * Process a receipt and award points (Fetch-like experience)
   */
  static async processReceiptRewards(
    userId: number,
    merchantId: number,
    receiptData: {
      amount: number;
      items: Array<{
        name: string;
        price: number;
        category?: string;
        tags?: string[];
      }>;
      timestamp: Date;
    }
  ): Promise<{
    success: boolean;
    pointsAwarded: number;
    rewards: FetchLikeReward[];
    message: string;
  }> {
    try {
      logger.info(`[Fetch Loyalty] Processing receipt rewards for user ${userId}`);

      // Calculate base points
      const basePoints = Math.floor(receiptData.amount);
      
      // Calculate bonus points based on items
      const bonusPoints = await this.calculateBonusPoints(merchantId, receiptData.items);
      
      // Calculate category bonuses
      const categoryBonuses = await this.calculateCategoryBonuses(receiptData.items);
      
      // Calculate special offers
      const specialOffers = await this.calculateSpecialOffers(userId, merchantId, receiptData);

      const totalPoints = basePoints + bonusPoints + categoryBonuses + specialOffers.totalPoints;

      // Award points
      await this.awardPoints(userId, merchantId, totalPoints, receiptData.timestamp);

      // Generate rewards
      const rewards = await this.generateRewards(userId, merchantId, totalPoints, specialOffers);

      logger.info(`[Fetch Loyalty] Awarded ${totalPoints} points to user ${userId}`);

      return {
        success: true,
        pointsAwarded: totalPoints,
        rewards,
        message: `Earned ${totalPoints} points! ${rewards.length > 0 ? `Plus ${rewards.length} special rewards!` : ''}`
      };

    } catch (error) {
      logger.error(`[Fetch Loyalty] Error processing receipt rewards: ${error}`);
      return {
        success: false,
        pointsAwarded: 0,
        rewards: [],
        message: `Failed to process rewards: ${error.message}`
      };
    }
  }

  /**
   * Redeem points for gift cards or other rewards
   */
  static async redeemPoints(
    userId: number,
    rewardId: string,
    pointsToRedeem: number
  ): Promise<{
    success: boolean;
    message: string;
    reward?: FetchLikeReward;
  }> {
    try {
      logger.info(`[Fetch Loyalty] User ${userId} redeeming ${pointsToRedeem} points for reward ${rewardId}`);

      // Check if user has enough points
      const userProfile = await this.getUserLoyaltyProfile(userId);
      
      if (userProfile.availablePoints < pointsToRedeem) {
        return {
          success: false,
          message: 'Insufficient points balance'
        };
      }

      // Get reward details
      const reward = await this.getRewardDetails(rewardId);
      
      if (!reward) {
        return {
          success: false,
          message: 'Reward not found'
        };
      }

      if (reward.pointsRequired > pointsToRedeem) {
        return {
          success: false,
          message: 'Not enough points for this reward'
        };
      }

      // Redeem the reward
      await this.markRewardAsRedeemed(userId, rewardId, pointsToRedeem);

      logger.info(`[Fetch Loyalty] User ${userId} successfully redeemed reward ${rewardId}`);

      return {
        success: true,
        message: 'Reward redeemed successfully!',
        reward
      };

    } catch (error) {
      logger.error(`[Fetch Loyalty] Error redeeming points: ${error}`);
      return {
        success: false,
        message: `Failed to redeem reward: ${error.message}`
      };
    }
  }

  /**
   * Get available rewards for a user
   */
  static async getAvailableRewards(userId: number): Promise<FetchLikeReward[]> {
    try {
      const userProfile = await this.getUserLoyaltyProfile(userId);
      
      // Get gift cards available for redemption
      const giftCards = await this.getAvailableGiftCards(userProfile.availablePoints);
      
      // Get special offers
      const specialOffers = await this.getSpecialOffers(userId);
      
      // Get NFT rewards
      const nftRewards = await this.getNFTRewards(userId);

      return [...giftCards, ...specialOffers, ...nftRewards];

    } catch (error) {
      logger.error(`[Fetch Loyalty] Error getting available rewards: ${error}`);
      return [];
    }
  }

  /**
   * Get favorite merchants for a user
   */
  private static async getFavoriteMerchants(userId: number): Promise<Array<{
    merchantId: number;
    merchantName: string;
    receipts: number;
    spent: number;
    points: number;
  }>> {
    try {
      const merchants = await db
        .select({
          merchantId: userReceipts.merchantId,
          merchantName: sql<string>`COALESCE(${merchants.name}, 'Unknown Merchant')`,
          receipts: count(userReceipts.id),
          spent: sql<number>`COALESCE(SUM(${userReceipts.amount}), 0)`,
          points: sql<number>`COALESCE(SUM(${loyaltyPoints.points}), 0)`
        })
        .from(userReceipts)
        .leftJoin(merchants, eq(userReceipts.merchantId, merchants.id))
        .leftJoin(loyaltyPoints, eq(userReceipts.userId, loyaltyPoints.userId))
        .where(eq(userReceipts.userId, userId))
        .groupBy(userReceipts.merchantId, merchants.name)
        .orderBy(desc(sql`COALESCE(SUM(${userReceipts.amount}), 0)`))
        .limit(5);

      return merchants;

    } catch (error) {
      logger.error(`[Fetch Loyalty] Error getting favorite merchants: ${error}`);
      return [];
    }
  }

  /**
   * Get recent rewards for a user
   */
  private static async getRecentRewards(userId: number): Promise<FetchLikeReward[]> {
    try {
      // Get recent reward claims
      const recentClaims = await db
        .select()
        .from(rewardClaims)
        .where(eq(rewardClaims.userId, userId))
        .orderBy(desc(rewardClaims.claimedAt))
        .limit(10);

      return recentClaims.map(claim => ({
        id: claim.id.toString(),
        type: claim.rewardType as 'points' | 'gift_card' | 'nft' | 'discount',
        value: claim.pointsAwarded || 0,
        description: `Earned ${claim.pointsAwarded} points`,
        merchant: 'BlockReceipt',
        category: 'loyalty',
        isRedeemed: claim.isAutoClaimed,
        redeemedAt: claim.claimedAt
      }));

    } catch (error) {
      logger.error(`[Fetch Loyalty] Error getting recent rewards: ${error}`);
      return [];
    }
  }

  /**
   * Get upcoming expirations
   */
  private static async getUpcomingExpirations(userId: number): Promise<FetchLikeReward[]> {
    try {
      // Get points that will expire soon
      const expiringPoints = await db
        .select()
        .from(loyaltyPoints)
        .where(
          and(
            eq(loyaltyPoints.userId, userId),
            eq(loyaltyPoints.isRedeemed, false),
            lte(loyaltyPoints.expiresAt, new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)) // 30 days
          )
        );

      return expiringPoints.map(point => ({
        id: point.id.toString(),
        type: 'points',
        value: point.points,
        description: `${point.points} points expiring soon`,
        merchant: 'BlockReceipt',
        category: 'loyalty',
        expirationDate: point.expiresAt,
        isRedeemed: false
      }));

    } catch (error) {
      logger.error(`[Fetch Loyalty] Error getting upcoming expirations: ${error}`);
      return [];
    }
  }

  /**
   * Calculate user tier based on points
   */
  private static calculateUserTier(totalPoints: number): {
    tier: 'bronze' | 'silver' | 'gold' | 'platinum';
    nextTierProgress: number;
  } {
    if (totalPoints >= 10000) {
      return { tier: 'platinum', nextTierProgress: 100 };
    } else if (totalPoints >= 5000) {
      return { tier: 'gold', nextTierProgress: ((totalPoints - 5000) / 5000) * 100 };
    } else if (totalPoints >= 1000) {
      return { tier: 'silver', nextTierProgress: ((totalPoints - 1000) / 4000) * 100 };
    } else {
      return { tier: 'bronze', nextTierProgress: (totalPoints / 1000) * 100 };
    }
  }

  /**
   * Calculate bonus points based on items
   */
  private static async calculateBonusPoints(
    merchantId: number,
    items: Array<{ name: string; price: number; category?: string; tags?: string[] }>
  ): Promise<number> {
    let bonusPoints = 0;

    // Category bonuses
    items.forEach(item => {
      if (item.category === 'organic' || item.tags?.includes('organic')) {
        bonusPoints += 5; // Organic bonus
      }
      if (item.category === 'local' || item.tags?.includes('local')) {
        bonusPoints += 3; // Local bonus
      }
      if (item.tags?.includes('sustainable')) {
        bonusPoints += 2; // Sustainability bonus
      }
    });

    return bonusPoints;
  }

  /**
   * Calculate category bonuses
   */
  private static async calculateCategoryBonuses(
    items: Array<{ name: string; price: number; category?: string; tags?: string[] }>
  ): Promise<number> {
    let categoryBonuses = 0;

    // Popular categories get bonuses
    const categoryBonusesMap: { [key: string]: number } = {
      'coffee': 2,
      'food': 1,
      'clothing': 3,
      'electronics': 5,
      'books': 1,
      'beauty': 2,
      'health': 2
    };

    items.forEach(item => {
      if (item.category && categoryBonusesMap[item.category.toLowerCase()]) {
        categoryBonuses += categoryBonusesMap[item.category.toLowerCase()];
      }
    });

    return categoryBonuses;
  }

  /**
   * Calculate special offers
   */
  private static async calculateSpecialOffers(
    userId: number,
    merchantId: number,
    receiptData: any
  ): Promise<{ totalPoints: number; offers: string[] }> {
    let totalPoints = 0;
    const offers: string[] = [];

    // First-time customer bonus
    const userReceipts = await db
      .select()
      .from(userReceipts)
      .where(eq(userReceipts.userId, userId));

    if (userReceipts.length === 1) {
      totalPoints += 100;
      offers.push('First-time customer bonus: 100 points');
    }

    // Weekend bonus
    const dayOfWeek = receiptData.timestamp.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      totalPoints += 25;
      offers.push('Weekend bonus: 25 points');
    }

    // High-value purchase bonus
    if (receiptData.amount >= 100) {
      totalPoints += 50;
      offers.push('High-value purchase bonus: 50 points');
    }

    return { totalPoints, offers };
  }

  /**
   * Award points to user
   */
  private static async awardPoints(
    userId: number,
    merchantId: number,
    points: number,
    timestamp: Date
  ): Promise<void> {
    try {
      // Set points to expire in 1 year
      const expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);

      await db.insert(loyaltyPoints).values({
        userId,
        merchantId,
        points,
        earnedFromReceiptId: null, // Would link to receipt
        expiresAt,
        isRedeemed: false
      });

    } catch (error) {
      logger.error(`[Fetch Loyalty] Error awarding points: ${error}`);
      throw new Error(`Failed to award points: ${error.message}`);
    }
  }

  /**
   * Generate rewards based on points earned
   */
  private static async generateRewards(
    userId: number,
    merchantId: number,
    points: number,
    specialOffers: { totalPoints: number; offers: string[] }
  ): Promise<FetchLikeReward[]> {
    const rewards: FetchLikeReward[] = [];

    // Base points reward
    rewards.push({
      id: `points_${Date.now()}`,
      type: 'points',
      value: points,
      description: `Earned ${points} points`,
      merchant: 'BlockReceipt',
      category: 'loyalty',
      isRedeemed: false
    });

    // Special offers
    specialOffers.offers.forEach((offer, index) => {
      rewards.push({
        id: `offer_${Date.now()}_${index}`,
        type: 'points',
        value: 0,
        description: offer,
        merchant: 'BlockReceipt',
        category: 'bonus',
        isRedeemed: false
      });
    });

    return rewards;
  }

  /**
   * Get available gift cards
   */
  private static async getAvailableGiftCards(availablePoints: number): Promise<FetchLikeReward[]> {
    const giftCards = [
      { name: 'Amazon', value: 5, pointsRequired: 500 },
      { name: 'Amazon', value: 10, pointsRequired: 1000 },
      { name: 'Amazon', value: 25, pointsRequired: 2500 },
      { name: 'Starbucks', value: 5, pointsRequired: 500 },
      { name: 'Starbucks', value: 10, pointsRequired: 1000 },
      { name: 'Target', value: 10, pointsRequired: 1000 },
      { name: 'Target', value: 25, pointsRequired: 2500 }
    ];

    return giftCards
      .filter(card => card.pointsRequired <= availablePoints)
      .map(card => ({
        id: `giftcard_${card.name}_${card.value}`,
        type: 'gift_card' as const,
        value: card.value,
        description: `$${card.value} ${card.name} Gift Card`,
        merchant: card.name,
        category: 'gift_card',
        isRedeemed: false
      }));
  }

  /**
   * Get special offers
   */
  private static async getSpecialOffers(userId: number): Promise<FetchLikeReward[]> {
    // Placeholder for special offers
    return [
      {
        id: 'special_offer_1',
        type: 'discount',
        value: 10,
        description: '10% off your next purchase',
        merchant: 'BlockReceipt',
        category: 'discount',
        isRedeemed: false
      }
    ];
  }

  /**
   * Get NFT rewards
   */
  private static async getNFTRewards(userId: number): Promise<FetchLikeReward[]> {
    // Placeholder for NFT rewards
    return [
      {
        id: 'nft_reward_1',
        type: 'nft',
        value: 1,
        description: 'Exclusive BlockReceipt NFT',
        merchant: 'BlockReceipt',
        category: 'nft',
        isRedeemed: false
      }
    ];
  }

  /**
   * Get reward details
   */
  private static async getRewardDetails(rewardId: string): Promise<FetchLikeReward | null> {
    // Placeholder implementation
    return {
      id: rewardId,
      type: 'gift_card',
      value: 10,
      description: 'Sample reward',
      merchant: 'BlockReceipt',
      category: 'gift_card',
      isRedeemed: false
    };
  }

  /**
   * Mark reward as redeemed
   */
  private static async markRewardAsRedeemed(
    userId: number,
    rewardId: string,
    pointsRedeemed: number
  ): Promise<void> {
    // Implementation would mark the reward as redeemed
    logger.info(`[Fetch Loyalty] User ${userId} redeemed reward ${rewardId} for ${pointsRedeemed} points`);
  }
}

export default FetchCompetitiveLoyaltyService;
