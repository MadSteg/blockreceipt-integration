import { Router } from 'express';
import { z } from 'zod';
import { ReceiptDeliveryService } from '../services/receiptDeliveryService';
import { WalletService } from '../services/walletService';

const router = Router();

// Schema for instant receipt creation
const instantReceiptSchema = z.object({
  merchantName: z.string().min(1, 'Merchant name is required'),
  date: z.string().min(1, 'Date is required'),
  total: z.number().min(0, 'Total must be non-negative'),
  subtotal: z.number().optional(),
  tax: z.number().optional(),
  items: z.array(z.object({
    name: z.string(),
    price: z.number(),
    quantity: z.number()
  })).default([]),
  category: z.string().optional(),
  delivery: z.object({
    phoneNumber: z.string().optional(),
    email: z.string().email().optional(),
    walletAddress: z.string().optional(),
    createWalletIfNeeded: z.boolean().default(true)
  })
});

/**
 * POST /api/instant-receipt
 * Create and deliver an instant receipt
 */
router.post('/instant-receipt', async (req, res) => {
  try {
    const validatedData = instantReceiptSchema.parse(req.body);
    
    // Prepare receipt data
    const receiptData = {
      merchantName: validatedData.merchantName,
      date: validatedData.date,
      total: validatedData.total,
      subtotal: validatedData.subtotal || 0,
      tax: validatedData.tax || 0,
      items: validatedData.items,
      category: validatedData.category,
      confidence: 100, // Manual entry, full confidence
      rawText: undefined
    };

    // Deliver the receipt
    const result = await ReceiptDeliveryService.deliverInstantReceipt(
      receiptData,
      validatedData.delivery
    );

    res.json({
      success: true,
      message: result.message,
      data: {
        receiptId: result.receiptId,
        walletAddress: result.walletAddress,
        accessUrl: result.accessLink.shareableUrl,
        seedPhrase: result.seedPhrase, // Only included for new wallets
        expiresAt: result.accessLink.expiresAt
      }
    });

  } catch (error) {
    console.error('Error creating instant receipt:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid request data',
        errors: error.errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create instant receipt',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/receipt/:token
 * View a receipt using access token
 */
router.get('/receipt/:token', async (req, res) => {
  try {
    const { token } = req.params;
    
    const receiptData = await ReceiptDeliveryService.getReceiptByToken(token);
    
    res.json({
      success: true,
      data: {
        receipt: {
          id: receiptData.receipt.id,
          merchantName: receiptData.receipt.merchantName,
          date: receiptData.receipt.date,
          total: receiptData.receipt.total / 100, // Convert back to dollars
          subtotal: receiptData.receipt.subtotal ? receiptData.receipt.subtotal / 100 : 0,
          tax: receiptData.receipt.tax ? receiptData.receipt.tax / 100 : 0,
          items: receiptData.receipt.items,
          category: receiptData.receipt.category,
          createdAt: receiptData.receipt.createdAt
        },
        walletAddress: receiptData.walletAddress
      }
    });

  } catch (error) {
    console.error('Error fetching receipt:', error);
    
    res.status(404).json({
      success: false,
      message: error instanceof Error ? error.message : 'Receipt not found'
    });
  }
});

/**
 * POST /api/wallet/generate
 * Generate a guest wallet
 */
router.post('/wallet/generate', async (req, res) => {
  try {
    const wallet = WalletService.createGuestWallet();
    
    res.json({
      success: true,
      data: {
        address: wallet.address,
        seedPhrase: wallet.mnemonic
      }
    });

  } catch (error) {
    console.error('Error generating wallet:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to generate wallet'
    });
  }
});

/**
 * GET /api/wallet/validate/:address
 * Validate if an address is a valid Ethereum address
 */
router.get('/wallet/validate/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const isValid = WalletService.isValidAddress(address);
    
    res.json({
      success: true,
      data: {
        address,
        isValid
      }
    });

  } catch (error) {
    console.error('Error validating address:', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to validate address'
    });
  }
});

export default router;