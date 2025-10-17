import { Router } from 'express';
import { giftCardRedemptionService } from '../services/giftCardRedemption';
import { createLogger } from '../logger';

const router = Router();
const logger = createLogger('gift-card-routes');

/**
 * GET /api/gift-cards/brands
 * Get available gift card brands and denominations
 */
router.get('/brands', (req, res) => {
  try {
    const brands = giftCardRedemptionService.getSupportedBrands();
    
    res.json({
      success: true,
      brands: brands.map(brand => ({
        id: brand.id,
        name: brand.name,
        denominations: brand.denominations,
        minPoints: brand.minPoints,
        description: brand.description,
        minValue: giftCardRedemptionService.pointsToValue(brand.minPoints)
      }))
    });
  } catch (error) {
    logger.error('Error fetching gift card brands:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch gift card brands'
    });
  }
});

/**
 * GET /api/gift-cards/balance/:userId
 * Get user's points balance and redemption history
 */
router.get('/balance/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const pointsBalance = giftCardRedemptionService.getUserPointsBalance(userId);
    const dollarValue = giftCardRedemptionService.pointsToValue(pointsBalance);
    const history = giftCardRedemptionService.getRedemptionHistory(userId);

    res.json({
      success: true,
      balance: {
        points: pointsBalance,
        dollarValue: dollarValue,
        formatted: `$${dollarValue.toFixed(2)}`
      },
      history
    });
  } catch (error) {
    logger.error('Error fetching user balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user balance'
    });
  }
});

/**
 * POST /api/gift-cards/redeem
 * Redeem points for a gift card
 */
router.post('/redeem', async (req, res) => {
  try {
    const {
      userId,
      merchantId,
      giftCardBrand,
      denomination
    } = req.body;

    // Validate required fields
    if (!userId || !giftCardBrand || !denomination) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, giftCardBrand, denomination'
      });
    }

    // Generate unique request ID for idempotency
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const requiredPoints = giftCardRedemptionService.valueToPoints(denomination);

    const redemptionRequest = {
      userId,
      merchantId: merchantId || 'general',
      points: requiredPoints,
      giftCardBrand,
      denomination,
      requestId
    };

    const result = await giftCardRedemptionService.redeemGiftCard(redemptionRequest);

    if (result.success && result.giftCard) {
      // Log successful redemption
      logger.info(`[redemption] User ${userId} redeemed ${requiredPoints} points for ${giftCardBrand} $${denomination}`);

      res.json({
        success: true,
        giftCard: {
          brand: result.giftCard.brand,
          value: result.giftCard.value,
          code: result.giftCard.code,
          pin: result.giftCard.pin,
          redemptionUrl: result.giftCard.redemptionUrl,
          expirationDate: result.giftCard.expirationDate,
          issuedAt: result.giftCard.issuedAt
        },
        pointsUsed: requiredPoints,
        remainingBalance: giftCardRedemptionService.getUserPointsBalance(userId),
        transactionId: result.transactionId,
        message: `Successfully redeemed ${requiredPoints} points for ${giftCardBrand} $${denomination} gift card`
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Redemption failed',
        transactionId: result.transactionId
      });
    }

  } catch (error) {
    logger.error('Error processing gift card redemption:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process redemption',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/gift-cards/add-points
 * Add points to user balance (called when receipt NFT is minted)
 */
router.post('/add-points', (req, res) => {
  try {
    const { userId, points, source } = req.body;

    if (!userId || !points || !source) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: userId, points, source'
      });
    }

    giftCardRedemptionService.addPoints(userId, points, source);
    const newBalance = giftCardRedemptionService.getUserPointsBalance(userId);

    res.json({
      success: true,
      pointsAdded: points,
      newBalance: newBalance,
      dollarValue: giftCardRedemptionService.pointsToValue(newBalance),
      message: `Added ${points} points from ${source}`
    });

  } catch (error) {
    logger.error('Error adding points:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add points'
    });
  }
});

/**
 * GET /api/gift-cards/conversion-rate
 * Get points to dollar conversion rate
 */
router.get('/conversion-rate', (req, res) => {
  try {
    res.json({
      success: true,
      rate: {
        pointsPerDollar: 100,
        description: '100 points = $1.00',
        examples: [
          { points: 500, value: 5.00 },
          { points: 1000, value: 10.00 },
          { points: 2500, value: 25.00 }
        ]
      }
    });
  } catch (error) {
    logger.error('Error fetching conversion rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversion rate'
    });
  }
});

export function registerGiftCardRoutes(app: any) {
  app.use('/api/gift-cards', router);
  logger.info('Gift card redemption routes registered successfully');
}

export default router;