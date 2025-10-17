/**
 * Enterprise POS Integration Routes
 * 
 * API endpoints for enterprise POS systems (Toast, Shopify)
 * Handles webhooks, SDK integration, and merchant management
 */

import express from 'express';
import { z } from 'zod';
import { ToastEnterpriseSDK, ToastWebhookHandler } from '../sdks/toast-enterprise-sdk';
import { ShopifyEnterpriseSDK, ShopifyWebhookHandler } from '../sdks/shopify-enterprise-sdk';
import { AutoWalletService } from '../services/autoWalletService';
import { PrivacyDataSharingService } from '../services/privacyDataSharingService';
import { logger } from '../utils/logger';

const router = express.Router();

// Toast POS Integration
const toastSDK = new ToastEnterpriseSDK({
  apiKey: process.env.BLOCKRECEIPT_API_KEY || '',
  webhookUrl: process.env.WEBHOOK_URL || '',
  blockReceiptApiUrl: process.env.BLOCKRECEIPT_API_URL || '',
  merchantId: process.env.MERCHANT_ID || '',
  locationIds: (process.env.TOAST_LOCATION_IDS || '').split(',')
});

const toastWebhookHandler = new ToastWebhookHandler(
  toastSDK,
  process.env.TOAST_WEBHOOK_SECRET || ''
);

// Shopify Integration
const shopifySDK = new ShopifyEnterpriseSDK({
  apiKey: process.env.BLOCKRECEIPT_API_KEY || '',
  webhookUrl: process.env.WEBHOOK_URL || '',
  blockReceiptApiUrl: process.env.BLOCKRECEIPT_API_URL || '',
  merchantId: process.env.MERCHANT_ID || '',
  shopDomains: (process.env.SHOPIFY_SHOP_DOMAINS || '').split(','),
  shopifyApiKey: process.env.SHOPIFY_API_KEY || '',
  shopifyApiSecret: process.env.SHOPIFY_API_SECRET || ''
});

const shopifyWebhookHandler = new ShopifyWebhookHandler(
  shopifySDK,
  process.env.SHOPIFY_WEBHOOK_SECRET || ''
);

/**
 * Toast POS Webhook
 * POST /api/enterprise/toast/webhook
 */
router.post('/toast/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-toast-signature'] as string;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    if (!toastWebhookHandler.verifySignature(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Handle the webhook
    const result = await toastWebhookHandler.handleOrderWebhook(req.body);

    if (result.success) {
      logger.info(`[Toast Webhook] Successfully processed order: ${req.body.data?.guid}`);
      res.json(result);
    } else {
      logger.error(`[Toast Webhook] Failed to process order: ${result.message}`);
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error(`[Toast Webhook] Error: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Shopify Webhook
 * POST /api/enterprise/shopify/webhook
 */
router.post('/shopify/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-shopify-hmac-sha256'] as string;
    const payload = JSON.stringify(req.body);

    // Verify webhook signature
    if (!shopifyWebhookHandler.verifySignature(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Handle the webhook
    const result = await shopifyWebhookHandler.handleOrderWebhook(req.body);

    if (result.success) {
      logger.info(`[Shopify Webhook] Successfully processed order: ${req.body.id}`);
      res.json(result);
    } else {
      logger.error(`[Shopify Webhook] Failed to process order: ${result.message}`);
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error(`[Shopify Webhook] Error: ${error}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Process Receipt (Toast)
 * POST /api/enterprise/toast/process-receipt
 */
router.post('/toast/process-receipt', async (req, res) => {
  try {
    const schema = z.object({
      orderId: z.string(),
      merchantId: z.string(),
      merchantName: z.string(),
      customerPhone: z.string().optional(),
      customerEmail: z.string().optional(),
      totalAmount: z.number(),
      subtotal: z.number(),
      tax: z.number(),
      tip: z.number().optional(),
      items: z.array(z.object({
        name: z.string(),
        price: z.number(),
        quantity: z.number(),
        category: z.string().optional(),
        modifiers: z.array(z.string()).optional()
      })),
      timestamp: z.number(),
      locationId: z.string(),
      serverId: z.string().optional(),
      tableNumber: z.string().optional()
    });

    const receiptData = schema.parse(req.body);

    // Process the receipt
    const result = await toastSDK.processReceipt(receiptData);

    res.json(result);

  } catch (error) {
    logger.error(`[Toast Process Receipt] Error: ${error}`);
    res.status(500).json({ error: 'Failed to process receipt' });
  }
});

/**
 * Process Receipt (Shopify)
 * POST /api/enterprise/shopify/process-receipt
 */
router.post('/shopify/process-receipt', async (req, res) => {
  try {
    const schema = z.object({
      orderId: z.string(),
      merchantId: z.string(),
      merchantName: z.string(),
      customerPhone: z.string().optional(),
      customerEmail: z.string().optional(),
      totalAmount: z.number(),
      subtotal: z.number(),
      tax: z.number(),
      shipping: z.number().optional(),
      discount: z.number().optional(),
      items: z.array(z.object({
        name: z.string(),
        price: z.number(),
        quantity: z.number(),
        sku: z.string().optional(),
        category: z.string().optional(),
        vendor: z.string().optional(),
        tags: z.array(z.string()).optional()
      })),
      timestamp: z.number(),
      shopDomain: z.string(),
      customerId: z.string().optional(),
      shippingAddress: z.object({
        firstName: z.string(),
        lastName: z.string(),
        address1: z.string(),
        city: z.string(),
        province: z.string(),
        country: z.string(),
        zip: z.string()
      }).optional()
    });

    const orderData = schema.parse(req.body);

    // Process the receipt
    const result = await shopifySDK.processReceipt(orderData);

    res.json(result);

  } catch (error) {
    logger.error(`[Shopify Process Receipt] Error: ${error}`);
    res.status(500).json({ error: 'Failed to process receipt' });
  }
});

/**
 * Get Customer Status
 * GET /api/enterprise/customer/status/:phone
 */
router.get('/customer/status/:phone', async (req, res) => {
  try {
    const { phone } = req.params;

    // Get or create wallet
    const walletResult = await AutoWalletService.getOrCreateWallet(phone);

    if (!walletResult.success) {
      return res.status(400).json(walletResult);
    }

    // Get customer status from Toast SDK
    const customerStatus = await toastSDK.getCustomerStatus(phone);

    res.json({
      ...customerStatus,
      walletAddress: walletResult.walletAddress,
      isNewWallet: walletResult.isNewWallet
    });

  } catch (error) {
    logger.error(`[Customer Status] Error: ${error}`);
    res.status(500).json({ error: 'Failed to get customer status' });
  }
});

/**
 * Get Customer Status (Email)
 * GET /api/enterprise/customer/status-email/:email
 */
router.get('/customer/status-email/:email', async (req, res) => {
  try {
    const { email } = req.params;

    // Get or create wallet
    const walletResult = await AutoWalletService.getOrCreateWallet('', email);

    if (!walletResult.success) {
      return res.status(400).json(walletResult);
    }

    // Get customer status from Shopify SDK
    const customerStatus = await shopifySDK.getCustomerStatus(email);

    res.json({
      ...customerStatus,
      walletAddress: walletResult.walletAddress,
      isNewWallet: walletResult.isNewWallet
    });

  } catch (error) {
    logger.error(`[Customer Status Email] Error: ${error}`);
    res.status(500).json({ error: 'Failed to get customer status' });
  }
});

/**
 * Data Sharing Request
 * POST /api/enterprise/data-sharing/request
 */
router.post('/data-sharing/request', async (req, res) => {
  try {
    const schema = z.object({
      merchantId: z.number(),
      dataTypes: z.array(z.enum(['purchase_history', 'demographics', 'preferences', 'contact_info'])),
      rewardOffered: z.number(),
      description: z.string(),
      expiresAt: z.string().optional()
    });

    const requestData = schema.parse(req.body);

    const result = await PrivacyDataSharingService.createDataSharingRequest(
      requestData.merchantId,
      requestData
    );

    res.json(result);

  } catch (error) {
    logger.error(`[Data Sharing Request] Error: ${error}`);
    res.status(500).json({ error: 'Failed to create data sharing request' });
  }
});

/**
 * Grant Data Sharing Consent
 * POST /api/enterprise/data-sharing/grant-consent
 */
router.post('/data-sharing/grant-consent', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.number(),
      merchantId: z.number(),
      dataTypes: z.array(z.enum(['purchase_history', 'demographics', 'preferences', 'contact_info'])),
      rewardOffered: z.number()
    });

    const consentData = schema.parse(req.body);

    const result = await PrivacyDataSharingService.grantDataSharingConsent(
      consentData.userId,
      consentData.merchantId,
      consentData.dataTypes,
      consentData.rewardOffered
    );

    res.json(result);

  } catch (error) {
    logger.error(`[Data Sharing Consent] Error: ${error}`);
    res.status(500).json({ error: 'Failed to grant data sharing consent' });
  }
});

/**
 * Access Shared Data
 * POST /api/enterprise/data-sharing/access
 */
router.post('/data-sharing/access', async (req, res) => {
  try {
    const schema = z.object({
      merchantId: z.number(),
      userId: z.number(),
      dataTypes: z.array(z.string())
    });

    const accessData = schema.parse(req.body);

    const result = await PrivacyDataSharingService.accessSharedData(
      accessData.merchantId,
      accessData.userId,
      accessData.dataTypes
    );

    res.json(result);

  } catch (error) {
    logger.error(`[Data Sharing Access] Error: ${error}`);
    res.status(500).json({ error: 'Failed to access shared data' });
  }
});

/**
 * Revoke Data Sharing Consent
 * POST /api/enterprise/data-sharing/revoke-consent
 */
router.post('/data-sharing/revoke-consent', async (req, res) => {
  try {
    const schema = z.object({
      userId: z.number(),
      merchantId: z.number()
    });

    const revokeData = schema.parse(req.body);

    const result = await PrivacyDataSharingService.revokeDataSharingConsent(
      revokeData.userId,
      revokeData.merchantId
    );

    res.json(result);

  } catch (error) {
    logger.error(`[Data Sharing Revoke] Error: ${error}`);
    res.status(500).json({ error: 'Failed to revoke data sharing consent' });
  }
});

/**
 * Get User Receipts
 * GET /api/enterprise/user/:userId/receipts
 */
router.get('/user/:userId/receipts', async (req, res) => {
  try {
    const { userId } = req.params;
    const receipts = await AutoWalletService.getUserReceipts(parseInt(userId));

    res.json({
      success: true,
      receipts,
      count: receipts.length
    });

  } catch (error) {
    logger.error(`[User Receipts] Error: ${error}`);
    res.status(500).json({ error: 'Failed to get user receipts' });
  }
});

/**
 * Connect Wallet to Account
 * POST /api/enterprise/wallet/connect
 */
router.post('/wallet/connect', async (req, res) => {
  try {
    const schema = z.object({
      phoneNumber: z.string(),
      email: z.string(),
      walletAddress: z.string()
    });

    const connectData = schema.parse(req.body);

    const result = await AutoWalletService.connectWalletToAccount(
      connectData.phoneNumber,
      connectData.email,
      connectData.walletAddress
    );

    res.json(result);

  } catch (error) {
    logger.error(`[Wallet Connect] Error: ${error}`);
    res.status(500).json({ error: 'Failed to connect wallet' });
  }
});

export default router;
