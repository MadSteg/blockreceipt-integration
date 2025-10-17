import { Router } from 'express';
import { receiptRewardsService } from '../services/receiptRewards';
import { walletCreationService } from '../services/walletCreation';
import { createLogger } from '../logger';

const router = Router();
const logger = createLogger('pos-integration');

/**
 * POST /api/pos/mint-receipt
 * POS endpoint: Customer selects "Mint BlockReceipt" at checkout
 */
router.post('/mint-receipt', async (req, res) => {
  try {
    const {
      merchantId,
      merchantName,
      customerPhone,
      customerEmail,
      totalAmount,
      items,
      transactionId
    } = req.body;

    // Validate required fields
    if (!merchantId || !totalAmount || !items || (!customerPhone && !customerEmail)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: merchantId, totalAmount, items, and customerPhone or customerEmail'
      });
    }

    // Generate customer ID from phone/email
    const customerContact = customerPhone || customerEmail;
    const customerId = walletCreationService.generateCustomerId(customerContact);

    // Calculate rewards based on items (Fetch-like system)
    const rewards = receiptRewardsService.calculateRewards(merchantId, totalAmount, items);
    const fetchOffers = receiptRewardsService.findFetchLikeOffers(items);

    // Create receipt data for NFT metadata
    const receiptData = {
      transactionId: transactionId || `txn_${Date.now()}`,
      merchantId,
      merchantName: merchantName || 'Unknown Merchant',
      amount: totalAmount,
      currency: 'USD',
      items,
      timestamp: new Date().toISOString(),
      customerContact: customerContact,
      rewards: {
        basePoints: rewards.basePoints,
        bonusPoints: rewards.bonusPoints,
        totalPoints: rewards.totalPoints,
        qualifyingItems: rewards.qualifyingItems,
        fetchOffers: fetchOffers
      }
    };

    // Mint NFT with wallet creation
    const mintResult = await walletCreationService.mintReceiptNFT(
      customerId,
      receiptData,
      rewards.totalPoints
    );

    logger.info(`[pos] Receipt NFT processed for ${customerContact}: ${rewards.totalPoints} points earned`);

    // Return POS response
    res.json({
      success: true,
      message: 'BlockReceipt NFT minted successfully',
      data: {
        walletAddress: mintResult.walletAddress,
        nftTokenId: mintResult.tokenId,
        nftImageUrl: mintResult.nftImageUrl,
        transactionHash: mintResult.transactionHash,
        rewardPoints: rewards.totalPoints,
        basePoints: rewards.basePoints,
        bonusPoints: rewards.bonusPoints,
        qualifyingOffers: fetchOffers,
        receiptData: {
          transactionId: receiptData.transactionId,
          merchantName: receiptData.merchantName,
          amount: receiptData.amount,
          timestamp: receiptData.timestamp
        }
      }
    });

  } catch (error) {
    logger.error('[pos] Error processing receipt mint:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process receipt NFT',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/pos/merchant-specials/:merchantId
 * Get current special offers for a merchant (for POS display)
 */
router.get('/merchant-specials/:merchantId', (req, res) => {
  try {
    const { merchantId } = req.params;
    const merchantRewards = receiptRewardsService.getMerchantRewards(merchantId);

    if (!merchantRewards) {
      return res.json({
        success: true,
        merchantId,
        specials: [],
        basePointsPerDollar: 5 // Default
      });
    }

    const activeSpecials = merchantRewards.specialItems
      .filter(item => item.isActive)
      .map(item => ({
        itemName: item.itemName,
        category: item.category,
        rewardPoints: item.rewardPoints,
        description: item.description,
        bonusMultiplier: item.bonusMultiplier
      }));

    res.json({
      success: true,
      merchantId,
      merchantName: merchantRewards.merchantName,
      basePointsPerDollar: merchantRewards.basePointsPerDollar,
      welcomeBonus: merchantRewards.welcomeBonus,
      specials: activeSpecials
    });

  } catch (error) {
    logger.error('[pos] Error fetching merchant specials:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch merchant specials'
    });
  }
});

/**
 * GET /api/pos/customer-wallet/:customerContact
 * Check if customer has existing wallet and NFTs
 */
router.get('/customer-wallet/:customerContact', (req, res) => {
  try {
    const { customerContact } = req.params;
    const customerId = walletCreationService.generateCustomerId(customerContact);
    const wallet = walletCreationService.getCustomerWallet(customerId);

    if (!wallet) {
      return res.json({
        success: true,
        hasWallet: false,
        message: 'New customer - wallet will be created on first purchase'
      });
    }

    res.json({
      success: true,
      hasWallet: true,
      walletAddress: wallet.address,
      createdAt: wallet.createdAt,
      message: 'Existing customer wallet found'
    });

  } catch (error) {
    logger.error('[pos] Error checking customer wallet:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check customer wallet'
    });
  }
});

/**
 * POST /api/pos/test-receipt
 * Test endpoint for POS integration
 */
router.post('/test-receipt', async (req, res) => {
  try {
    // Sample receipt data
    const testData = {
      merchantId: 'coffee-shop-1',
      merchantName: 'Downtown Coffee Co.',
      customerPhone: '+1234567890',
      totalAmount: 15.75,
      items: [
        { name: 'Specialty Latte', price: 5.50 },
        { name: 'Breakfast Sandwich', price: 7.25 },
        { name: 'Chocolate Donut', price: 3.00 }
      ],
      transactionId: `test_${Date.now()}`
    };

    // Process through mint endpoint
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/pos/mint-receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    const result = await response.json();
    
    res.json({
      success: true,
      testData,
      result,
      message: 'Test receipt processed successfully'
    });

  } catch (error) {
    logger.error('[pos] Error in test receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Test receipt failed'
    });
  }
});

export function registerPOSRoutes(app: any) {
  app.use('/api/pos', router);
  logger.info('POS integration routes registered successfully');
}

export default router;