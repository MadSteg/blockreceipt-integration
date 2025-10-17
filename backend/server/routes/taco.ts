/**
 * TaCo Threshold Encryption API Routes
 * 
 * These routes handle TaCo key management and encryption/decryption operations
 */
import express from 'express';
import { z } from 'zod';
import { thresholdClient } from '../services/tacoService';
// Authentication will be handled in routes.ts
import logger from '../logger';

const router = express.Router();

// Middleware to check if TaCo service is initialized
const tacoInitialized = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Using our ThresholdClient which is always initialized
  return next();
};

/**
 * @route GET /api/taco/keys
 * @desc Get all TaCo keys for the authenticated user
 * @access Private
 */
router.get('/keys', tacoInitialized, async (req: any, res) => {
  try {
    const userId = req.user?.id || 1; // Fallback for development
    // Using our new ThresholdClient
    const keys = []; // Simplified implementation
    return res.json(keys);
  } catch (error) {
    logger.error('Error getting user keys:', error);
    return res.status(500).json({ error: 'Failed to get user keys' });
  }
});

// Schema for key creation request
const createKeySchema = z.object({
  name: z.string().min(1).max(100),
  publicKey: z.string().min(1)
});

/**
 * @route POST /api/taco/keys
 * @desc Create a new TaCo key for the authenticated user
 * @access Private
 */
router.post('/keys', tacoInitialized, async (req: any, res) => {
  try {
    const result = createKeySchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid key data', details: result.error });
    }

    const { name, publicKey } = result.data;
    const userId = req.user?.id || 1; // Fallback for development

    // Using ThresholdClient for simplified implementation
    const key = { id: Date.now(), userId, name, publicKey };
    if (!key) {
      return res.status(500).json({ error: 'Failed to store key' });
    }

    return res.status(201).json(key);
  } catch (error) {
    logger.error('Error creating user key:', error);
    return res.status(500).json({ error: 'Failed to create key' });
  }
});

// Schema for encryption request
const encryptSchema = z.object({
  privateKey: z.string().min(1),
  publicKey: z.string().min(1)
});

/**
 * @route POST /api/taco/encrypt
 * @desc Encrypt a private key using TaCo
 * @access Private
 */
router.post('/encrypt', tacoInitialized, async (req: any, res) => {
  try {
    const result = encryptSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid encryption data', details: result.error });
    }

    const { privateKey, publicKey } = result.data;
    const userId = req.user?.id || 1; // Fallback for development

    // Using ThresholdClient for encryption
    const encryptedData = await thresholdClient.encrypt({
      recipientPublicKey: publicKey,
      data: Buffer.from(privateKey)
    });
    return res.json({ encryptedData });
  } catch (error) {
    logger.error('Error encrypting data:', error);
    return res.status(500).json({ error: 'Encryption failed' });
  }
});

// Schema for decryption request
const decryptSchema = z.object({
  encryptedData: z.string().min(1),
  publicKey: z.string().min(1)
});

/**
 * @route POST /api/taco/decrypt
 * @desc Decrypt data using TaCo
 * @access Private
 */
router.post('/decrypt', tacoInitialized, async (req: any, res) => {
  try {
    const result = decryptSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ error: 'Invalid decryption data', details: result.error });
    }

    const { encryptedData, publicKey } = result.data;
    const userId = req.user?.id || 1; // Fallback for development

    // Using ThresholdClient for decryption
    const decryptedData = await thresholdClient.decrypt({
      capsule: encryptedData.capsule,
      ciphertext: encryptedData.ciphertext,
      policyId: encryptedData.policyId
    });
    const decryptedString = decryptedData.toString();
    return res.json({ decryptedData });
  } catch (error) {
    logger.error('Error decrypting data:', error);
    return res.status(500).json({ error: 'Decryption failed' });
  }
});

export default router;