import express from 'express';
import { z } from 'zod';
import { thresholdClient } from '../services/tacoService';
import { apiKeyAuthMiddleware } from '../middleware/auth';
import { metadataService } from '../services/metadataService';

const router = express.Router();

// Validation schema for promotion creation
const createPromotionSchema = z.object({
  userPublicKey: z.string(),
  tokenId: z.string(),
  promoPayload: z.object({
    promotionCode: z.string(),
    discount: z.number().min(0).max(100),
    validUntil: z.number(),
    message: z.string().optional(),
    type: z.enum(['PERCENT', 'FIXED', 'BOGO', 'FREE_ITEM']),
    merchantName: z.string(),
    tier: z.enum(['STANDARD', 'PREMIUM', 'LUXURY']).optional()
  }),
  validUntil: z.number() // Unix timestamp for expiration
});

// Create a new promotion for an NFT
router.post('/create', apiKeyAuthMiddleware, async (req, res) => {
  try {
    // Validate request data
    const validationResult = createPromotionSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid request data', 
        errors: validationResult.error.errors 
      });
    }
    
    const { userPublicKey, tokenId, promoPayload, validUntil } = validationResult.data;
    
    // Get existing metadata to ensure we're not overwriting user data
    const existingMetadata = await metadataService.getEncryptedMetadata(tokenId);
    if (!existingMetadata) {
      return res.status(404).json({ 
        success: false, 
        message: 'NFT metadata not found' 
      });
    }
    
    // Convert promoPayload to Buffer for encryption
    const promoPayloadBuffer = Buffer.from(JSON.stringify(promoPayload));
    
    // Encrypt the promotion data using TACo
    const { capsule, ciphertext, policyId } = await thresholdClient.encrypt({
      recipientPublicKey: userPublicKey,
      data: promoPayloadBuffer,
      expiresAt: validUntil
    });
    
    // Create promo data object
    const promoData = {
      capsule,
      ciphertext,
      policyId,
      expiresAt: validUntil
    };
    
    // Update the metadata with the promotion
    // Keep the user data unchanged, only add/update promo data
    const updated = await metadataService.storeNFTMetadata(
      tokenId,
      existingMetadata.ownerAddress,
      existingMetadata.userData, // Keep existing user data
      promoData, // Add new promo data
      existingMetadata.unencryptedPreview // Keep existing preview data
    );
    
    if (updated) {
      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Promotion created successfully',
        tokenId,
        expiresAt: validUntil
      });
    } else {
      return res.status(500).json({
        success: false,
        message: 'Failed to update metadata with promotion'
      });
    }
  } catch (error: any) {
    console.error('Error creating promotion:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error creating promotion',
      error: error.message
    });
  }
});

// Get all promotions for a user's NFTs
router.get('/user/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    // Get all metadata for this wallet
    const metadataList = await metadataService.getEncryptedMetadataByWallet(walletAddress);
    
    // Filter to only include those with promo data
    const promotions = metadataList
      .filter(metadata => !!metadata.promoData)
      .map(metadata => {
        const isExpired = metadata.promoData && 
                        metadata.promoData.expiresAt && 
                        metadata.promoData.expiresAt < Math.floor(Date.now() / 1000);
        
        return {
          tokenId: metadata.tokenId,
          hasPromotion: true,
          isExpired,
          expiresAt: metadata.promoData?.expiresAt,
          preview: metadata.unencryptedPreview
        };
      });
    
    return res.status(200).json({
      success: true,
      promotions
    });
  } catch (error: any) {
    console.error('Error fetching promotions:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching promotions',
      error: error.message
    });
  }
});

export default router;