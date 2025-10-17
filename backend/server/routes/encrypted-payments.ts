/**
 * Encrypted Payment API Routes
 * 
 * These routes handle payment processing with threshold encryption
 * for enhanced privacy and security.
 */
import { Router } from 'express';
import { z } from 'zod';
import { log } from '../vite';
import { storage } from '../storage';
import { 
  isAvailable, 
  createMockPayment,
  retrievePayment
} from '../services/stripeService';
import { encryptedPaymentService } from '../services/encryptedPaymentService';
import { thresholdReceiptService } from '../services/thresholdReceiptService';

const router = Router();

// Schema for encrypted payment creation
const createEncryptedPaymentSchema = z.object({
  amount: z.number().positive(),
  receiptId: z.number().optional(),
  userId: z.number().int().positive(),
  metadata: z.record(z.string()).optional(),
  nftOptIn: z.boolean().optional()
});

/**
 * Get encryption service status
 */
router.get('/status', async (req, res) => {
  try {
    const paymentStatus = isAvailable();
    res.json({
      ...paymentStatus,
      encryptionAvailable: true
    });
  } catch (error: any) {
    log(`Error checking encrypted payment status: ${error.message}`, 'payments');
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create an encrypted mock payment
 */
router.post('/create-mock', async (req, res) => {
  try {
    // Validate request body
    const validationResult = createEncryptedPaymentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: validationResult.error.message
      });
    }
    
    const { amount, receiptId, userId, metadata = {}, nftOptIn = false } = validationResult.data;
    
    // Create additional metadata
    let paymentMetadata: Record<string, string> = { 
      ...metadata,
      encrypted: 'true',
      nftOptIn: nftOptIn ? 'true' : 'false'
    };
    
    // Add receipt metadata if provided
    if (receiptId) {
      const receipt = await storage.getReceipt(receiptId);
      if (receipt) {
        paymentMetadata = {
          ...paymentMetadata,
          receiptId: receiptId.toString(),
          merchantId: receipt.merchantId.toString(),
          total: receipt.total
        };
      }
    }
    
    // Create a mock payment
    const mockPayment = await createMockPayment(amount, 'usd', paymentMetadata);
    
    if (!mockPayment.success) {
      return res.status(500).json(mockPayment);
    }
    
    // Create encrypted payment record
    const encryptedPayment = await encryptedPaymentService.createEncryptedPayment(
      mockPayment.paymentId,
      {
        amount,
        currency: 'usd',
        metadata: paymentMetadata,
        receiptId,
        nftOptIn
      },
      userId
    );
    
    // If payment is for a receipt, update the receipt with payment info
    if (receiptId) {
      await storage.updateReceipt(receiptId, {
        paymentId: mockPayment.paymentId,
        paymentAmount: amount.toString(),
        paymentCurrency: 'usd',
        paymentDate: new Date(),
        paymentMethod: 'card',
        paymentComplete: true, // Mock payments are immediately complete
        nftRequested: nftOptIn
      });
      
      // If NFT was requested, generate threshold-encrypted NFT
      if (nftOptIn) {
        // Get the receipt with items
        const receipt = await storage.getReceipt(receiptId);
        const items = await storage.getReceiptItems(receiptId);
        
        if (receipt) {
          // Encrypt the receipt for blockchain storage
          await thresholdReceiptService.encryptAndStoreReceipt(receipt, items);
          
          // TODO: Trigger NFT minting process with encrypted data
          // This would connect to the blockchain service
        }
      }
    }
    
    // Return success response
    return res.status(200).json({
      success: true,
      paymentId: mockPayment.paymentId,
      clientSecret: mockPayment.clientSecret,
      amount,
      currency: 'usd',
      encrypted: true
    });
  } catch (error: any) {
    log(`Error creating encrypted payment: ${error.message}`, 'payments');
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get encrypted payment by ID
 */
router.get('/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    // Check if this is an encrypted payment
    const encryptedPayment = encryptedPaymentService.getEncryptedPayment(paymentId);
    
    if (encryptedPayment) {
      // For demo purposes, we'll use user ID 1
      const userId = 1;
      
      // Decrypt the payment for the owner
      const decryptedPayment = encryptedPaymentService.decryptPayment(paymentId, userId);
      
      return res.json(decryptedPayment);
    }
    
    // If not encrypted, fetch from regular payment service
    const payment = await retrievePayment(paymentId);
    return res.json(payment);
  } catch (error: any) {
    log(`Error retrieving encrypted payment: ${error.message}`, 'payments');
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Link payment to receipt NFT
 */
router.post('/:paymentId/link-nft', async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { receiptId, nftTokenId } = req.body;
    
    if (!receiptId || !nftTokenId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: receiptId, nftTokenId'
      });
    }
    
    // Link the payment to the receipt NFT
    const success = encryptedPaymentService.linkPaymentToReceiptNFT(
      paymentId,
      receiptId,
      nftTokenId
    );
    
    if (success) {
      // Update the receipt with NFT info
      await storage.updateReceipt(receiptId, {
        nftTokenId,
        blockchainVerified: true
      });
      
      return res.json({
        success: true,
        message: 'Payment linked to receipt NFT successfully'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: 'Failed to link payment to receipt NFT'
      });
    }
  } catch (error: any) {
    log(`Error linking payment to NFT: ${error.message}`, 'payments');
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;