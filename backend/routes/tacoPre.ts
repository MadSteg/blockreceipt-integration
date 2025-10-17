/**
 * TACo PRE (Proxy Re-Encryption) API Routes
 * 
 * Routes for TACo-based threshold encryption key management, 
 * receipt encryption, policy creation, and re-encryption operations
 */
import { Router } from 'express';
import { z } from 'zod';
import * as tacoPreService from '../services/tacoPreService';

const router = Router();

/**
 * @route POST /api/keys/generate
 * @desc Generate RSA key pair for TACo PRE
 * @access Public
 */
router.post('/keys/generate', async (req, res) => {
  try {
    const keys = tacoPreService.generateKeyPair();
    return res.json({
      privateKeyPem: keys.privateKeyPem,
      publicKeyPem: keys.publicKeyPem
    });
  } catch (error: any) {
    console.error('Error generating keys:', error);
    return res.status(500).json({ 
      error: 'Failed to generate key pair',
      details: error.message 
    });
  }
});

// Schema for encrypt-mint request
const encryptMintSchema = z.object({
  policyId: z.string().min(1),
  receipt: z.object({
    id: z.number().optional(),
    merchantId: z.string(),
    timestamp: z.string(),
    total: z.string(),
    currency: z.string().optional(),
    lineItems: z.array(z.any()).optional(),
    paymentHash: z.string().optional(),
  }).passthrough()
});

/**
 * @route POST /api/receipts/encrypt-mint
 * @desc Encrypt and mint a receipt using TACo PRE
 * @access Public
 */
router.post('/receipts/encrypt-mint', async (req, res) => {
  try {
    const validationResult = encryptMintSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }

    const { policyId, receipt } = validationResult.data;

    const result = await tacoPreService.encryptReceipt(receipt, policyId);

    return res.json({
      ok: true,
      record: {
        id: result.receiptId,
        cid: result.capsuleHash,
        capsuleHash: result.capsuleHash,
        policyId: policyId,
        merchantId: receipt.merchantId,
        timestamp: receipt.timestamp,
        amount: receipt.total
      },
      capsule: {
        encryptedDEK: result.capsuleB64,
        scheme: "MOCK-PRE-RSA-OAEP"
      }
    });
  } catch (error: any) {
    console.error('Error encrypting receipt:', error);
    return res.status(500).json({
      error: 'Failed to encrypt receipt',
      details: error.message
    });
  }
});

// Schema for policy creation request
const createPolicySchema = z.object({
  adminToken: z.string().min(1),
  policyId: z.string().min(1),
  delegateePubKeyPem: z.string().min(1),
  ttlSeconds: z.number().positive(),
  maxReencryptions: z.number().positive()
});

/**
 * @route POST /api/policies
 * @desc Create a new TACo PRE policy
 * @access Admin only (requires DEMO_ADMIN_TOKEN)
 */
router.post('/policies', async (req, res) => {
  try {
    const validationResult = createPolicySchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }

    const { adminToken, policyId, delegateePubKeyPem, ttlSeconds, maxReencryptions } = validationResult.data;

    // Validate admin token
    if (adminToken !== process.env.DEMO_ADMIN_TOKEN) {
      return res.status(401).json({
        error: 'Unauthorized',
        details: 'Invalid admin token'
      });
    }

    const result = await tacoPreService.createPolicy(
      policyId,
      delegateePubKeyPem,
      ttlSeconds,
      maxReencryptions
    );

    return res.json({
      ok: true,
      policyId: result.policyId
    });
  } catch (error: any) {
    console.error('Error creating policy:', error);
    return res.status(500).json({
      error: 'Failed to create policy',
      details: error.message
    });
  }
});

// Schema for reencryption request
const reencryptSchema = z.object({
  receiptId: z.string().min(1),
  delegateePubKeyPem: z.string().min(1)
});

/**
 * @route POST /api/receipts/reencrypt
 * @desc Re-encrypt a receipt for a delegate using TACo PRE
 * @access Public
 */
router.post('/receipts/reencrypt', async (req, res) => {
  try {
    const validationResult = reencryptSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validationResult.error.format()
      });
    }

    const { receiptId, delegateePubKeyPem } = validationResult.data;

    const result = await tacoPreService.reencryptForDelegate(
      receiptId,
      delegateePubKeyPem
    );

    return res.json({
      ok: true,
      reencryptedDEK: result.reencryptedDEK,
      nonce: result.nonce,
      authTag: result.authTag,
      ciphertext: result.ciphertext
    });
  } catch (error: any) {
    console.error('Error re-encrypting receipt:', error);
    return res.status(500).json({
      error: 'Failed to re-encrypt receipt',
      details: error.message
    });
  }
});

export default router;
