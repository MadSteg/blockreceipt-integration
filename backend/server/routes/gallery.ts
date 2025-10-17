import { Router } from 'express';
import { z } from 'zod';
import { metadataService } from '../services/metadataService';
import { tacoService } from '../services/tacoService';
import { blockchainService } from '../services/blockchainService';
import { galleryService } from '../services/galleryService';

const router = Router();

// Schema for wallet address validation
const walletAddressSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

// Schema for token ID validation
const tokenIdSchema = z.object({
  tokenId: z.string().min(1)
});

// Schema for unlock request validation
const unlockRequestSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenId: z.string().min(1)
});

/**
 * GET /api/gallery/:walletAddress
 * Fetches all NFTs owned by a wallet with their encrypted metadata status
 */
router.get('/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = walletAddressSchema.parse({
      walletAddress: req.params.walletAddress
    });
    
    // Get NFTs from both on-chain and off-chain sources using the gallery service
    const nfts = await galleryService.getNFTsForWallet(walletAddress);
    
    res.json({
      success: true,
      nfts
    });
  } catch (error: any) {
    console.error('Error fetching gallery NFTs:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid wallet address format'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve NFTs'
    });
  }
});

/**
 * GET /api/gallery/metadata/:tokenId
 * Get encrypted metadata for a specific token
 */
router.get('/metadata/:tokenId', async (req, res) => {
  try {
    const { tokenId } = tokenIdSchema.parse({
      tokenId: req.params.tokenId
    });
    
    const metadata = await metadataService.getEncryptedMetadata(tokenId);
    
    if (!metadata) {
      return res.status(404).json({
        success: false,
        error: 'Metadata not found for token'
      });
    }
    
    res.json({
      success: true,
      metadata: {
        tokenId: metadata.tokenId,
        encryptedData: metadata.encryptedData,
        ownerAddress: metadata.ownerAddress,
        preview: metadata.unencryptedPreview
      }
    });
  } catch (error: any) {
    console.error('Error fetching token metadata:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid token ID'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve metadata'
    });
  }
});

/**
 * POST /api/gallery/unlock/:tokenId
 * Unlock encrypted metadata for a token if the requester is the owner
 */
router.post('/unlock/:tokenId', async (req, res) => {
  try {
    const { tokenId, walletAddress } = unlockRequestSchema.parse({
      tokenId: req.params.tokenId,
      walletAddress: req.body.walletAddress
    });
    
    // Use the gallery service to handle verification and decryption
    const decryptedData = await galleryService.unlockNFTMetadata(tokenId, walletAddress);
    
    if (!decryptedData) {
      return res.status(403).json({
        success: false,
        error: 'Unable to unlock metadata. Verify that you own this NFT.'
      });
    }
    
    // Return the decrypted data
    res.json({
      success: true,
      metadata: decryptedData
    });
  } catch (error: any) {
    console.error('Error unlocking token metadata:', error);
    
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: 'Invalid request parameters'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to unlock metadata'
    });
  }
});

export default router;