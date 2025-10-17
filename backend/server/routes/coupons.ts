/**
 * Coupon routes for BlockReceipt
 * 
 * Handles coupon-related API endpoints including decryption
 * of time-limited coupons using Threshold PRE
 */

import { Router } from 'express';
import { couponService } from '../services/couponService';
import { createLogger } from '../logger';

const router = Router();
const logger = createLogger('coupon-routes');

/**
 * Endpoint to decrypt a coupon
 * POST /api/coupons/decrypt
 */
router.post('/decrypt', async (req, res) => {
  try {
    const { capsule, ciphertext, policyId } = req.body;
    
    if (!capsule || !ciphertext || !policyId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters: capsule, ciphertext, or policyId'
      });
    }
    
    logger.info(`Attempting to decrypt coupon with policy ID: ${policyId}`);
    
    // Call coupon service to decrypt the data
    const result = await couponService.decryptCoupon({
      capsule,
      ciphertext,
      policyId
    });
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        couponCode: result.couponCode,
        message: 'Coupon successfully decrypted'
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to decrypt coupon'
      });
    }
  } catch (error) {
    logger.error(`Error decrypting coupon: ${error}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while decrypting coupon'
    });
  }
});

/**
 * Endpoint to fetch NFTs with coupons
 * GET /api/coupons/nfts
 */
router.get('/nfts', async (req, res) => {
  try {
    // In a real implementation, we would fetch NFTs with coupons from a database
    // For now, we'll return mock data
    
    // Create mock data with a mix of active and expired coupons
    const now = Date.now();
    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
    
    const mockNfts = [
      {
        id: '1',
        tokenId: '1001',
        name: 'Costco',
        metadata: {
          coupon: {
            capsule: `capsule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            ciphertext: Buffer.from('OFF123ABC_25').toString('base64'),
            policyId: `policy_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            validUntil: now + twoWeeksMs // Active
          }
        }
      },
      {
        id: '2',
        tokenId: '1002',
        name: 'Target',
        metadata: {
          coupon: {
            capsule: `capsule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            ciphertext: Buffer.from('OFFTARGET_10').toString('base64'),
            policyId: `policy_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            validUntil: now + (twoWeeksMs / 2) // Active
          }
        }
      },
      {
        id: '3',
        tokenId: '1003',
        name: 'Walmart',
        metadata: {
          coupon: {
            capsule: `capsule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            ciphertext: Buffer.from('OFFEXPIRED_15').toString('base64'),
            policyId: `policy_expired_${Math.random().toString(36).substring(2, 15)}`,
            validUntil: now - (twoWeeksMs / 2) // Expired
          }
        }
      }
    ];
    
    return res.status(200).json(mockNfts);
  } catch (error) {
    logger.error(`Error fetching NFTs with coupons: ${error}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching NFTs with coupons'
    });
  }
});

export default router;