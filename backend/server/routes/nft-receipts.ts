import { Router } from 'express';
import { db } from '../db';
import { NFTReceiptTier } from '../../shared/products';
import { storage } from '../storage-real';

const router = Router();

// Create a new NFT receipt
router.post('/create', async (req, res) => {
  try {
    const {
      productId,
      productName,
      merchantId,
      merchantName,
      amount,
      tier = NFTReceiptTier.STANDARD,
      transactionHash,
      paymentMethod,
      currency,
      email
    } = req.body;

    // Validate required fields
    if (!productId || !productName || !merchantId || !merchantName || !amount) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Create receipt record in database
    const receiptData = {
      userId: 1, // TODO: Get from authentication
      merchantName,
      date: new Date(),
      total: Math.round(amount * 100), // Convert to cents
      subtotal: Math.round(amount * 100),
      tax: 0,
      items: [{
        name: productName,
        price: Math.round(amount * 100),
        quantity: 1,
        category: 'Product'
      }],
      category: 'nft-purchase'
    };

    const receipt = await storage.createReceipt(receiptData);
    const receiptId = receipt.id;
    
    // For development, we'll mock the NFT creation
    const mockTokenId = `mock-token-${Date.now()}`;
    const mockIpfsHash = `ipfs://QmMock${Date.now()}`;
    
    console.log(`Creating NFT receipt for product ${productId} with tier ${tier}`);

    // Send receipt response
    res.status(201).json({
      receiptId,
      tokenId: mockTokenId,
      transactionHash: transactionHash || `0x${Date.now().toString(16)}abcdef`,
      ipfsHash: mockIpfsHash,
      tier,
      productId,
      productName,
      merchantId,
      merchantName,
      amount,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to create NFT receipt:', error);
    res.status(500).json({ message: 'Failed to create NFT receipt' });
  }
});

// Get NFT receipt by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const receiptId = parseInt(id);
    
    if (isNaN(receiptId)) {
      return res.status(400).json({ message: 'Invalid receipt ID' });
    }
    
    // Fetch receipt from database
    const receipt = await storage.getReceiptById(receiptId);
    
    if (!receipt) {
      return res.status(404).json({ message: 'Receipt not found' });
    }

    res.json({
      id: receipt.id,
      tokenId: receipt.tokenId || 'pending',
      transactionHash: receipt.txHash || 'pending',
      ipfsHash: receipt.ipfsHash || 'pending',
      tier: NFTReceiptTier.STANDARD,
      productId: `product-${receipt.id}`,
      productName: receipt.items?.[0]?.name || 'Unknown Product',
      merchantId: `merchant-${receipt.merchantName?.toLowerCase().replace(/\s+/g, '-')}`,
      merchantName: receipt.merchantName,
      amount: receipt.total / 100, // Convert from cents
      createdAt: receipt.createdAt
    });
  } catch (error) {
    console.error('Failed to fetch NFT receipt:', error);
    res.status(500).json({ message: 'Failed to fetch NFT receipt' });
  }
});

// Get NFT receipts by wallet address
router.get('/by-wallet/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress || walletAddress.length < 10) {
      return res.status(400).json({ message: 'Invalid wallet address' });
    }
    
    // In a real application, this would fetch from the database
    // For development, we'll return mock data
    res.json([
      {
        id: 1,
        tokenId: 'mock-token-12345',
        transactionHash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        ipfsHash: 'ipfs://QmSampleHash123456789',
        tier: NFTReceiptTier.STANDARD,
        productId: 'product-th-1',
        productName: 'Ultra HD Smart TV 65"',
        merchantId: 'merchant-tech-haven',
        merchantName: 'Tech Haven',
        amount: 0.01,
        createdAt: new Date().toISOString()
      }
    ]);
  } catch (error) {
    console.error('Failed to fetch NFT receipts by wallet:', error);
    res.status(500).json({ message: 'Failed to fetch NFT receipts' });
  }
});

export default router;