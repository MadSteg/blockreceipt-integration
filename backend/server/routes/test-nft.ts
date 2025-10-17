import express from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Minimum validation for test NFT minting data
const testMintSchema = z.object({
  nftId: z.string(),
  walletAddress: z.string(),
  receiptData: z.object({
    merchantName: z.string().optional(),
    date: z.string().optional(),
    total: z.number().optional(),
    category: z.string().optional()
  }).optional()
});

// In-memory collection of minted test NFTs for development
const testMintedNFTs = new Map();

// Endpoint to mint a test NFT (development only)
router.post('/mint-test-nft', async (req, res) => {
  try {
    // Validate the request body
    const validationResult = testMintSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid mint data',
        errors: validationResult.error.errors
      });
    }

    const { nftId, walletAddress, receiptData } = validationResult.data;
    
    // For development, we're using a simple mock implementation
    // In production, this would interact with the blockchain contract
    
    // Generate a token ID for the NFT
    const tokenId = uuidv4();
    
    // Assign a random image from the receipt-themed NFT collection
    // In production, this would be determined by contract logic
    const nftImages = [
      '/nft-images/receipt-guardian.svg',
      '/nft-images/digital-shopper.svg',
      '/nft-images/luxury-receipt.svg',
      '/nft-images/food-receipt.svg',
      '/nft-images/travel-receipt.svg',
      '/nft-images/purchase-proof.svg',
      '/nft-images/crypto-shopper.svg',
    ];
    
    const randomImageIndex = Math.floor(Math.random() * nftImages.length);
    const imageUrl = nftImages[randomImageIndex];
    
    // Mock the blockchain transaction data
    const mockTransactionHash = '0x' + Array(64).fill(0).map(() => 
      Math.floor(Math.random() * 16).toString(16)).join('');
    
    const mintedNFT = {
      tokenId,
      contractAddress: process.env.RECEIPT_NFT_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000',
      name: `Receipt NFT #${tokenId.substring(0, 8)}`,
      description: receiptData?.merchantName 
        ? `Receipt from ${receiptData.merchantName}` 
        : 'BlockReceipt NFT',
      imageUrl,
      isLocked: Math.random() > 0.5, // Randomly determine if encrypted
      hasMetadata: true,
      createdAt: new Date().toISOString(),
      ownerAddress: walletAddress,
      transactionHash: mockTransactionHash,
      receiptData
    };
    
    // Store in our mock database
    testMintedNFTs.set(tokenId, mintedNFT);
    console.log(`Minted test NFT ${tokenId} for wallet ${walletAddress}`);
    
    // Return the minted NFT information
    return res.status(201).json({
      success: true,
      message: 'NFT minted successfully',
      nft: mintedNFT
    });
    
  } catch (error) {
    console.error('Error minting test NFT:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mint test NFT',
      error: error.message
    });
  }
});

// Endpoint to get test NFTs for a wallet address
router.get('/wallet/:address/nfts', async (req, res) => {
  try {
    const { address } = req.params;
    
    // Use our in-memory collection
    const userNFTs = Array.from(testMintedNFTs.values())
      .filter(nft => nft.ownerAddress.toLowerCase() === address.toLowerCase());
    
    console.log(`Found ${userNFTs.length} NFTs for wallet ${address}`);
    
    return res.json({
      success: true,
      nfts: userNFTs
    });
    
  } catch (error) {
    console.error('Error fetching test NFTs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch NFTs',
      error: error.message
    });
  }
});

// Endpoint to get available NFT categories
router.get('/nfts', async (req, res) => {
  // Sample NFT templates for the catalog when no filters are applied
  const nftTemplates = [
    {
      id: 'nft1',
      name: 'Receipt Guardian',
      description: 'A mystical guardian that protects your purchase history.',
      imageUrl: '/nft-images/receipt-guardian.svg',
      category: 'standard',
      tier: 'bronze',
      rarity: 'common',
    },
    {
      id: 'nft2',
      name: 'Digital Shopper',
      description: 'For the tech-savvy shopper who prefers digital receipts.',
      imageUrl: '/nft-images/digital-shopper.svg',
      category: 'electronics',
      tier: 'silver',
      rarity: 'uncommon',
    },
    {
      id: 'nft3',
      name: 'Luxury Receipt',
      description: 'For those special luxury purchases worth remembering.',
      imageUrl: '/nft-images/luxury-receipt.svg',
      category: 'luxury',
      tier: 'gold',
      rarity: 'rare',
    },
    {
      id: 'nft4',
      name: 'Food Connoisseur',
      description: 'Celebrate your gourmet adventures with this foodie NFT.',
      imageUrl: '/nft-images/food-receipt.svg',
      category: 'food',
      tier: 'bronze',
      rarity: 'common',
    },
    {
      id: 'nft5',
      name: 'Travel Explorer',
      description: 'Commemorate your journeys and travel expenses.',
      imageUrl: '/nft-images/travel-receipt.svg',
      category: 'travel',
      tier: 'silver',
      rarity: 'uncommon',
    },
    {
      id: 'nft6',
      name: 'Purchase Proof',
      description: 'The ultimate verification for important purchases.',
      imageUrl: '/nft-images/purchase-proof.svg',
      category: 'standard',
      tier: 'platinum',
      rarity: 'legendary',
    },
    {
      id: 'nft7',
      name: 'Crypto Shopper',
      description: 'For the blockchain enthusiast who pays with crypto.',
      imageUrl: '/nft-images/crypto-shopper.svg',
      category: 'crypto',
      tier: 'gold',
      rarity: 'rare',
    }
  ];
  
  return res.json({
    success: true,
    nfts: nftTemplates
  });
});

export default router;