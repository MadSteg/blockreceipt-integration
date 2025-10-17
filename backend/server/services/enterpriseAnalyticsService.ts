/**
 * Enterprise Analytics Service
 * 
 * Provides comprehensive analytics for enterprise merchants
 * Tracks receipt volume, customer behavior, loyalty metrics, and ROI
 */

import { logger } from '../utils/logger';
import { db } from '../db';
import { userReceipts, merchants, userWallets, loyaltyPoints, rewardClaims } from '@shared/schema';
import { eq, and, gte, lte, sql, desc, count } from 'drizzle-orm';

export interface MerchantAnalytics {
  merchantId: number;
  merchantName: string;
  period: {
    start: Date;
    end: Date;
  };
  receipts: {
    total: number;
    totalValue: number;
    averageValue: number;
    growthRate: number;
  };
  customers: {
    total: number;
    newCustomers: number;
    returningCustomers: number;
    averageReceiptsPerCustomer: number;
  };
  loyalty: {
    totalPointsAwarded: number;
    totalPointsRedeemed: number;
    activeUsers: number;
    averagePointsPerUser: number;
  };
  nfts: {
    totalMinted: number;
    uniqueHolders: number;
    averageValue: number;
  };
  roi: {
    costSavings: number;
    customerRetention: number;
    averageOrderValue: number;
    revenueImpact: number;
  };
}

export interface CustomerInsights {
  customerId: number;
  phoneNumber: string;
  email?: string;
  totalReceipts: number;
  totalSpent: number;
  averageOrderValue: number;
  loyaltyPoints: number;
  favoriteCategories: string[];
  lastPurchase: Date;
  nftCount: number;
  dataSharingConsent: boolean;
}

export interface ReceiptTrends {
  date: string;
  receipts: number;
  value: number;
  averageValue: number;
  newCustomers: number;
  returningCustomers: number;
}

export class EnterpriseAnalyticsService {
  
  /**
   * Get comprehensive analytics for a merchant
   */
  static async getMerchantAnalytics(
    merchantId: number,
    startDate: Date,
    endDate: Date
  ): Promise<MerchantAnalytics> {
    try {
      logger.info(`[Analytics] Getting merchant analytics for ${merchantId}`);

      // Get merchant info
      const [merchant] = await db
        .select()
        .from(merchants)
        .where(eq(merchants.id, merchantId));

      if (!merchant) {
        throw new Error('Merchant not found');
      }

      // Get receipt analytics
      const receiptAnalytics = await this.getReceiptAnalytics(merchantId, startDate, endDate);
      
      // Get customer analytics
      const customerAnalytics = await this.getCustomerAnalytics(merchantId, startDate, endDate);
      
      // Get loyalty analytics
      const loyaltyAnalytics = await this.getLoyaltyAnalytics(merchantId, startDate, endDate);
      
      // Get NFT analytics
      const nftAnalytics = await this.getNFTAnalytics(merchantId, startDate, endDate);
      
      // Get ROI analytics
      const roiAnalytics = await this.getROIAnalytics(merchantId, startDate, endDate);

      return {
        merchantId,
        merchantName: merchant.name,
        period: { start: startDate, end: endDate },
        receipts: receiptAnalytics,
        customers: customerAnalytics,
        loyalty: loyaltyAnalytics,
        nfts: nftAnalytics,
        roi: roiAnalytics
      };

    } catch (error) {
      logger.error(`[Analytics] Error getting merchant analytics: ${error}`);
      throw new Error(`Failed to get merchant analytics: ${error.message}`);
    }
  }

  /**
   * Get customer insights for a merchant
   */
  static async getCustomerInsights(
    merchantId: number,
    limit: number = 100
  ): Promise<CustomerInsights[]> {
    try {
      logger.info(`[Analytics] Getting customer insights for merchant ${merchantId}`);

      // Get customer data with receipts
      const customers = await db
        .select({
          customerId: userWallets.userId,
          phoneNumber: userWallets.phoneNumber,
          email: userWallets.email,
          totalReceipts: count(userReceipts.id),
          totalSpent: sql<number>`COALESCE(SUM(${userReceipts.amount}), 0)`,
          loyaltyPoints: sql<number>`COALESCE(SUM(${loyaltyPoints.points}), 0)`,
          nftCount: sql<number>`COALESCE(COUNT(${userReceipts.nftTokenId}), 0)`,
          lastPurchase: sql<Date>`MAX(${userReceipts.createdAt})`
        })
        .from(userWallets)
        .leftJoin(userReceipts, eq(userWallets.userId, userReceipts.userId))
        .leftJoin(loyaltyPoints, eq(userWallets.userId, loyaltyPoints.userId))
        .where(eq(userReceipts.merchantId, merchantId))
        .groupBy(userWallets.userId, userWallets.phoneNumber, userWallets.email)
        .orderBy(desc(sql`COALESCE(SUM(${userReceipts.amount}), 0)`))
        .limit(limit);

      // Process customer insights
      const insights: CustomerInsights[] = customers.map(customer => ({
        customerId: customer.customerId,
        phoneNumber: customer.phoneNumber,
        email: customer.email,
        totalReceipts: customer.totalReceipts,
        totalSpent: customer.totalSpent,
        averageOrderValue: customer.totalReceipts > 0 ? customer.totalSpent / customer.totalReceipts : 0,
        loyaltyPoints: customer.loyaltyPoints,
        favoriteCategories: [], // Would need to analyze receipt items
        lastPurchase: customer.lastPurchase,
        nftCount: customer.nftCount,
        dataSharingConsent: false // Would need to check data sharing table
      }));

      return insights;

    } catch (error) {
      logger.error(`[Analytics] Error getting customer insights: ${error}`);
      throw new Error(`Failed to get customer insights: ${error.message}`);
    }
  }

  /**
   * Get receipt trends over time
   */
  static async getReceiptTrends(
    merchantId: number,
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<ReceiptTrends[]> {
    try {
      logger.info(`[Analytics] Getting receipt trends for merchant ${merchantId}`);

      // Determine date grouping
      const dateFormat = groupBy === 'day' ? '%Y-%m-%d' : 
                       groupBy === 'week' ? '%Y-%u' : '%Y-%m';

      // Get trends data
      const trends = await db
        .select({
          date: sql<string>`DATE_FORMAT(${userReceipts.createdAt}, '${sql.raw(dateFormat)}')`,
          receipts: count(userReceipts.id),
          value: sql<number>`COALESCE(SUM(${userReceipts.amount}), 0)`,
          averageValue: sql<number>`COALESCE(AVG(${userReceipts.amount}), 0)`,
          newCustomers: sql<number>`COUNT(DISTINCT CASE WHEN ${userWallets.createdAt} >= ${userReceipts.createdAt} THEN ${userWallets.userId} END)`,
          returningCustomers: sql<number>`COUNT(DISTINCT CASE WHEN ${userWallets.createdAt} < ${userReceipts.createdAt} THEN ${userWallets.userId} END)`
        })
        .from(userReceipts)
        .leftJoin(userWallets, eq(userReceipts.userId, userWallets.userId))
        .where(
          and(
            eq(userReceipts.merchantId, merchantId),
            gte(userReceipts.createdAt, startDate),
            lte(userReceipts.createdAt, endDate)
          )
        )
        .groupBy(sql`DATE_FORMAT(${userReceipts.createdAt}, '${sql.raw(dateFormat)}')`)
        .orderBy(sql`DATE_FORMAT(${userReceipts.createdAt}, '${sql.raw(dateFormat)}')`);

      return trends.map(trend => ({
        date: trend.date,
        receipts: trend.receipts,
        value: trend.value,
        averageValue: trend.averageValue,
        newCustomers: trend.newCustomers,
        returningCustomers: trend.returningCustomers
      }));

    } catch (error) {
      logger.error(`[Analytics] Error getting receipt trends: ${error}`);
      throw new Error(`Failed to get receipt trends: ${error.message}`);
    }
  }

  /**
   * Get receipt analytics
   */
  private static async getReceiptAnalytics(
    merchantId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    totalValue: number;
    averageValue: number;
    growthRate: number;
  }> {
    try {
      // Get current period data
      const [currentPeriod] = await db
        .select({
          total: count(userReceipts.id),
          totalValue: sql<number>`COALESCE(SUM(${userReceipts.amount}), 0)`,
          averageValue: sql<number>`COALESCE(AVG(${userReceipts.amount}), 0)`
        })
        .from(userReceipts)
        .where(
          and(
            eq(userReceipts.merchantId, merchantId),
            gte(userReceipts.createdAt, startDate),
            lte(userReceipts.createdAt, endDate)
          )
        );

      // Get previous period data for growth calculation
      const periodLength = endDate.getTime() - startDate.getTime();
      const previousStartDate = new Date(startDate.getTime() - periodLength);
      const previousEndDate = new Date(startDate.getTime() - 1);

      const [previousPeriod] = await db
        .select({
          total: count(userReceipts.id),
          totalValue: sql<number>`COALESCE(SUM(${userReceipts.amount}), 0)`
        })
        .from(userReceipts)
        .where(
          and(
            eq(userReceipts.merchantId, merchantId),
            gte(userReceipts.createdAt, previousStartDate),
            lte(userReceipts.createdAt, previousEndDate)
          )
        );

      // Calculate growth rate
      const growthRate = previousPeriod.total > 0 ? 
        ((currentPeriod.total - previousPeriod.total) / previousPeriod.total) * 100 : 0;

      return {
        total: currentPeriod.total,
        totalValue: currentPeriod.totalValue,
        averageValue: currentPeriod.averageValue,
        growthRate
      };

    } catch (error) {
      logger.error(`[Analytics] Error getting receipt analytics: ${error}`);
      return {
        total: 0,
        totalValue: 0,
        averageValue: 0,
        growthRate: 0
      };
    }
  }

  /**
   * Get customer analytics
   */
  private static async getCustomerAnalytics(
    merchantId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{
    total: number;
    newCustomers: number;
    returningCustomers: number;
    averageReceiptsPerCustomer: number;
  }> {
    try {
      // Get customer data
      const [customerData] = await db
        .select({
          total: sql<number>`COUNT(DISTINCT ${userWallets.userId})`,
          newCustomers: sql<number>`COUNT(DISTINCT CASE WHEN ${userWallets.createdAt} >= ${startDate} THEN ${userWallets.userId} END)`,
          returningCustomers: sql<number>`COUNT(DISTINCT CASE WHEN ${userWallets.createdAt} < ${startDate} THEN ${userWallets.userId} END)`,
          totalReceipts: sql<number>`COALESCE(SUM(${userReceipts.amount}), 0)`
        })
        .from(userWallets)
        .leftJoin(userReceipts, eq(userWallets.userId, userReceipts.userId))
        .where(
          and(
            eq(userReceipts.merchantId, merchantId),
            gte(userReceipts.createdAt, startDate),
            lte(userReceipts.createdAt, endDate)
          )
        );

      return {
        total: customerData.total,
        newCustomers: customerData.newCustomers,
        returningCustomers: customerData.returningCustomers,
        averageReceiptsPerCustomer: customerData.total > 0 ? customerData.totalReceipts / customerData.total : 0
      };

    } catch (error) {
      logger.error(`[Analytics] Error getting customer analytics: ${error}`);
      return {
        total: 0,
        newCustomers: 0,
        returningCustomers: 0,
        averageReceiptsPerCustomer: 0
      };
    }
  }

  /**
   * Get loyalty analytics
   */
  private static async getLoyaltyAnalytics(
    merchantId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalPointsAwarded: number;
    totalPointsRedeemed: number;
    activeUsers: number;
    averagePointsPerUser: number;
  }> {
    try {
      // Get loyalty data
      const [loyaltyData] = await db
        .select({
          totalPointsAwarded: sql<number>`COALESCE(SUM(${loyaltyPoints.points}), 0)`,
          totalPointsRedeemed: sql<number>`COALESCE(SUM(CASE WHEN ${loyaltyPoints.isRedeemed} = true THEN ${loyaltyPoints.points} ELSE 0 END), 0)`,
          activeUsers: sql<number>`COUNT(DISTINCT ${loyaltyPoints.userId})`,
          averagePointsPerUser: sql<number>`COALESCE(AVG(${loyaltyPoints.points}), 0)`
        })
        .from(loyaltyPoints)
        .where(
          and(
            eq(loyaltyPoints.merchantId, merchantId),
            gte(loyaltyPoints.createdAt, startDate),
            lte(loyaltyPoints.createdAt, endDate)
          )
        );

      return {
        totalPointsAwarded: loyaltyData.totalPointsAwarded,
        totalPointsRedeemed: loyaltyData.totalPointsRedeemed,
        activeUsers: loyaltyData.activeUsers,
        averagePointsPerUser: loyaltyData.averagePointsPerUser
      };

    } catch (error) {
      logger.error(`[Analytics] Error getting loyalty analytics: ${error}`);
      return {
        totalPointsAwarded: 0,
        totalPointsRedeemed: 0,
        activeUsers: 0,
        averagePointsPerUser: 0
      };
    }
  }

  /**
   * Get NFT analytics
   */
  private static async getNFTAnalytics(
    merchantId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalMinted: number;
    uniqueHolders: number;
    averageValue: number;
  }> {
    try {
      // Get NFT data
      const [nftData] = await db
        .select({
          totalMinted: sql<number>`COUNT(DISTINCT ${userReceipts.nftTokenId})`,
          uniqueHolders: sql<number>`COUNT(DISTINCT ${userReceipts.userId})`,
          averageValue: sql<number>`COALESCE(AVG(${userReceipts.amount}), 0)`
        })
        .from(userReceipts)
        .where(
          and(
            eq(userReceipts.merchantId, merchantId),
            gte(userReceipts.createdAt, startDate),
            lte(userReceipts.createdAt, endDate),
            sql`${userReceipts.nftTokenId} IS NOT NULL`
          )
        );

      return {
        totalMinted: nftData.totalMinted,
        uniqueHolders: nftData.uniqueHolders,
        averageValue: nftData.averageValue
      };

    } catch (error) {
      logger.error(`[Analytics] Error getting NFT analytics: ${error}`);
      return {
        totalMinted: 0,
        uniqueHolders: 0,
        averageValue: 0
      };
    }
  }

  /**
   * Get ROI analytics
   */
  private static async getROIAnalytics(
    merchantId: number,
    startDate: Date,
    endDate: Date
  ): Promise<{
    costSavings: number;
    customerRetention: number;
    averageOrderValue: number;
    revenueImpact: number;
  }> {
    try {
      // Calculate cost savings (paper receipts, printing, etc.)
      const [receiptData] = await db
        .select({
          totalReceipts: count(userReceipts.id),
          totalValue: sql<number>`COALESCE(SUM(${userReceipts.amount}), 0)`
        })
        .from(userReceipts)
        .where(
          and(
            eq(userReceipts.merchantId, merchantId),
            gte(userReceipts.createdAt, startDate),
            lte(userReceipts.createdAt, endDate)
          )
        );

      // Estimate cost savings (paper receipts cost ~$0.02 each)
      const costSavings = receiptData.totalReceipts * 0.02;
      
      // Calculate customer retention (simplified)
      const customerRetention = 0.75; // Placeholder - would need historical data
      
      // Calculate average order value
      const averageOrderValue = receiptData.totalReceipts > 0 ? 
        receiptData.totalValue / receiptData.totalReceipts : 0;
      
      // Estimate revenue impact (loyalty program typically increases sales by 5-15%)
      const revenueImpact = receiptData.totalValue * 0.10; // 10% increase

      return {
        costSavings,
        customerRetention,
        averageOrderValue,
        revenueImpact
      };

    } catch (error) {
      logger.error(`[Analytics] Error getting ROI analytics: ${error}`);
      return {
        costSavings: 0,
        customerRetention: 0,
        averageOrderValue: 0,
        revenueImpact: 0
      };
    }
  }
}

export default EnterpriseAnalyticsService;
