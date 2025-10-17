/**
 * Enterprise Analytics Routes
 * 
 * API endpoints for enterprise merchant analytics and insights
 * Provides comprehensive reporting and business intelligence
 */

import express from 'express';
import { z } from 'zod';
import { EnterpriseAnalyticsService } from '../services/enterpriseAnalyticsService';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Get Merchant Analytics
 * GET /api/enterprise/analytics/merchant/:merchantId
 */
router.get('/merchant/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate dates
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const end = endDate ? new Date(endDate as string) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (start >= end) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    const analytics = await EnterpriseAnalyticsService.getMerchantAnalytics(
      parseInt(merchantId),
      start,
      end
    );

    res.json({
      success: true,
      data: analytics
    });

  } catch (error) {
    logger.error(`[Analytics] Error getting merchant analytics: ${error}`);
    res.status(500).json({ error: 'Failed to get merchant analytics' });
  }
});

/**
 * Get Customer Insights
 * GET /api/enterprise/analytics/customers/:merchantId
 */
router.get('/customers/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { limit = 100 } = req.query;

    const insights = await EnterpriseAnalyticsService.getCustomerInsights(
      parseInt(merchantId),
      parseInt(limit as string)
    );

    res.json({
      success: true,
      data: insights,
      count: insights.length
    });

  } catch (error) {
    logger.error(`[Analytics] Error getting customer insights: ${error}`);
    res.status(500).json({ error: 'Failed to get customer insights' });
  }
});

/**
 * Get Receipt Trends
 * GET /api/enterprise/analytics/trends/:merchantId
 */
router.get('/trends/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Validate dates
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    if (start >= end) {
      return res.status(400).json({ error: 'Start date must be before end date' });
    }

    if (!['day', 'week', 'month'].includes(groupBy as string)) {
      return res.status(400).json({ error: 'Invalid groupBy parameter. Must be day, week, or month' });
    }

    const trends = await EnterpriseAnalyticsService.getReceiptTrends(
      parseInt(merchantId),
      start,
      end,
      groupBy as 'day' | 'week' | 'month'
    );

    res.json({
      success: true,
      data: trends,
      period: { start, end },
      groupBy
    });

  } catch (error) {
    logger.error(`[Analytics] Error getting receipt trends: ${error}`);
    res.status(500).json({ error: 'Failed to get receipt trends' });
  }
});

/**
 * Get Real-time Dashboard Data
 * GET /api/enterprise/analytics/dashboard/:merchantId
 */
router.get('/dashboard/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { period = '24h' } = req.query;

    // Calculate period dates
    const now = new Date();
    let start: Date;
    
    switch (period) {
      case '1h':
        start = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Get comprehensive analytics
    const analytics = await EnterpriseAnalyticsService.getMerchantAnalytics(
      parseInt(merchantId),
      start,
      now
    );

    // Get recent trends
    const trends = await EnterpriseAnalyticsService.getReceiptTrends(
      parseInt(merchantId),
      start,
      now,
      period === '1h' ? 'day' : period === '24h' ? 'day' : 'week'
    );

    // Get top customers
    const topCustomers = await EnterpriseAnalyticsService.getCustomerInsights(
      parseInt(merchantId),
      10
    );

    res.json({
      success: true,
      data: {
        analytics,
        trends,
        topCustomers,
        period: { start, end: now },
        lastUpdated: now
      }
    });

  } catch (error) {
    logger.error(`[Analytics] Error getting dashboard data: ${error}`);
    res.status(500).json({ error: 'Failed to get dashboard data' });
  }
});

/**
 * Get Revenue Analytics
 * GET /api/enterprise/analytics/revenue/:merchantId
 */
router.get('/revenue/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate dates
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Get analytics
    const analytics = await EnterpriseAnalyticsService.getMerchantAnalytics(
      parseInt(merchantId),
      start,
      end
    );

    // Calculate revenue metrics
    const revenueMetrics = {
      totalRevenue: analytics.receipts.totalValue,
      averageOrderValue: analytics.receipts.averageValue,
      revenueGrowth: analytics.receipts.growthRate,
      costSavings: analytics.roi.costSavings,
      revenueImpact: analytics.roi.revenueImpact,
      netBenefit: analytics.roi.costSavings + analytics.roi.revenueImpact
    };

    res.json({
      success: true,
      data: revenueMetrics,
      period: { start, end }
    });

  } catch (error) {
    logger.error(`[Analytics] Error getting revenue analytics: ${error}`);
    res.status(500).json({ error: 'Failed to get revenue analytics' });
  }
});

/**
 * Get Loyalty Program Analytics
 * GET /api/enterprise/analytics/loyalty/:merchantId
 */
router.get('/loyalty/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { startDate, endDate } = req.query;

    // Validate dates
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Get analytics
    const analytics = await EnterpriseAnalyticsService.getMerchantAnalytics(
      parseInt(merchantId),
      start,
      end
    );

    // Calculate loyalty metrics
    const loyaltyMetrics = {
      totalPointsAwarded: analytics.loyalty.totalPointsAwarded,
      totalPointsRedeemed: analytics.loyalty.totalPointsRedeemed,
      activeUsers: analytics.loyalty.activeUsers,
      averagePointsPerUser: analytics.loyalty.averagePointsPerUser,
      redemptionRate: analytics.loyalty.totalPointsAwarded > 0 ? 
        (analytics.loyalty.totalPointsRedeemed / analytics.loyalty.totalPointsAwarded) * 100 : 0,
      pointsValue: analytics.loyalty.totalPointsAwarded * 0.01, // 1 point = $0.01
      nftMinted: analytics.nfts.totalMinted,
      nftHolders: analytics.nfts.uniqueHolders
    };

    res.json({
      success: true,
      data: loyaltyMetrics,
      period: { start, end }
    });

  } catch (error) {
    logger.error(`[Analytics] Error getting loyalty analytics: ${error}`);
    res.status(500).json({ error: 'Failed to get loyalty analytics' });
  }
});

/**
 * Get Customer Segmentation
 * GET /api/enterprise/analytics/segmentation/:merchantId
 */
router.get('/segmentation/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;

    // Get customer insights
    const customers = await EnterpriseAnalyticsService.getCustomerInsights(
      parseInt(merchantId),
      1000 // Get more customers for segmentation
    );

    // Segment customers
    const segments = {
      highValue: customers.filter(c => c.totalSpent >= 1000),
      mediumValue: customers.filter(c => c.totalSpent >= 100 && c.totalSpent < 1000),
      lowValue: customers.filter(c => c.totalSpent < 100),
      frequent: customers.filter(c => c.totalReceipts >= 10),
      occasional: customers.filter(c => c.totalReceipts >= 3 && c.totalReceipts < 10),
      new: customers.filter(c => c.totalReceipts < 3),
      loyal: customers.filter(c => c.loyaltyPoints >= 500),
      nftHolders: customers.filter(c => c.nftCount > 0)
    };

    // Calculate segment metrics
    const segmentMetrics = {
      highValue: {
        count: segments.highValue.length,
        averageSpent: segments.highValue.length > 0 ? 
          segments.highValue.reduce((sum, c) => sum + c.totalSpent, 0) / segments.highValue.length : 0,
        percentage: (segments.highValue.length / customers.length) * 100
      },
      mediumValue: {
        count: segments.mediumValue.length,
        averageSpent: segments.mediumValue.length > 0 ? 
          segments.mediumValue.reduce((sum, c) => sum + c.totalSpent, 0) / segments.mediumValue.length : 0,
        percentage: (segments.mediumValue.length / customers.length) * 100
      },
      lowValue: {
        count: segments.lowValue.length,
        averageSpent: segments.lowValue.length > 0 ? 
          segments.lowValue.reduce((sum, c) => sum + c.totalSpent, 0) / segments.lowValue.length : 0,
        percentage: (segments.lowValue.length / customers.length) * 100
      },
      frequent: {
        count: segments.frequent.length,
        percentage: (segments.frequent.length / customers.length) * 100
      },
      occasional: {
        count: segments.occasional.length,
        percentage: (segments.occasional.length / customers.length) * 100
      },
      new: {
        count: segments.new.length,
        percentage: (segments.new.length / customers.length) * 100
      },
      loyal: {
        count: segments.loyal.length,
        percentage: (segments.loyal.length / customers.length) * 100
      },
      nftHolders: {
        count: segments.nftHolders.length,
        percentage: (segments.nftHolders.length / customers.length) * 100
      }
    };

    res.json({
      success: true,
      data: {
        segments,
        metrics: segmentMetrics,
        totalCustomers: customers.length
      }
    });

  } catch (error) {
    logger.error(`[Analytics] Error getting customer segmentation: ${error}`);
    res.status(500).json({ error: 'Failed to get customer segmentation' });
  }
});

/**
 * Export Analytics Data
 * GET /api/enterprise/analytics/export/:merchantId
 */
router.get('/export/:merchantId', async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { startDate, endDate, format = 'json' } = req.query;

    // Validate dates
    const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate as string) : new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    // Get comprehensive data
    const analytics = await EnterpriseAnalyticsService.getMerchantAnalytics(
      parseInt(merchantId),
      start,
      end
    );

    const trends = await EnterpriseAnalyticsService.getReceiptTrends(
      parseInt(merchantId),
      start,
      end,
      'day'
    );

    const customers = await EnterpriseAnalyticsService.getCustomerInsights(
      parseInt(merchantId),
      1000
    );

    const exportData = {
      merchantId: parseInt(merchantId),
      period: { start, end },
      generatedAt: new Date(),
      analytics,
      trends,
      customers
    };

    if (format === 'csv') {
      // Convert to CSV format (simplified)
      const csvData = `Merchant ID,Period Start,Period End,Total Receipts,Total Value,Average Value,Growth Rate
${merchantId},${start.toISOString()},${end.toISOString()},${analytics.receipts.total},${analytics.receipts.totalValue},${analytics.receipts.averageValue},${analytics.receipts.growthRate}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-${merchantId}-${start.toISOString().split('T')[0]}.csv"`);
      res.send(csvData);
    } else {
      res.json({
        success: true,
        data: exportData
      });
    }

  } catch (error) {
    logger.error(`[Analytics] Error exporting analytics: ${error}`);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

export default router;
