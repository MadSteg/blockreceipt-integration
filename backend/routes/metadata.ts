import { Router } from 'express';
import { metadataService } from '../services/metadataService';
import { z } from 'zod';

const router = Router();

// Schema for metadata access request validation
const metadataAccessRequestSchema = z.object({
  tokenId: z.string().min(1),
  walletAddress: z.string().min(1)
});

// Schema for granting access validation
const grantAccessSchema = z.object({
  tokenId: z.string().min(1),
  granterAddress: z.string().min(1),
  granteeAddress: z.string().min(1)
});

// Schema for revoking access validation
const revokeAccessSchema = z.object({
  tokenId: z.string().min(1),
  revokerAddress: z.string().min(1),
  granteeAddress: z.string().min(1)
});

// Schema for token transfer validation
const transferTokenSchema = z.object({
  tokenId: z.string().min(1),
  fromAddress: z.string().min(1),
  toAddress: z.string().min(1),
  txHash: z.string().min(1)
});

// Schema for storing encrypted metadata
const storeMetadataSchema = z.object({
  tokenId: z.string().min(1),
  encryptedData: z.string().min(1),
  unencryptedPreview: z.any(),
  ownerAddress: z.string().min(1)
});

/**
 * Get metadata for a token with access control
 * If requester has access, returns full metadata
 * If not, returns only the public preview
 */
router.get('/metadata/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    const walletAddress = req.query.wallet as string;

    if (!tokenId || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: tokenId or wallet address'
      });
    }

    const result = await metadataService.getTokenMetadata(tokenId, walletAddress);
    
    if (!result.success) {
      return res.status(404).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while retrieving metadata'
    });
  }
});

/**
 * Store encrypted metadata for a token
 */
router.post('/metadata', async (req, res) => {
  try {
    const validationResult = storeMetadataSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }

    const { tokenId, encryptedData, unencryptedPreview, ownerAddress } = validationResult.data;
    
    const result = await metadataService.storeEncryptedMetadata(
      tokenId,
      encryptedData,
      unencryptedPreview,
      ownerAddress
    );

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error storing encrypted metadata:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while storing metadata'
    });
  }
});

/**
 * Grant access to a token's metadata
 */
router.post('/metadata/grant-access', async (req, res) => {
  try {
    const validationResult = grantAccessSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }

    const { tokenId, granterAddress, granteeAddress } = validationResult.data;
    
    const result = await metadataService.grantAccess(
      tokenId,
      granterAddress,
      granteeAddress
    );

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error granting access:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while granting access'
    });
  }
});

/**
 * Revoke access to a token's metadata
 */
router.post('/metadata/revoke-access', async (req, res) => {
  try {
    const validationResult = revokeAccessSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }

    const { tokenId, revokerAddress, granteeAddress } = validationResult.data;
    
    const result = await metadataService.revokeAccess(
      tokenId,
      revokerAddress,
      granteeAddress
    );

    if (!result.success) {
      return res.status(403).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error revoking access:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while revoking access'
    });
  }
});

/**
 * Handle token transfer and update access controls
 */
router.post('/metadata/token-transfer', async (req, res) => {
  try {
    const validationResult = transferTokenSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }

    const { tokenId, fromAddress, toAddress, txHash } = validationResult.data;
    
    const result = await metadataService.handleTokenTransfer(
      tokenId,
      fromAddress,
      toAddress,
      txHash
    );

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.json(result);
  } catch (error) {
    console.error('Error handling token transfer:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while handling token transfer'
    });
  }
});

/**
 * Check if an address has access to a token's metadata
 */
router.get('/metadata/:tokenId/access/:walletAddress', async (req, res) => {
  try {
    const { tokenId, walletAddress } = req.params;

    if (!tokenId || !walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: tokenId or wallet address'
      });
    }

    const hasAccess = await metadataService.hasMetadataAccess(tokenId, walletAddress);

    return res.json({
      success: true,
      data: {
        tokenId,
        walletAddress,
        hasAccess
      }
    });
  } catch (error) {
    console.error('Error checking metadata access:', error);
    return res.status(500).json({
      success: false,
      error: 'Server error while checking access'
    });
  }
});

export default router;