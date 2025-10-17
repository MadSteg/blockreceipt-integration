import { Router } from 'express';
import { storage } from '../storage.js';
import { blockchainService } from '../lib/blockchain.js';

const router = Router();

/**
 * GET /api/blockchain/status
 * Get blockchain integration status
 */
router.get('/status', async (req, res) => {
  try {
    const status = await blockchainService.getNetworkInfo();
    res.json(status);
  } catch (error) {
    console.error('Error getting blockchain status:', error);
    res.status(500).json({ error: 'Failed to get blockchain status' });
  }
});

/**
 * POST /api/blockchain/mint/:receiptId
 * Mint a receipt as an NFT
 */
router.post('/mint/:receiptId', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    const receipt = await storage.getFullReceipt(receiptId);

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const result = await blockchainService.mintReceiptNFT(receipt, receipt.items);

    // Update receipt with blockchain info
    await storage.updateReceipt(receiptId, {
      tokenId: result.tokenId,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      network: result.network,
      verified: true
    });

    res.json({
      success: true,
      tokenId: result.tokenId,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      network: result.network,
      mockMode: result.mockMode
    });
  } catch (error) {
    console.error('Error minting receipt:', error);
    res.status(500).json({ error: 'Failed to mint receipt' });
  }
});

/**
 * GET /api/blockchain/verify/:receiptId
 * Verify a receipt on the blockchain
 */
router.get('/verify/:receiptId', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    const receipt = await storage.getFullReceipt(receiptId);

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    if (!receipt.tokenId) {
      return res.status(400).json({ error: 'Receipt not minted yet' });
    }

    const result = await blockchainService.verifyReceipt(receipt.tokenId, receipt);
    
    // Update receipt verification status
    await storage.updateReceipt(receiptId, {
      verified: result.verified
    });

    res.json({
      success: true,
      verified: result.verified,
      tokenId: result.tokenId,
      uri: result.uri,
      receiptHash: result.receiptHash,
      storedHash: result.storedHash,
      owner: result.owner,
      mockMode: result.mockMode
    });
  } catch (error) {
    console.error('Error verifying receipt:', error);
    res.status(500).json({ error: 'Failed to verify receipt' });
  }
});

/**
 * POST /api/blockchain/mock-mint/:receiptId
 * Mint a receipt using mock blockchain data (for testing)
 */
router.post('/mock-mint/:receiptId', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    const receipt = await storage.getFullReceipt(receiptId);

    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    const result = await blockchainService.mockMintReceipt(receipt, receipt.items);

    // Update receipt with mock blockchain info
    await storage.updateReceipt(receiptId, {
      tokenId: result.tokenId,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      network: result.network,
      verified: true
    });

    res.json({
      success: true,
      tokenId: result.tokenId,
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      network: result.network,
      mockMode: true
    });
  } catch (error) {
    console.error('Error mock minting receipt:', error);
    res.status(500).json({ error: 'Failed to mock mint receipt' });
  }
});

export default router;