// Receipt routes with blockchain integration
const express = require('express');
const router = express.Router();
const mockBlockchainService = require('../services/mockBlockchainService');
const { storage } = require('../storage');

// Mock mint a receipt as NFT
router.post('/mock', async (req, res) => {
  try {
    // For demo purposes, use receipt with ID 1
    const receiptId = 1;
    const receipt = await storage.getFullReceipt(receiptId);
    
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    // Call mock blockchain service
    const result = await mockBlockchainService.mintReceipt(receipt);
    
    // Update receipt with blockchain info
    await storage.updateReceipt(receiptId, {
      tokenId: result.tokenId.toString(),
      transactionHash: result.transactionHash,
      blockNumber: result.blockNumber,
      verified: true
    });
    
    res.json({
      success: true,
      message: 'Receipt minted as NFT (mock)',
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
  } catch (error) {
    console.error('Error minting receipt:', error);
    res.status(500).json({ error: 'Failed to mint receipt', details: error.message });
  }
});

// Verify a receipt on the blockchain
router.get('/verify/:id', async (req, res) => {
  try {
    const receiptId = parseInt(req.params.id);
    const receipt = await storage.getFullReceipt(receiptId);
    
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    if (!receipt.tokenId) {
      return res.status(400).json({ error: 'Receipt not minted yet' });
    }
    
    // Call mock blockchain service
    const result = await mockBlockchainService.verifyReceipt(receipt.tokenId, receipt);
    
    // Update receipt verification status
    await storage.updateReceipt(receiptId, {
      verified: result.verified
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
  } catch (error) {
    console.error('Error verifying receipt:', error);
    res.status(500).json({ error: 'Failed to verify receipt', details: error.message });
  }
});

module.exports = router;