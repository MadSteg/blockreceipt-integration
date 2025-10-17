/**
 * NFT Procurement API Routes
 * 
 * These routes handle the new NFT procurement system that buys NFTs from OpenSea
 * and associates encrypted receipt metadata with them.
 */

import express from 'express';
import { nftProcurementService } from '../services/nftProcurementService';
import { nftPurchaseBot } from '../services/nftPurchaseBot';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * Procure NFT from OpenSea with encrypted receipt metadata
 * POST /api/nft-procurement/procure
 */
router.post('/procure', async (req, res) => {
  try {
    const { 
      walletAddress, 
      receiptData, 
      recipientPublicKey 
    } = req.body;
    
    // Validate required fields
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid wallet address is required' 
      });
    }
    
    if (!receiptData || !receiptData.merchantName || !receiptData.total) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid receipt data is required' 
      });
    }
    
    if (!recipientPublicKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'Recipient public key is required for encryption' 
      });
    }
    
    // Check if receipt total meets minimum threshold
    const total = parseFloat(receiptData.total || '0');
    if (total < 5.00) {
      return res.status(200).json({
        success: false,
        message: 'Receipt total does not meet minimum threshold of $5.00 for NFT procurement',
        receiptData
      });
    }
    
    logger.info(`Processing NFT procurement for wallet ${walletAddress}, total: $${total}`);
    
    // Use the new procurement service
    const result = await nftPurchaseBot.procureNFTWithMetadata(
      walletAddress,
      receiptData,
      recipientPublicKey
    );
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'NFT procurement failed',
        receiptData
      });
    }
    
    // Return success response with NFT details
    res.json({
      success: true,
      message: 'NFT successfully procured from OpenSea with encrypted metadata',
      nft: {
        tokenId: result.tokenId,
        contractAddress: result.contractAddress,
        name: result.name,
        imageUrl: result.imageUrl,
        price: result.price,
        marketplace: result.marketplace,
        txHash: result.txHash,
        encryptedMetadata: result.encryptedMetadata,
        fallbackUsed: result.fallbackUsed
      },
      receiptData
    });
    
  } catch (error: any) {
    logger.error('NFT procurement error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Internal server error during NFT procurement'
    });
  }
});

/**
 * Get available NFTs for a receipt (preview before procurement)
 * POST /api/nft-procurement/preview
 */
router.post('/preview', async (req, res) => {
  try {
    const { receiptData } = req.body;
    
    if (!receiptData || !receiptData.merchantName || !receiptData.total) {
      return res.status(400).json({ 
        success: false, 
        message: 'Valid receipt data is required' 
      });
    }
    
    const total = parseFloat(receiptData.total || '0');
    if (total < 5.00) {
      return res.status(200).json({
        success: false,
        message: 'Receipt total does not meet minimum threshold of $5.00',
        availableNFTs: []
      });
    }
    
    // Determine budget and category
    const { marketplaceService } = await import('../services/marketplaceService');
    const category = marketplaceService.categorizeReceipt(receiptData);
    const { tier, budget } = marketplaceService.determineNFTBudget(total);
    
    // Search for available NFTs
    const searchOptions = {
      maxPrice: budget * 2000, // Convert ETH to USD
      category: category,
      limit: 5
    };
    
    const availableNFTs = await marketplaceService.fetchMarketplaceNFTs(searchOptions);
    
    res.json({
      success: true,
      message: `Found ${availableNFTs.length} available NFTs for your receipt`,
      budget: {
        tier,
        budget: `${budget} ETH ($${(budget * 2000).toFixed(2)})`
      },
      category,
      availableNFTs: availableNFTs.map(nft => ({
        id: nft.id,
        name: nft.name,
        description: nft.description,
        imageUrl: nft.imageUrl,
        price: nft.price,
        priceUsd: nft.priceUsd,
        marketplace: nft.marketplace,
        collectionName: nft.collectionName,
        url: nft.url
      }))
    });
    
  } catch (error: any) {
    logger.error('NFT preview error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching available NFTs'
    });
  }
});

/**
 * Decrypt receipt metadata for a procured NFT
 * POST /api/nft-procurement/decrypt
 */
router.post('/decrypt', async (req, res) => {
  try {
    const { 
      nftTokenId, 
      nftContractAddress, 
      userPrivateKey 
    } = req.body;
    
    if (!nftTokenId || !nftContractAddress || !userPrivateKey) {
      return res.status(400).json({ 
        success: false, 
        message: 'NFT token ID, contract address, and user private key are required' 
      });
    }
    
    // Decrypt the receipt metadata
    const decryptedMetadata = await nftProcurementService.decryptReceiptMetadata(
      nftTokenId,
      nftContractAddress,
      userPrivateKey
    );
    
    if (!decryptedMetadata) {
      return res.status(404).json({
        success: false,
        message: 'Receipt metadata not found or could not be decrypted'
      });
    }
    
    res.json({
      success: true,
      message: 'Receipt metadata successfully decrypted',
      receiptMetadata: decryptedMetadata
    });
    
  } catch (error: any) {
    logger.error('Metadata decryption error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error decrypting receipt metadata'
    });
  }
});

export default router;
