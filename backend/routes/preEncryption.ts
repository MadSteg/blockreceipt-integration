import { Router } from 'express';
import { preEncryptionService } from '../services/preEncryptionService';
import { validateBody, schemas } from '../middleware/validation';
import { z } from 'zod';
import asyncHandler from 'express-async-handler';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas for PRE operations
const encryptReceiptSchema = z.object({
  receiptData: z.object({
    merchantName: z.string().min(1),
    total: z.number().positive(),
    items: z.array(z.object({
      name: z.string().min(1),
      price: z.number().nonnegative(),
      quantity: z.number().int().positive()
    })).min(1),
    date: z.string(),
    subtotal: z.number().optional(),
    tax: z.number().optional()
  }),
  ownerPublicKey: z.string().min(1),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

const mintEncryptedSchema = z.object({
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenId: z.number().int().positive(),
  encryptedPayload: z.object({
    cipherText: z.string(),
    capsule: z.string(),
    receiptHash: z.string()
  }),
  metadataUri: z.string().url()
});

const accessControlSchema = z.object({
  tokenId: z.number().int().positive(),
  delegateeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/)
});

const decryptSchema = z.object({
  tokenId: z.number().int().positive(),
  userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  userPrivateKey: z.string().min(1)
});

/**
 * POST /api/pre/encrypt
 * Encrypt receipt data using TACo PRE
 */
router.post('/encrypt', 
  validateBody(encryptReceiptSchema),
  asyncHandler(async (req, res) => {
    const { receiptData, ownerPublicKey } = req.body;
    
    try {
      const encryptedPayload = await preEncryptionService.encryptReceiptData(receiptData, ownerPublicKey);
      
      res.json({
        success: true,
        data: encryptedPayload,
        message: 'Receipt data encrypted successfully'
      });
    } catch (error) {
      logger.error('Encryption error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to encrypt receipt data'
      });
    }
  })
);

/**
 * POST /api/pre/mint-encrypted
 * Mint encrypted NFT with PRE protection
 */
router.post('/mint-encrypted',
  validateBody(mintEncryptedSchema),
  asyncHandler(async (req, res) => {
    const { to, tokenId, encryptedPayload, metadataUri } = req.body;
    
    try {
      // Check if we have the required private key
      const signerPrivateKey = process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
      if (!signerPrivateKey) {
        return res.status(500).json({
          success: false,
          error: 'Wallet private key not configured'
        });
      }
      
      const txHash = await preEncryptionService.mintEncryptedNFT(
        to,
        tokenId,
        encryptedPayload,
        metadataUri,
        signerPrivateKey
      );
      
      res.json({
        success: true,
        data: {
          transactionHash: txHash,
          tokenId,
          to
        },
        message: 'Encrypted NFT minted successfully'
      });
    } catch (error) {
      logger.error('Minting error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to mint encrypted NFT'
      });
    }
  })
);

/**
 * POST /api/pre/grant-access
 * Grant access to encrypted receipt
 */
router.post('/grant-access',
  validateBody(accessControlSchema),
  asyncHandler(async (req, res) => {
    const { tokenId, delegateeAddress } = req.body;
    
    try {
      const signerPrivateKey = process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
      if (!signerPrivateKey) {
        return res.status(500).json({
          success: false,
          error: 'Wallet private key not configured'
        });
      }
      
      const txHash = await preEncryptionService.grantAccess(tokenId, delegateeAddress, signerPrivateKey);
      
      res.json({
        success: true,
        data: {
          transactionHash: txHash,
          tokenId,
          delegatee: delegateeAddress
        },
        message: 'Access granted successfully'
      });
    } catch (error) {
      logger.error('Access grant error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to grant access'
      });
    }
  })
);

/**
 * POST /api/pre/revoke-access
 * Revoke access to encrypted receipt
 */
router.post('/revoke-access',
  validateBody(accessControlSchema),
  asyncHandler(async (req, res) => {
    const { tokenId, delegateeAddress } = req.body;
    
    try {
      const signerPrivateKey = process.env.WALLET_PRIVATE_KEY || process.env.PRIVATE_KEY;
      if (!signerPrivateKey) {
        return res.status(500).json({
          success: false,
          error: 'Wallet private key not configured'
        });
      }
      
      const txHash = await preEncryptionService.revokeAccess(tokenId, delegateeAddress, signerPrivateKey);
      
      res.json({
        success: true,
        data: {
          transactionHash: txHash,
          tokenId,
          delegatee: delegateeAddress
        },
        message: 'Access revoked successfully'
      });
    } catch (error) {
      logger.error('Access revoke error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke access'
      });
    }
  })
);

/**
 * POST /api/pre/decrypt
 * Decrypt receipt data for authorized user
 */
router.post('/decrypt',
  validateBody(decryptSchema),
  asyncHandler(async (req, res) => {
    const { tokenId, userAddress, userPrivateKey } = req.body;
    
    try {
      const decryptedData = await preEncryptionService.decryptReceiptData(tokenId, userAddress, userPrivateKey);
      
      res.json({
        success: true,
        data: decryptedData,
        message: 'Receipt decrypted successfully'
      });
    } catch (error) {
      logger.error('Decryption error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to decrypt receipt'
      });
    }
  })
);

/**
 * GET /api/pre/check-access/:tokenId/:userAddress
 * Check if user has access to encrypted receipt
 */
router.get('/check-access/:tokenId/:userAddress',
  asyncHandler(async (req, res) => {
    const { tokenId, userAddress } = req.params;
    
    // Validate parameters
    if (!/^\d+$/.test(tokenId) || !/^0x[a-fA-F0-9]{40}$/.test(userAddress)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid tokenId or user address'
      });
    }
    
    try {
      const hasAccess = await preEncryptionService.checkAccess(parseInt(tokenId), userAddress);
      
      res.json({
        success: true,
        data: {
          tokenId: parseInt(tokenId),
          userAddress,
          hasAccess
        }
      });
    } catch (error) {
      logger.error('Access check error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check access'
      });
    }
  })
);

export default router;