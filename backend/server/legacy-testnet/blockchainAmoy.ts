/**
 * Blockchain API Routes for Polygon Amoy Testnet
 * 
 * This file defines the API routes for interacting with the Polygon Amoy blockchain.
 */
import express, { Request, Response } from 'express';
import { blockchainServiceAmoy } from '../services/blockchainServiceAmoy';
import { storage } from '../storage';

const router = express.Router();

/**
 * GET /api/blockchain/amoy/status
 * Get blockchain integration status for Amoy testnet
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await blockchainServiceAmoy.isAvailable();
    res.json(status);
  } catch (error) {
    console.error('Error getting blockchain status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get blockchain status',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/blockchain/amoy/mint/:receiptId
 * Mint a receipt as an NFT on Amoy blockchain
 */
router.post('/mint/:receiptId', async (req: Request, res: Response) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    
    if (isNaN(receiptId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid receipt ID'
      });
    }
    
    // Get receipt from storage
    const receipt = await storage.getReceipt(receiptId);
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: 'Receipt not found'
      });
    }
    
    // Check if receipt already has blockchain data
    if (receipt.blockchainTxHash || receipt.blockchainTokenId) {
      return res.status(400).json({
        success: false,
        error: 'Receipt already minted to blockchain',
        receiptId,
        blockchainTxHash: receipt.blockchainTxHash,
        blockchainTokenId: receipt.blockchainTokenId
      });
    }
    
    // Get receipt items
    const receiptItems = await storage.getReceiptItems(receiptId);
    
    // Get full receipt with merchant and category details
    const fullReceipt = await storage.getFullReceipt(receiptId);
    
    if (!fullReceipt) {
      return res.status(404).json({
        success: false,
        error: 'Full receipt details not found'
      });
    }
    
    // Mint receipt to blockchain
    const mintResult = await blockchainServiceAmoy.mintReceiptNFT(fullReceipt, receiptItems);
    
    if (!mintResult.success) {
      return res.status(500).json({
        success: false,
        error: 'Failed to mint receipt',
        details: mintResult.error
      });
    }
    
    // Update receipt with blockchain data
    if (mintResult.success && !mintResult.error) {
      // Update the database with blockchain data
      // The fields might be different depending on mock mode vs real mode
      const blockchainTxHash = mintResult.txHash || (mintResult.receipt?.blockchain?.transactionHash);
      const blockchainTokenId = mintResult.tokenId?.toString() || (mintResult.receipt?.blockchain?.tokenId);
      
      if (blockchainTxHash && blockchainTokenId) {
        await storage.updateReceipt(receiptId, {
          blockchainTxHash,
          nftTokenId: blockchainTokenId
        });
      }
    }
    
    res.json(mintResult);
  } catch (error) {
    console.error('Error minting receipt to blockchain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mint receipt',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/blockchain/amoy/verify/:tokenId
 * Verify a receipt on the Amoy blockchain
 */
router.get('/verify/:tokenId', async (req: Request, res: Response) => {
  try {
    const tokenId = parseInt(req.params.tokenId);
    
    if (isNaN(tokenId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid token ID'
      });
    }
    
    // Find receipt by blockchain token ID
    let receipt;
    const receipts = await storage.getReceipts(1); // Assuming user ID 1 for now
    
    for (const r of receipts) {
      if (r.blockchainTokenId === tokenId.toString()) {
        receipt = r;
        break;
      }
    }
    
    // If receipt found, get full details
    let fullReceipt;
    
    if (receipt) {
      fullReceipt = await storage.getFullReceipt(receipt.id);
    }
    
    // Verify receipt on blockchain
    const verifyResult = await blockchainServiceAmoy.verifyReceipt(tokenId, fullReceipt);
    
    res.json(verifyResult);
  } catch (error) {
    console.error('Error verifying receipt on blockchain:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify receipt',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/blockchain/amoy/mock-mint/:receiptId
 * Mint a receipt using mock blockchain data (for testing)
 */
router.post('/mock-mint/:receiptId', async (req: Request, res: Response) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    
    if (isNaN(receiptId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid receipt ID'
      });
    }
    
    // Get receipt from storage
    const receipt = await storage.getReceipt(receiptId);
    
    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: 'Receipt not found'
      });
    }
    
    // Get receipt items
    const receiptItems = await storage.getReceiptItems(receiptId);
    
    // Get full receipt with merchant and category details
    const fullReceipt = await storage.getFullReceipt(receiptId);
    
    if (!fullReceipt) {
      return res.status(404).json({
        success: false,
        error: 'Full receipt details not found'
      });
    }
    
    // Mock mint receipt to blockchain
    const mockMintResult = await blockchainServiceAmoy.mockMintReceipt(fullReceipt, receiptItems);
    
    // Update receipt with mock blockchain data
    if (mockMintResult.success) {
      await storage.updateReceipt(receiptId, {
        blockchainTxHash: mockMintResult.txHash,
        nftTokenId: mockMintResult.tokenId.toString()
      });
    }
    
    res.json(mockMintResult);
  } catch (error) {
    console.error('Error mock minting receipt:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mock mint receipt',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;