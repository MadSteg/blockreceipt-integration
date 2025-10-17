/**
 * Payment API routes
 */
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { log } from "../vite";
import { 
  isAvailable,
  createPaymentIntent,
  createMockPayment,
  retrievePayment 
} from "../services/stripeService";

const router = Router();

// Schema for payment intent creation
const createPaymentIntentSchema = z.object({
  amount: z.number().positive(),
  receiptId: z.number().optional(),
  metadata: z.record(z.string()).optional()
});

// Schema for mock payment creation
const createMockPaymentSchema = z.object({
  amount: z.number().positive(),
  receiptId: z.number().optional(),
  metadata: z.record(z.string()).optional()
});

/**
 * Get payment service status
 */
router.get("/status", async (req, res) => {
  try {
    const status = isAvailable();
    res.json(status);
  } catch (error: any) {
    log(`Error checking payment status: ${error.message}`, "payments");
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create payment intent
 */
router.post("/create-intent", async (req, res) => {
  try {
    // Validate request body
    const validationResult = createPaymentIntentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: validationResult.error.message
      });
    }
    
    const { amount, receiptId, metadata = {} } = validationResult.data;
    
    // Create additional metadata if receipt ID is provided
    let paymentMetadata: Record<string, string> = { ...metadata };
    if (receiptId) {
      // Get receipt details to include in metadata
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
    
    // Create payment intent
    const paymentIntent = await createPaymentIntent(amount, "usd", paymentMetadata);
    
    // If successful and tied to a receipt, update the receipt with payment info
    if (paymentIntent.success && receiptId) {
      // Base receipt update
      const receiptUpdate = {
        paymentId: paymentIntent.paymentIntentId,
        paymentAmount: amount.toString(),
        paymentCurrency: "usd",
        paymentDate: new Date(),
        paymentMethod: "card",
        paymentComplete: false // Will be updated when payment completes
      };
      
      // Update the receipt
      await storage.updateReceipt(receiptId, receiptUpdate);
      
      // If NFT minting is requested in metadata, store this info in the payment intent
      if (metadata.mintNFT === 'true') {
        log(`NFT minting requested for payment intent ${paymentIntent.paymentIntentId}`, "payments");
        
        // In real implementation, this would be handled by a webhook when payment completes
        // For this demo, we'll just log the NFT request and prepare for mock minting
        paymentIntent.mintNFT = true;
        paymentIntent.nftTheme = metadata.nftTheme || 'default';
        paymentIntent.nftFee = metadata.nftFee || '0.99';
      }
    }
    
    res.json(paymentIntent);
  } catch (error: any) {
    log(`Error creating payment intent: ${error.message}`, "payments");
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create mock payment (for testing without Stripe)
 */
router.post("/mock-payment", async (req, res) => {
  try {
    // Validate request body
    const validationResult = createMockPaymentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: validationResult.error.message
      });
    }
    
    const { amount, receiptId, metadata = {} } = validationResult.data;
    
    // Create additional metadata if receipt ID is provided
    let paymentMetadata: Record<string, string> = { ...metadata };
    if (receiptId) {
      // Get receipt details to include in metadata
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
    
    // Create mock payment
    const payment = await createMockPayment(amount, "card", paymentMetadata);
    
    // If successful and tied to a receipt, update the receipt with payment info
    if (payment.success && receiptId) {
      // Base receipt update
      const receiptUpdate = {
        paymentId: payment.paymentId,
        paymentAmount: amount.toString(),
        paymentCurrency: "usd",
        paymentDate: new Date(),
        paymentMethod: "card",
        paymentComplete: true,
        stripeReceiptUrl: payment.receiptUrl
      };
      
      // Update the receipt
      await storage.updateReceipt(receiptId, receiptUpdate);
      
      // If NFT minting is requested, trigger the blockchain minting process
      if (metadata.mintNFT === 'true') {
        try {
          log(`NFT minting requested for receipt ${receiptId}`, "payments");
          
          // Get the full receipt with items
          const fullReceipt = await storage.getFullReceipt(receiptId);
          if (fullReceipt) {
            // Import the blockchain service dynamically to avoid circular dependencies
            const { blockchainServiceAmoy } = await import("../services/blockchainServiceAmoy");
            
            // Mint the NFT receipt
            const mintResult = await blockchainServiceAmoy.mockMintReceipt(
              fullReceipt,
              fullReceipt.items,
              {
                theme: metadata.nftTheme || 'default',
                fee: metadata.nftFee || '0.99'
              }
            );
            
            if (mintResult.success) {
              // Update receipt with blockchain info
              await storage.updateReceipt(receiptId, {
                blockchainTxHash: mintResult.txHash,
                nftTokenId: mintResult.tokenId?.toString(),
                blockchainVerified: true,
                ipfsCid: mintResult.ipfsCid,
                ipfsUrl: mintResult.ipfsUrl,
                encryptionKey: mintResult.encryptionKey
              });
              
              log(`Successfully minted NFT for receipt ${receiptId}`, "blockchain");
              
              // Add NFT info to the payment response
              payment.nftInfo = {
                minted: true,
                tokenId: mintResult.tokenId,
                txHash: mintResult.txHash
              };
            } else {
              log(`Failed to mint NFT for receipt ${receiptId}: ${mintResult.error}`, "blockchain");
              
              // Add NFT info to the payment response
              payment.nftInfo = {
                minted: false,
                error: mintResult.error,
                pending: true
              };
            }
          }
        } catch (error: any) {
          log(`Error minting NFT for receipt ${receiptId}: ${error.message}`, "blockchain");
          payment.nftInfo = {
            minted: false,
            error: error.message,
            pending: true
          };
        }
      }
    }
    
    res.json(payment);
  } catch (error: any) {
    log(`Error creating mock payment: ${error.message}`, "payments");
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get payment info for a receipt
 */
router.get("/receipt/:receiptId", async (req, res) => {
  try {
    const receiptId = parseInt(req.params.receiptId);
    if (isNaN(receiptId)) {
      return res.status(400).json({
        isComplete: false,
        error: "Invalid receipt ID"
      });
    }

    // Get receipt to check payment status
    const receipt = await storage.getReceipt(receiptId);
    if (!receipt) {
      return res.status(404).json({
        isComplete: false,
        error: "Receipt not found"
      });
    }

    // Check if receipt has payment info
    if (!receipt.paymentId) {
      return res.json({
        isComplete: false,
        method: null,
        id: null
      });
    }

    // If receipt has payment info, return it
    return res.json({
      isComplete: receipt.paymentComplete || false,
      method: receipt.paymentMethod || null,
      id: receipt.paymentId || null,
      amount: receipt.paymentAmount || null,
      currency: receipt.paymentCurrency || "usd",
      date: receipt.paymentDate || null,
      receiptUrl: receipt.stripeReceiptUrl || null
    });

  } catch (error: any) {
    log(`Error retrieving receipt payment info: ${error.message}`, "payments");
    res.status(500).json({
      isComplete: false,
      error: error.message
    });
  }
});

/**
 * Get payment details by ID
 */
router.get("/:paymentId", async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await retrievePayment(paymentId);
    res.json(payment);
  } catch (error: any) {
    log(`Error retrieving payment: ${error.message}`, "payments");
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;