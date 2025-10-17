import { Router } from 'express';
import { cryptoPaymentService } from '../services/cryptoPaymentService';
import { z } from 'zod';
import { logger } from '../utils/logger';

const router = Router();

// Schema for creating a crypto payment intent
const createPaymentIntentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().optional().default('MATIC'),
  metadata: z.record(z.string()).optional(),
});

// Schema for verifying a crypto payment
const verifyPaymentSchema = z.object({
  paymentId: z.string(),
  txHash: z.string(),
  currency: z.string().optional(),
});

/**
 * Get available cryptocurrencies
 */
router.get('/available-currencies', async (req, res) => {
  try {
    const currencies = await cryptoPaymentService.getAvailableCurrencies();
    res.json({ success: true, currencies });
  } catch (error) {
    logger.error('[crypto] Error getting available currencies:', error);
    res.status(500).json({ success: false, error: 'Failed to get available currencies' });
  }
});

/**
 * Create a crypto payment intent
 */
router.post('/create-payment-intent', async (req, res) => {
  try {
    const validatedData = createPaymentIntentSchema.parse(req.body);
    
    const paymentIntent = await cryptoPaymentService.createPaymentIntent(
      validatedData.amount,
      validatedData.currency,
      validatedData.metadata
    );
    
    res.json(paymentIntent);
  } catch (error) {
    logger.error('[crypto] Error creating payment intent:', error);
    res.status(400).json({ success: false, error: 'Invalid request data' });
  }
});

/**
 * Verify a crypto payment
 */
router.post('/verify-payment', async (req, res) => {
  try {
    const validatedData = verifyPaymentSchema.parse(req.body);
    
    const verification = await cryptoPaymentService.verifyPayment(
      validatedData.paymentId,
      validatedData.txHash,
      validatedData.currency
    );
    
    res.json(verification);
  } catch (error) {
    logger.error('[crypto] Error verifying payment:', error);
    res.status(400).json({ success: false, error: 'Invalid request data' });
  }
});

/**
 * Get transaction details
 */
router.get('/transaction/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    
    if (!txHash) {
      return res.status(400).json({ success: false, error: 'Transaction hash is required' });
    }
    
    const details = await cryptoPaymentService.getTransactionDetails(txHash);
    res.json(details);
  } catch (error) {
    logger.error('[crypto] Error getting transaction details:', error);
    res.status(500).json({ success: false, error: 'Failed to get transaction details' });
  }
});

/**
 * Get payment status
 */
router.get('/payment-status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    if (!paymentId) {
      return res.status(400).json({ success: false, error: 'Payment ID is required' });
    }
    
    const status = await cryptoPaymentService.getPaymentStatus(paymentId);
    res.json(status);
  } catch (error) {
    logger.error('[crypto] Error getting payment status:', error);
    res.status(500).json({ success: false, error: 'Failed to get payment status' });
  }
});

export default router;