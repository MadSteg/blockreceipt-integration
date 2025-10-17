/**
 * Blockchain API Routes for Polygon Amoy
 * 
 * This file defines the API routes for interacting with the Polygon Amoy blockchain.
 */

import express, { Request, Response } from 'express';
import { storage } from '../storage';
import { blockchainService } from '../services/blockchainService-amoy';

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
    res.status(200).json({ 
      available: false,
      mockMode: true,
      error: error?.message || 'Unknown error',
      message: 'Failed to connect to Amoy blockchain, using mock mode'
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
    const updateFields: any = {
      blockchainVerified: true
    };
    
    // Handle different result formats from mock vs real blockchain
    if (result.receipt?.blockchain) {
      // Format from the real blockchain service
      updateFields.nftTokenId = result.receipt.blockchain.tokenId?.toString();
      updateFields.blockchainTxHash = result.receipt.blockchain.transactionHash;
      updateFields.blockNumber = result.receipt.blockchain.blockNumber;
    } else {
      // Format from mock blockchain service
      updateFields.nftTokenId = result.tokenId?.toString();
      updateFields.blockchainTxHash = result.txHash;
      updateFields.blockNumber = result.blockNumber;
    }
    
    await storage.updateReceipt(receiptId, updateFields);
    
    res.json({
      success: true,
      receipt: {
        id: receiptId,
        merchant: receipt.merchant.name,
        date: receipt.date,
        total: receipt.total,
        blockchain: {
          tokenId: updateFields.nftTokenId,
          transactionHash: updateFields.blockchainTxHash,
          blockNumber: updateFields.blockNumber,
          network: result.receipt?.blockchain?.network || 'amoy-mock',
          receiptHash: result.receipt?.blockchain?.receiptHash || 'mock-hash',
          mockMode: result.message ? true : false
        }
      }
    });
  } catch (error: any) {
    console.error('Error minting receipt:', error);
    res.status(500).json({ 
      error: 'Failed to mint receipt', 
      details: error?.message || 'Unknown error',
      mockMode: true
    });
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
          tokenId: result.receipt?.blockchain?.tokenId || tokenId,
          verified: result.verified,
          uri: result.receipt?.blockchain?.uri || `ipfs://QmHash/${tokenId}`,
          receiptHash: result.receipt?.blockchain?.receiptHash || 'mock-hash',
          storedHash: result.receipt?.blockchain?.storedHash || 'mock-hash',
          owner: result.receipt?.blockchain?.owner || 'mock-owner',
          mockMode: result.receipt?.blockchain?.mockMode || false
        }
      }
    });
  } catch (error: any) {
    console.error('Error verifying receipt:', error);
    res.status(500).json({ 
      error: 'Failed to verify receipt', 
      details: error?.message || 'Unknown error',
      mockMode: true,
      verified: false
    });
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
    const updateFields: any = {
      blockchainVerified: true
    };
    
    // Handle different result formats
    if (result.tokenId) {
      updateFields.nftTokenId = result.tokenId?.toString();
      updateFields.blockchainTxHash = result.txHash;
      updateFields.blockNumber = result.blockNumber;
    }
    
    await storage.updateReceipt(receiptId, updateFields);
    
    res.json({
      success: true,
      message: 'Receipt minted using mock Amoy blockchain data',
      txHash: result.txHash,
      tokenId: result.tokenId,
      blockNumber: result.blockNumber,
      encryptionKey: result.encryptionKey,
      ipfsCid: result.ipfsCid,
      ipfsUrl: result.ipfsUrl,
      mockMode: true
    });
  } catch (error: any) {
    console.error('Error mock minting receipt:', error);
    res.status(500).json({ 
      error: 'Failed to mock mint receipt', 
      details: error?.message || 'Unknown error',
      mockMode: true
    });
  }
});

export default router;