/**
 * Receipt Encryption API Routes
 * 
 * These routes handle TaCo threshold encryption operations for receipt metadata,
 * including encryption, decryption, granting and revoking access.
 */
import express from 'express';
import { thresholdClient, encryptData, decryptData, grantAccess, revokeAccess } from '../services/tacoService';
import { isAuthenticated } from '../auth';

const router = express.Router();

/**
 * Encrypt receipt metadata
 * POST /api/receipt-encryption/encrypt
 */
router.post('/encrypt', isAuthenticated, async (req, res) => {
  try {
    const { 
      merchantName, 
      date, 
      total, 
      subtotal, 
      tax, 
      items, 
      category,
      publicKey 
    } = req.body;
    
    // Validate required fields
    if (!merchantName || !date || !total) {
      return res.status(400).json({
        success: false,
        message: 'Missing required receipt metadata fields'
      });
    }
    
    // Create metadata object
    const metadata = {
      merchantName,
      date,
      total,
      subtotal: subtotal || 0,
      tax: tax || 0,
      items: items || [],
      category: category || 'Uncategorized'
    };
    
    // Encrypt metadata using our new thresholdClient implementation
    const serializedMetadata = JSON.stringify(metadata);
    const encryptedData = await encryptData(
      serializedMetadata,
      publicKey // Recipient's public key
    );
    
    res.json({
      success: true,
      encryptedData
    });
  } catch (error: any) {
    console.error('Receipt encryption error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to encrypt receipt metadata'
    });
  }
});

/**
 * Decrypt receipt metadata
 * POST /api/receipt-encryption/decrypt
 */
router.post('/decrypt', isAuthenticated, async (req, res) => {
  try {
    const { encryptedData, publicKey } = req.body;
    
    if (!encryptedData || !encryptedData.capsule || !encryptedData.ciphertext) {
      return res.status(400).json({
        success: false,
        message: 'Invalid encrypted data format'
      });
    }
    
    if (!publicKey) {
      return res.status(400).json({
        success: false,
        message: 'Public key is required for decryption'
      });
    }
    
    // Decrypt metadata using our thresholdClient implementation
    const decryptedData = await decryptData(
      encryptedData,
      publicKey
    );
    
    res.json({
      success: true,
      decryptedData
    });
  } catch (error: any) {
    console.error('Receipt decryption error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to decrypt receipt metadata'
    });
  }
});

/**
 * Grant receipt access to another user
 * POST /api/receipt-encryption/grant-access
 */
router.post('/grant-access', isAuthenticated, async (req, res) => {
  try {
    const { encryptedData, ownerPublicKey, recipientPublicKey } = req.body;
    
    if (!encryptedData || !encryptedData.capsule || !encryptedData.ciphertext) {
      return res.status(400).json({
        success: false,
        message: 'Invalid encrypted data format'
      });
    }
    
    if (!ownerPublicKey || !recipientPublicKey) {
      return res.status(400).json({
        success: false,
        message: 'Both owner and recipient public keys are required'
      });
    }
    
    // Grant access using our thresholdClient implementation
    const policyId = encryptedData.policyId || `receipt-${Date.now()}`;
    const reEncryptedData = await grantAccess(
      policyId,
      recipientPublicKey
    );
    
    res.json({
      success: true,
      reEncryptedData
    });
  } catch (error: any) {
    console.error('Grant receipt access error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to grant receipt access'
    });
  }
});

/**
 * Revoke receipt access from a user
 * POST /api/receipt-encryption/revoke-access
 */
router.post('/revoke-access', isAuthenticated, async (req, res) => {
  try {
    const { receiptId, recipientPublicKey } = req.body;
    
    if (!receiptId) {
      return res.status(400).json({
        success: false,
        message: 'Receipt ID is required'
      });
    }
    
    if (!recipientPublicKey) {
      return res.status(400).json({
        success: false,
        message: 'Recipient public key is required'
      });
    }
    
    // Revoke access using our thresholdClient implementation
    const success = await revokeAccess(
      receiptId, // Using receiptId as the policy ID
      recipientPublicKey
    );
    
    res.json({
      success
    });
  } catch (error: any) {
    console.error('Revoke receipt access error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to revoke receipt access'
    });
  }
});

export default router;