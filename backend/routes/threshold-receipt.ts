/**
 * Threshold Receipt API Routes
 * 
 * These routes handle the creation, sharing, and verification of receipts
 * using threshold proxy re-encryption for privacy and security.
 */
import express, { Request, Response } from 'express';
import { thresholdReceiptService } from '../services/thresholdReceiptService';
import { storage } from '../storage';

const router = express.Router();

/**
 * GET /api/threshold-receipt/keys/:userId
 * Ensure a user has encryption keys and return the public key
 */
router.get('/keys/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    const keys = thresholdReceiptService.ensureUserKeys(userId);
    
    // Return only the public key, never the private key
    return res.status(200).json({
      userId: keys.userId,
      publicKey: keys.publicKey,
      createdAt: keys.createdAt
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/threshold-receipt/encrypt/:receiptId
 * Encrypt a receipt for secure storage
 */
router.post('/encrypt/:receiptId', async (req: Request, res: Response) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }
    
    // Get the receipt from storage
    const receipt = await storage.getReceipt(receiptId);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    // Get the receipt items
    const items = await storage.getReceiptItems(receiptId);
    
    // Encrypt and store the receipt
    const encryptedReceipt = await thresholdReceiptService.encryptAndStoreReceipt(receipt, items);
    
    return res.status(200).json({
      success: true,
      receiptId: encryptedReceipt.id,
      ownerPublicKey: encryptedReceipt.ownerPublicKey,
      createdAt: encryptedReceipt.createdAt
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/threshold-receipt/decrypt/:receiptId
 * Decrypt a receipt for the owner or authorized user
 */
router.get('/decrypt/:receiptId', async (req: Request, res: Response) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }
    
    // TODO: In a real application, get the userId from the authenticated session
    const userId = parseInt(req.query.userId as string);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Decrypt the receipt
    const decryptedReceipt = thresholdReceiptService.decryptReceipt(receiptId, userId);
    
    return res.status(200).json({
      success: true,
      receipt: decryptedReceipt
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/threshold-receipt/share/:receiptId
 * Share a receipt with another user
 */
router.post('/share/:receiptId', async (req: Request, res: Response) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }
    
    const { ownerUserId, targetUserId, accessLevel, expiresAt } = req.body;
    
    if (!ownerUserId || !targetUserId || !accessLevel) {
      return res.status(400).json({ 
        error: 'Missing required fields: ownerUserId, targetUserId, accessLevel' 
      });
    }
    
    // Parse expiration date if provided
    let expirationDate = null;
    if (expiresAt) {
      expirationDate = new Date(expiresAt);
      if (isNaN(expirationDate.getTime())) {
        return res.status(400).json({ error: 'Invalid expiration date' });
      }
    }
    
    // Share the receipt
    const success = thresholdReceiptService.shareReceipt(
      receiptId,
      ownerUserId,
      targetUserId,
      accessLevel,
      expirationDate
    );
    
    return res.status(200).json({
      success,
      message: 'Receipt shared successfully'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/threshold-receipt/verify/:receiptId
 * Verify a receipt on the blockchain
 */
router.post('/verify/:receiptId', async (req: Request, res: Response) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }
    
    // TODO: In a real application, get the userId from the authenticated session
    const userId = parseInt(req.body.userId);
    if (isNaN(userId)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    // Verify the receipt on the blockchain
    const verificationResult = await thresholdReceiptService.verifyReceiptOnBlockchain(
      receiptId,
      userId
    );
    
    return res.status(200).json({
      success: true,
      verified: verificationResult.verified,
      blockNumber: verificationResult.blockNumber,
      timestamp: verificationResult.timestamp
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/threshold-receipt/threshold/:receiptId
 * Create threshold recovery shares for a receipt
 */
router.post('/threshold/:receiptId', async (req: Request, res: Response) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }
    
    const { userId, totalShares, threshold } = req.body;
    
    if (!userId || !totalShares || !threshold) {
      return res.status(400).json({ 
        error: 'Missing required fields: userId, totalShares, threshold' 
      });
    }
    
    // Create threshold recovery
    const thresholdData = thresholdReceiptService.createThresholdRecovery(
      receiptId,
      userId,
      totalShares,
      threshold
    );
    
    return res.status(200).json({
      success: true,
      sharedKey: thresholdData.sharedKey,
      threshold: thresholdData.threshold,
      totalShares: thresholdData.shares.length
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/threshold-receipt/recover/:receiptId
 * Recover access to a receipt using threshold shares
 */
router.post('/recover/:receiptId', async (req: Request, res: Response) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: 'Invalid receipt ID' });
    }
    
    const { shares, originalPublicKey } = req.body;
    
    if (!shares || !originalPublicKey) {
      return res.status(400).json({ 
        error: 'Missing required fields: shares, originalPublicKey' 
      });
    }
    
    // Recover receipt access
    const success = thresholdReceiptService.recoverReceiptAccess(
      receiptId,
      shares,
      originalPublicKey
    );
    
    return res.status(200).json({
      success,
      message: success ? 'Receipt access recovered successfully' : 'Failed to recover receipt access'
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;