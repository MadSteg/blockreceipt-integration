import { db } from '../db';
import { loyaltyPoints, merchantRewardPools, rewardClaims, nftPool, userReceipts, merchants } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';

export interface RewardCalculation {
  tier: 'basic' | 'premium' | 'luxury';
  pointsAwarded: number;
  nftChance: number; // Percentage chance of getting an NFT
}

export interface ProcessedReward {
  rewardType: 'nft' | 'points';
  tier: string;
  pointsAwarded?: number;
  nftTokenId?: string;
  nftName?: string;
  nftImage?: string;
}

export class LoyaltyRewardsService {
  
  /**
   * Calculate reward tier based on transaction value
   */
  static calculateRewardTier(transactionAmount: number): RewardCalculation {
    // Transaction amount is in cents
    const amountDollars = transactionAmount / 100;
    
    if (amountDollars >= 100) {
      return {
        tier: 'luxury',
        pointsAwarded: Math.floor(amountDollars * 2), // 2 points per dollar
        nftChance: 25 // 25% chance for luxury NFT
      };
    } else if (amountDollars >= 25) {
      return {
        tier: 'premium',
        pointsAwarded: Math.floor(amountDollars * 1.5), // 1.5 points per dollar
        nftChance: 15 // 15% chance for premium NFT
      };
    } else {
      return {
        tier: 'basic',
        pointsAwarded: Math.floor(amountDollars), // 1 point per dollar
        nftChance: 8 // 8% chance for basic NFT
      };
    }
  }

  /**
   * Process rewards automatically when a receipt is created
   */
  static async processReceiptRewards(
    receiptId: number,
    userId: number,
    merchantId: number,
    transactionAmount: number
  ): Promise<ProcessedReward[]> {
    
    const rewards: ProcessedReward[] = [];
    const rewardCalc = this.calculateRewardTier(transactionAmount);
    
    // Check if merchant has an active reward pool
    const [activePool] = await db
      .select()
      .from(merchantRewardPools)
      .where(
        and(
          eq(merchantRewardPools.merchantId, merchantId),
          eq(merchantRewardPools.isActive, true)
        )
      )
      .limit(1);

    if (!activePool) {
      // No active reward pool, only award points
      return await this.awardPointsOnly(receiptId, userId, merchantId, rewardCalc);
    }

    // Determine if user gets an NFT (random chance)
    const nftRoll = Math.random() * 100;
    const getsNFT = nftRoll <= rewardCalc.nftChance;

    if (getsNFT) {
      // Award NFT + points
      const nftReward = await this.awardNFT(receiptId, userId, merchantId, rewardCalc.tier, activePool.id);
      if (nftReward) {
        rewards.push(nftReward);
      }
    }

    // Always award points
    const pointsReward = await this.awardPoints(receiptId, userId, merchantId, rewardCalc);
    rewards.push(pointsReward);

    return rewards;
  }

  /**
   * Award points only (when no NFT pool available)
   */
  private static async awardPointsOnly(
    receiptId: number,
    userId: number,
    merchantId: number,
    rewardCalc: RewardCalculation
  ): Promise<ProcessedReward[]> {
    
    const pointsReward = await this.awardPoints(receiptId, userId, merchantId, rewardCalc);
    return [pointsReward];
  }

  /**
   * Award loyalty points
   */
  private static async awardPoints(
    receiptId: number,
    userId: number,
    merchantId: number,
    rewardCalc: RewardCalculation
  ): Promise<ProcessedReward> {
    
    // Set points to expire in 1 year
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    
    // Award loyalty points
    await db.insert(loyaltyPoints).values({
      userId,
      merchantId,
      points: rewardCalc.pointsAwarded,
      earnedFromReceiptId: receiptId,
      expiresAt
    });

    // Record the reward claim
    await db.insert(rewardClaims).values({
      userId,
      merchantId,
      receiptId,
      rewardType: 'points',
      pointsAwarded: rewardCalc.pointsAwarded,
      tier: rewardCalc.tier,
      isAutoClaimed: true
    });

    return {
      rewardType: 'points',
      tier: rewardCalc.tier,
      pointsAwarded: rewardCalc.pointsAwarded
    };
  }

  /**
   * Award NFT from merchant's pool
   */
  private static async awardNFT(
    receiptId: number,
    userId: number,
    merchantId: number,
    tier: string,
    poolId: number
  ): Promise<ProcessedReward | null> {
    
    // Get available NFTs from merchant's pool for this tier
    const availableNFTs = await db
      .select()
      .from(nftPool)
      .where(
        and(
          eq(nftPool.merchantId, merchantId),
          eq(nftPool.tier, tier),
          eq(nftPool.enabled, true)
        )
      );

    if (availableNFTs.length === 0) {
      return null; // No NFTs available for this tier
    }

    // Randomly select an NFT
    const selectedNFT = availableNFTs[Math.floor(Math.random() * availableNFTs.length)];
    
    // Generate unique token ID
    const tokenId = `${merchantId}-${selectedNFT.nftId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Update merchant pool minted count
    await db
      .update(merchantRewardPools)
      .set({ 
        totalMinted: sql`${merchantRewardPools.totalMinted} + 1`
      })
      .where(eq(merchantRewardPools.id, poolId));

    // Record the NFT reward claim
    await db.insert(rewardClaims).values({
      userId,
      merchantId,
      receiptId,
      rewardType: 'nft',
      nftTokenId: tokenId,
      tier,
      isAutoClaimed: true
    });

    return {
      rewardType: 'nft',
      tier,
      nftTokenId: tokenId,
      nftName: selectedNFT.name,
      nftImage: selectedNFT.image
    };
  }

  /**
   * Get user's loyalty points balance for a specific merchant
   */
  static async getUserPointsBalance(userId: number, merchantId: number): Promise<number> {
    const [result] = await db
      .select({
        totalPoints: sql<number>`COALESCE(SUM(${loyaltyPoints.points}), 0)`
      })
      .from(loyaltyPoints)
      .where(
        and(
          eq(loyaltyPoints.userId, userId),
          eq(loyaltyPoints.merchantId, merchantId),
          eq(loyaltyPoints.isRedeemed, false)
        )
      );

    return result?.totalPoints || 0;
  }

  /**
   * Get user's reward history
   */
  static async getUserRewardHistory(userId: number, merchantId?: number) {
    let query = db
      .select({
        id: rewardClaims.id,
        rewardType: rewardClaims.rewardType,
        tier: rewardClaims.tier,
        pointsAwarded: rewardClaims.pointsAwarded,
        nftTokenId: rewardClaims.nftTokenId,
        claimedAt: rewardClaims.claimedAt,
        merchantName: merchants.name
      })
      .from(rewardClaims)
      .leftJoin(merchants, eq(rewardClaims.merchantId, merchants.id))
      .where(eq(rewardClaims.userId, userId));

    if (merchantId) {
      query = query.where(
        and(
          eq(rewardClaims.userId, userId),
          eq(rewardClaims.merchantId, merchantId)
        )
      );
    }

    return await query.orderBy(sql`${rewardClaims.claimedAt} DESC`);
  }

  /**
   * Redeem points for a discount (placeholder for merchant-specific redemption)
   */
  static async redeemPoints(
    userId: number,
    merchantId: number,
    pointsToRedeem: number,
    redemptionType: string = 'discount'
  ): Promise<{ success: boolean; discountAmount?: number; message: string }> {
    
    const currentBalance = await this.getUserPointsBalance(userId, merchantId);
    
    if (currentBalance < pointsToRedeem) {
      return {
        success: false,
        message: 'Insufficient points balance'
      };
    }

    // Calculate discount (example: 100 points = $1 off)
    const discountAmount = Math.floor(pointsToRedeem / 100) * 100; // In cents
    
    // Mark points as redeemed
    await db
      .update(loyaltyPoints)
      .set({ 
        isRedeemed: true, 
        redeemedAt: new Date() 
      })
      .where(
        and(
          eq(loyaltyPoints.userId, userId),
          eq(loyaltyPoints.merchantId, merchantId),
          eq(loyaltyPoints.isRedeemed, false)
        )
      );

    return {
      success: true,
      discountAmount,
      message: `Redeemed ${pointsToRedeem} points for $${(discountAmount / 100).toFixed(2)} discount`
    };
  }
}