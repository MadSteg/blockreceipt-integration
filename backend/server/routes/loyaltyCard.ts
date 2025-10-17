import type { Express } from "express";
import { loyaltyCardService } from "../services/loyaltyCardService";
import { createLogger } from "../logger";

const logger = createLogger('loyalty-routes');

export function registerLoyaltyCardRoutes(app: Express) {
  
  // Get user's loyalty card info
  app.get('/api/loyalty/user/:userAddress', async (req, res) => {
    try {
      const { userAddress } = req.params;
      
      if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user address format'
        });
      }
      
      const loyaltyInfo = await loyaltyCardService.getUserLoyaltyInfo(userAddress);
      
      res.json({
        success: true,
        data: loyaltyInfo
      });
      
    } catch (error) {
      logger.error('Error fetching user loyalty info:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch loyalty information'
      });
    }
  });
  
  // Check redemption eligibility for a specific merchant
  app.get('/api/loyalty/redeem-check/:userAddress/:merchantAddress', async (req, res) => {
    try {
      const { userAddress, merchantAddress } = req.params;
      
      if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user address format'
        });
      }
      
      if (!merchantAddress || !/^0x[a-fA-F0-9]{40}$/.test(merchantAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid merchant address format'
        });
      }
      
      const redemptionInfo = await loyaltyCardService.canUserRedeem(userAddress, merchantAddress);
      
      res.json({
        success: true,
        data: redemptionInfo
      });
      
    } catch (error) {
      logger.error('Error checking redemption eligibility:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check redemption eligibility'
      });
    }
  });
  
  // Redeem a reward
  app.post('/api/loyalty/redeem', async (req, res) => {
    try {
      const { userAddress, merchantAddress } = req.body;
      
      if (!userAddress || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid user address format'
        });
      }
      
      if (!merchantAddress || !/^0x[a-fA-F0-9]{40}$/.test(merchantAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid merchant address format'
        });
      }
      
      const txHash = await loyaltyCardService.redeemReward(userAddress, merchantAddress);
      
      res.json({
        success: true,
        data: {
          txHash,
          message: 'Reward redeemed successfully'
        }
      });
      
    } catch (error) {
      logger.error('Error redeeming reward:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to redeem reward'
      });
    }
  });
  
  // Authorize a new merchant (admin only)
  app.post('/api/loyalty/authorize-merchant', async (req, res) => {
    try {
      const { merchantAddress, merchantName, redemptionThreshold } = req.body;
      
      if (!merchantAddress || !/^0x[a-fA-F0-9]{40}$/.test(merchantAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid merchant address format'
        });
      }
      
      if (!merchantName || merchantName.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Merchant name is required'
        });
      }
      
      if (!redemptionThreshold || redemptionThreshold < 1) {
        return res.status(400).json({
          success: false,
          error: 'Redemption threshold must be at least 1'
        });
      }
      
      const txHash = await loyaltyCardService.authorizeMerchant(
        merchantAddress,
        merchantName,
        redemptionThreshold
      );
      
      res.json({
        success: true,
        data: {
          txHash,
          message: 'Merchant authorized successfully'
        }
      });
      
    } catch (error) {
      logger.error('Error authorizing merchant:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to authorize merchant'
      });
    }
  });
  
  logger.info('Loyalty card routes registered successfully');
}