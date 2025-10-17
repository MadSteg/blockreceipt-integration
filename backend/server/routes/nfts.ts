/**
 * NFT Routes for BlockReceipt
 * 
 * Handles NFT-related API endpoints including fetching NFTs with coupon data
 */

import { Router } from 'express';
import { createLogger } from '../logger';
import { nftMintService } from '../services/nftMintService';
import { merchantService } from '../services/merchantService';
import { couponService } from '../services/couponService';

const router = Router();
const logger = createLogger('nft-routes');

/**
 * Get all NFTs owned by a wallet address
 * GET /api/nfts
 */
router.get('/', async (req, res) => {
  try {
    const { walletAddress } = req.query;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Wallet address is required'
      });
    }
    
    // In a real implementation, fetch from the blockchain
    // For now, we'll return mock data
    const mockNfts = [
      {
        id: '1',
        tokenId: '1001',
        name: 'Walmart Receipt',
        description: 'Purchase at Walmart on May 12, 2025',
        imageUrl: 'https://ipfs.io/ipfs/QmXyZ123...',
        dateCreated: new Date().toISOString(),
        metadata: {
          merchantName: 'Walmart',
          date: '2025-05-12',
          total: 134.76,
          items: [
            { name: 'Groceries', price: 89.97 },
            { name: 'Electronics', price: 44.79 }
          ]
        }
      },
      {
        id: '2',
        tokenId: '1002',
        name: 'Target Receipt',
        description: 'Purchase at Target on May 14, 2025',
        imageUrl: 'https://ipfs.io/ipfs/QmAbC456...',
        dateCreated: new Date().toISOString(),
        metadata: {
          merchantName: 'Target',
          date: '2025-05-14',
          total: 67.89,
          items: [
            { name: 'Clothing', price: 49.99 },
            { name: 'Home Goods', price: 17.90 }
          ]
        }
      }
    ];
    
    return res.status(200).json(mockNfts);
    
  } catch (error) {
    logger.error(`Error fetching NFTs: ${error}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching NFTs'
    });
  }
});

/**
 * Get merchant-specific coupons for an NFT receipt
 * GET /api/nfts/:id/merchant-coupons
 */
router.get('/:id/merchant-coupons', async (req, res) => {
  try {
    const receiptId = req.params.id;
    
    // In a real implementation, fetch the NFT receipt details first
    // For demo, we'll use mock data to simulate an NFT with merchant data
    const nft = {
      id: receiptId,
      metadata: {
        merchantName: "Costco", // For testing purposes
        total: 149.99,
        date: new Date().toISOString()
      }
    };
    
    if (!nft || !nft.metadata?.merchantName) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found or missing merchant data'
      });
    }
    
    // Extract merchant name from NFT metadata
    const merchantName = nft.metadata.merchantName;
    
    // Identify merchant from name and get active promotions
    const { merchantId, confidence } = await merchantService.identifyMerchantFromReceipt(merchantName);
    
    // If we found a merchant match with high confidence
    if (merchantId && confidence > 0.6) {
      // Get live promotions/coupons from the merchant registry
      const merchantCoupons = await couponService.getMerchantCoupons(merchantId);
      
      return res.json(merchantCoupons);
    }
    
    // If no merchant match found with sufficient confidence, return empty array
    return res.json([]);
    
  } catch (error) {
    logger.error(`Error fetching merchant coupons for NFT: ${error}`);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching merchant coupons'
    });
  }
});

/**
 * Get NFTs with coupon data
 * GET /api/nfts/with-coupons
 */
router.get('/with-coupons', async (req, res) => {
  try {
    // In a real implementation, we would fetch NFTs with coupons from the blockchain
    // For demo purposes, we generate diverse coupon data
    
    // Create mock data with a mix of active and expired coupons
    const now = Date.now();
    const twoWeeksMs = 14 * 24 * 60 * 60 * 1000;
    
    // Generate a variety of merchants for rich demo experience
    const merchants = [
      { name: 'Costco', code: 'COSTCO25', total: 231.45, date: '2025-05-14' },
      { name: 'Target', code: 'TARGET10', total: 87.99, date: '2025-05-12' },
      { name: 'Walmart', code: 'WALMART15', total: 134.56, date: '2025-04-27' },
      { name: 'Best Buy', code: 'BESTBUY20', total: 349.99, date: '2025-05-16' },
      { name: 'Apple Store', code: 'APPLE50', total: 1299.99, date: '2025-05-15' },
      { name: 'Home Depot', code: 'HOMEDEP15', total: 189.75, date: '2025-05-10' },
      { name: 'Whole Foods', code: 'WHOLEFDS', total: 78.45, date: '2025-05-13' },
      { name: 'Amazon', code: 'AMZPRIME', total: 156.78, date: '2025-05-11' },
      { name: 'Starbucks', code: 'SBUX10', total: 23.85, date: '2025-05-17' }
    ];
    
    // Generate tiers, rarities, and point values for gamification
    const tiers = ['Silver', 'Gold', 'Premium', 'Platinum'];
    const rarities = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'];
    
    // Create a mix of active and expired coupons
    const mockNfts = [];
    
    // Generate active offers (5-7)
    const activeCount = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < activeCount; i++) {
      const merchant = merchants[i % merchants.length];
      const tier = tiers[Math.floor(Math.random() * tiers.length)];
      const rarity = rarities[Math.floor(Math.random() * rarities.length)];
      const pointValue = 20 + Math.floor(Math.random() * 80); // 20-100 points
      const daysAgo = Math.floor(Math.random() * 7); // 0-6 days ago
      
      mockNfts.push({
        id: `${i + 1}`,
        tokenId: `100${i + 1}`,
        name: merchant.name,
        imageUrl: `https://ipfs.io/ipfs/Qm${Math.random().toString(36).substring(2, 15)}...`,
        dateCreated: new Date(now - (daysAgo * 24 * 60 * 60 * 1000)).toISOString(),
        metadata: {
          merchantName: merchant.name,
          date: merchant.date,
          total: merchant.total,
          coupon: {
            capsule: `capsule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            ciphertext: Buffer.from(merchant.code).toString('base64'),
            policyId: `policy_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            validUntil: now + twoWeeksMs - (Math.random() * twoWeeksMs / 2), // Random future date
            tier,
            rarity,
            pointValue
          }
        }
      });
    }
    
    // Generate expired offers (2-4)
    const expiredCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < expiredCount; i++) {
      const merchant = merchants[(i + activeCount) % merchants.length];
      const tier = tiers[Math.floor(Math.random() * (tiers.length - 1))]; // Lower tiers for expired
      const rarity = rarities[Math.floor(Math.random() * 3)]; // Common/Uncommon/Rare for expired
      const pointValue = 10 + Math.floor(Math.random() * 30); // 10-40 points
      const daysAgo = 10 + Math.floor(Math.random() * 20); // 10-30 days ago
      
      mockNfts.push({
        id: `${i + activeCount + 1}`,
        tokenId: `100${i + activeCount + 1}`,
        name: merchant.name,
        imageUrl: `https://ipfs.io/ipfs/Qm${Math.random().toString(36).substring(2, 15)}...`,
        dateCreated: new Date(now - (daysAgo * 24 * 60 * 60 * 1000)).toISOString(),
        metadata: {
          merchantName: merchant.name,
          date: new Date(now - (daysAgo * 24 * 60 * 60 * 1000)).toISOString().split('T')[0],
          total: merchant.total,
          coupon: {
            capsule: `capsule_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`,
            ciphertext: Buffer.from(merchant.code).toString('base64'),
            policyId: `policy_expired_${Math.random().toString(36).substring(2, 15)}`,
            validUntil: now - (Math.random() * twoWeeksMs / 2), // Random past date
            tier,
            rarity,
            pointValue
          }
        }
      });
    }
    
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