import express from 'express';
import { z } from 'zod';
import { isAuthenticated } from '../middleware/auth';
import { metadataService } from '../services/metadataService';
import { thresholdClient } from '../services/tacoService';

const router = express.Router();

// Schema for decryption request validation
const decryptionRequestSchema = z.object({
  tokenId: z.string(),
  dataType: z.enum(['userData', 'promoData']),
});

// Decrypt NFT metadata (user data or promo data)
router.post('/decrypt', isAuthenticated, async (req, res) => {
  try {
    // Validate request
    const validationResult = decryptionRequestSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: validationResult.error.errors
      });
    }
    
    const { tokenId, dataType } = validationResult.data;
    
    // Get metadata for this token
    const metadata = await metadataService.getEncryptedMetadata(tokenId);
    if (!metadata) {
      return res.status(404).json({
        success: false,
        message: 'NFT metadata not found'
      });
    }
    
    // Verify user owns this NFT or has access to it
    if (req.user.walletAddress !== metadata.ownerAddress) {
      // TODO: Check if the user has granted access through TPRE
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to decrypt this data'
      });
    }
    
    // Determine which data to decrypt
    if (dataType === 'userData') {
      if (!metadata.userData) {
        return res.status(404).json({
          success: false,
          message: 'User data not found for this NFT'
        });
      }
      
      // Decrypt user data
      const decryptedData = await thresholdClient.decrypt({
        capsule: metadata.userData.capsule,
        ciphertext: metadata.userData.ciphertext,
        policyId: metadata.userData.policyId
      });
      
      // Parse JSON data
      const receiptData = JSON.parse(decryptedData.toString());
      
      return res.status(200).json({
        success: true,
        data: receiptData
      });
    } 
    else if (dataType === 'promoData') {
      if (!metadata.promoData) {
        return res.status(404).json({
          success: false,
          message: 'Promotion data not found for this NFT'
        });
      }
      
      // Check if promo has expired
      if (metadata.promoData.expiresAt < Math.floor(Date.now() / 1000)) {
        return res.status(403).json({
          success: false,
          message: 'Promotion has expired'
        });
      }
      
      // Decrypt promo data
      const decryptedData = await thresholdClient.decrypt({
        capsule: metadata.promoData.capsule,
        ciphertext: metadata.promoData.ciphertext,
        policyId: metadata.promoData.policyId
      });
      
      // Parse JSON data
      const promoData = JSON.parse(decryptedData.toString());
      
      return res.status(200).json({
        success: true,
        data: promoData
      });
    }
    
    // Should never reach here due to validation
    return res.status(400).json({
      success: false,
      message: 'Invalid data type specified'
    });
  } catch (error: any) {
    console.error('Error decrypting NFT metadata:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error decrypting NFT metadata',
      error: error.message
    });
  }
});

// Get all receipts with their metadata for a user
router.get('/user/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params;
    
    // Get all metadata for this wallet
    const metadataList = await metadataService.getEncryptedMetadataByWallet(walletAddress);
    
    // Transform the data for frontend display
    const receipts = metadataList.map(metadata => {
      // Determine if there is a promotion and if it's expired
      const hasPromotion = !!metadata.promoData;
      const isPromoExpired = hasPromotion && 
        metadata.promoData!.expiresAt < Math.floor(Date.now() / 1000);
      
      return {
        tokenId: metadata.tokenId,
        hasUserData: !!metadata.userData,
        hasPromotion,
        isPromoExpired,
        promoExpiresAt: hasPromotion ? metadata.promoData!.expiresAt : null,
        preview: metadata.unencryptedPreview || {} // Include any preview data
      };
    });
    
    return res.status(200).json({
      success: true,
      receipts
    });
  } catch (error: any) {
    console.error('Error fetching NFT receipts:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error fetching NFT receipts',
      error: error.message
    });
  }
});

export default router;