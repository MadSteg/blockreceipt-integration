/**
 * Blockchain API Routes
 * 
 * This file defines the API routes for interacting with the blockchain.
 */

import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { blockchainService } from '../services/blockchainService';

const router = express.Router();

/**
 * GET /api/blockchain/status
 * Get blockchain integration status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = await blockchainService.getNetworkStatus();
    res.json(status);
  } catch (error: any) {
    console.error('Error getting blockchain status:', error);
    res.status(500).json({ 
      error: 'Failed to get blockchain status',
      details: error.message,
      available: false
    });
  }
});

/**
 * POST /api/blockchain/mint/:receiptId
 * Mint a receipt as an NFT
 */
router.post('/mint/:receiptId', async (req: Request, res: Response) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    
    // Get the receipt from storage
    const receipt = await storage.getFullReceipt(receiptId);
    
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    // Create receipt hash and mint NFT
    const result = await blockchainService.mintReceipt(receipt);
    
    // Update receipt with blockchain info
    await storage.updateReceipt(receiptId, {
      tokenId: result.tokenId.toString(),
      blockchainTxHash: result.transactionHash,
      blockNumber: result.blockNumber,
      blockchainVerified: true
    });
    
    res.json({
      success: true,
      receipt: {
        id: receiptId,
        merchant: receipt.merchant.name,
        date: receipt.date,
        total: receipt.total,
        blockchain: {
          tokenId: result.tokenId,
          transactionHash: result.transactionHash,
          blockNumber: result.blockNumber,
          network: result.network,
          receiptHash: result.receiptHash,
          mockMode: result.mockMode
        }
      }
    });
  } catch (error: any) {
    console.error('Error minting receipt:', error);
    res.status(500).json({ error: 'Failed to mint receipt', details: error.message });
  }
});

/**
 * GET /api/blockchain/verify/:tokenId
 * Verify a receipt on the blockchain
 */
router.get('/verify/:tokenId', async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;
    
    // Find receipt with this tokenId
    // For now, we'll use receipt #1 for testing
    const receiptId = 1;
    const receipt = await storage.getFullReceipt(receiptId);
    
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    // Verify the receipt on blockchain
    const result = await blockchainService.verifyReceipt(tokenId, receipt);
    
    // Update verification status
    await storage.updateReceipt(receiptId, {
      blockchainVerified: result.verified
    });
    
    res.json({
      success: true,
      verified: result.verified,
      receipt: {
        id: receiptId,
        merchant: receipt.merchant.name,
        date: receipt.date,
        total: receipt.total,
        blockchain: {
          tokenId: result.tokenId,
          verified: result.verified,
          uri: result.uri,
          receiptHash: result.receiptHash,
          storedHash: result.storedHash,
          owner: result.owner,
          mockMode: result.mockMode
        }
      }
    });
  } catch (error: any) {
    console.error('Error verifying receipt:', error);
    res.status(500).json({ error: 'Failed to verify receipt', details: error.message });
  }
});

/**
 * POST /api/blockchain/mock-mint/:receiptId
 * Mint a receipt using mock blockchain data (for testing)
 */
router.post('/mock-mint/:receiptId', async (req: Request, res: Response) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    
    // Get the receipt from storage
    const receipt = await storage.getFullReceipt(receiptId);
    
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    // Create receipt hash and mock mint NFT
    const result = await blockchainService.mintReceipt(receipt);
    
    // Update receipt with blockchain info
    await storage.updateReceipt(receiptId, {
      tokenId: result.tokenId.toString(),
      blockchainTxHash: result.transactionHash,
      blockNumber: result.blockNumber,
      blockchainVerified: true
    });
    
    res.json({
      success: true,
      mockMode: true,
      receipt: {
        id: receiptId,
        merchant: receipt.merchant.name,
        date: receipt.date,
        total: receipt.total,
        blockchain: {
          tokenId: result.tokenId,
          transactionHash: result.transactionHash,
          blockNumber: result.blockNumber,
          network: result.network,
          receiptHash: result.receiptHash,
          mockMode: true
        }
      }
    });
  } catch (error: any) {
    console.error('Error mock minting receipt:', error);
    res.status(500).json({ error: 'Failed to mock mint receipt', details: error.message });
  }
});

export default router;