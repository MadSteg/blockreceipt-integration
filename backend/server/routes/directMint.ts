import express from 'express';
import { nftMintService } from '../services/nftMintService';
import { logger } from '../utils/logger';

const router = express.Router();

// Direct mint endpoint for testing enriched metadata
router.post('/', async (req, res) => {
  try {
    const { merchantName, totalAmount, currency, walletAddress, items } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ 
        success: false, 
        message: 'Wallet address is required' 
      });
    }

    if (!merchantName || !totalAmount || !items) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required fields: merchantName, totalAmount, items' 
      });
    }

    // Create receipt data for minting
    const receiptData = {
      id: `receipt-${Date.now()}`,
      merchantName,
      date: new Date().toISOString().split('T')[0],
      total: parseFloat(totalAmount),
      items: items.map((item: any) => ({
        name: item.name,
        quantity: parseInt(item.quantity),
        price: parseFloat(item.price)
      })),
      category: 'Food & Beverage'
    };

    logger.info(`Direct minting NFT for ${merchantName} - $${totalAmount}`);

    // Mint the NFT with enriched metadata
    const result = await nftMintService.mintReceiptNFT(receiptData, {
      wallet: walletAddress
    });

    res.json({
      success: true,
      message: 'NFT minted successfully with enriched metadata',
      result
    });

  } catch (error: any) {
    logger.error(`Direct mint error: ${error.message}`);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;