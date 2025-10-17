import express, { Request, Response } from 'express';
import { nftPurchaseBot } from '../services/nftPurchaseBot';
import { marketplaceService } from '../services/marketplaceService';

const router = express.Router();

/**
 * Endpoint to check if a user is eligible for an NFT gift
 * GET /api/nft-bot/eligible/:walletAddress
 */
router.get('/eligible/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid wallet address' 
      });
    }
    
    const isEligible = await nftPurchaseBot.isUserEligible(walletAddress);
    
    return res.status(200).json({
      success: true,
      isEligible,
      message: isEligible 
        ? 'User is eligible for an NFT gift' 
        : 'User has already claimed an NFT in the last 24 hours'
    });
  } catch (error: any) {
    console.error('Error checking eligibility:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check eligibility',
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * Endpoint to trigger NFT purchase and transfer after receipt upload
 * POST /api/nft-bot/purchase
 * Body: { walletAddress, receiptId, receiptData }
 */
router.post('/purchase', async (req: Request, res: Response) => {
  try {
    const { walletAddress, receiptId, receiptData } = req.body;
    
    // Validate required fields
    if (!walletAddress || !walletAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid wallet address' 
      });
    }
    
    if (!receiptId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Receipt ID is required' 
      });
    }
    
    if (!receiptData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Receipt data is required' 
      });
    }
    
    // Check if receipt total meets minimum threshold ($5.00)
    const total = parseFloat(receiptData.total || '0');
    if (total < 5.00) {
      return res.status(200).json({
        success: false,
        message: 'Receipt total does not meet minimum threshold of $5.00 for NFT gift',
        receiptData
      });
    }
    
    // Determine receipt tier for logging purposes
    const { tier } = marketplaceService.determineNFTBudget(total);
    
    console.log(`Processing NFT purchase for receipt with total $${total.toFixed(2)} (Tier: ${tier})`);
    
    // Attempt to purchase an NFT from a marketplace and transfer it to the user
    const result = await nftPurchaseBot.purchaseAndTransferNFT(
      walletAddress,
      receiptId,
      receiptData
    );
    
    // If marketplace purchase fails, fall back to minting our own NFT
    if (!result.success && result.error?.includes('No affordable NFTs found')) {
      console.log('No affordable NFTs found on marketplaces, falling back to custom NFT minting');
      const fallbackResult = await nftPurchaseBot.mintFallbackNFT(
        walletAddress,
        receiptId,
        receiptData
      );
      
      return res.status(fallbackResult.success ? 200 : 500).json({
        ...fallbackResult,
        receiptData,
        fallback: true,
        message: 'Created a custom BlockReceipt NFT (no suitable marketplace NFTs found)',
        tier: fallbackResult.tier || tier
      });
    }
    
    if (result.success) {
      console.log(`Successfully purchased NFT for wallet ${walletAddress}: ${result.name} (${result.tokenId})`);
      if (result.creator && result.creatorName) {
        console.log(`Creator info: ${result.creatorName} (${result.creator})`);
      }
    }
    
    return res.status(result.success ? 200 : 500).json({
      ...result,
      receiptData,
      artist: result.creatorName,
      artistWallet: result.creator,
      tier: result.tier || tier,
      message: result.success 
        ? `Successfully purchased NFT from an emerging artist: ${result.creatorName || 'Unknown Artist'}`
        : 'Failed to purchase NFT from marketplace'
    });
  } catch (error: any) {
    console.error('Error during NFT purchase process:', error);
    return res.status(500).json({
      success: false,
      message: 'NFT purchase process failed',
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * Endpoint to get transaction info for a specific NFT purchase
 * GET /api/nft-bot/transaction/:txHash
 */
router.get('/transaction/:txHash', async (req: Request, res: Response) => {
  try {
    const { txHash } = req.params;
    
    // In a real implementation, this would query the blockchain
    // For now, return simulated data
    const simulatedTransaction = {
      hash: txHash,
      blockNumber: 12345678,
      timestamp: Date.now(),
      from: process.env.NFT_BOT_WALLET_ADDRESS || '0x1234567890123456789012345678901234567890',
      to: req.query.walletAddress || '0x0000000000000000000000000000000000000000',
      status: 'confirmed',
      gasUsed: '100000',
      effectiveGasPrice: '5000000000'
    };
    
    return res.status(200).json({
      success: true,
      transaction: simulatedTransaction
    });
  } catch (error: any) {
    console.error('Error getting transaction info:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get transaction info',
      error: error.message || 'Unknown error'
    });
  }
});

/**
 * Endpoint to browse available NFTs based on receipt data
 * This can be used to show what might be purchased before confirming
 * POST /api/nft-bot/browse
 * Body: { receiptData, limit }
 */
router.post('/browse', async (req: Request, res: Response) => {
  try {
    const { receiptData, limit = 5 } = req.body;
    
    if (!receiptData) {
      return res.status(400).json({
        success: false,
        message: 'Receipt data is required'
      });
    }
    
    // Extract receipt details
    const total = parseFloat(receiptData.total || '0');
    const category = marketplaceService.categorizeReceipt(receiptData);
    const { tier, budget } = marketplaceService.determineNFTBudget(total);
    
    // Fetch marketplace NFTs based on the receipt
    const nfts = await marketplaceService.fetchMarketplaceNFTs({
      maxPrice: budget,
      category,
      includeUnverified: true,
      sort: 'recent',
      filters: ['lowVolume', 'indieArtist'],
      limit: limit
    });
    
    return res.status(200).json({
      success: true,
      tier,
      budget,
      category,
      nfts
    });
  } catch (error: any) {
    console.error('Error browsing NFTs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to browse NFTs',
      error: error.message || 'Unknown error'
    });
  }
});

export default router;