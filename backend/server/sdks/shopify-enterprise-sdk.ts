/**
 * BlockReceipt Shopify Enterprise SDK
 * 
 * Enterprise-grade integration for Shopify e-commerce platform
 * Supports large-scale e-commerce operations with advanced features
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface ShopifyOrderData {
  orderId: string;
  merchantId: string;
  merchantName: string;
  customerPhone?: string;
  customerEmail?: string;
  totalAmount: number;
  subtotal: number;
  tax: number;
  shipping?: number;
  discount?: number;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    sku?: string;
    category?: string;
    vendor?: string;
    tags?: string[];
  }>;
  timestamp: number;
  shopDomain: string;
  customerId?: string;
  shippingAddress?: {
    firstName: string;
    lastName: string;
    address1: string;
    city: string;
    province: string;
    country: string;
    zip: string;
  };
}

export interface BlockReceiptResponse {
  success: boolean;
  tokenId: number;
  walletAddress: string;
  nftImageUrl: string;
  metadataUrl: string;
  transactionHash: string;
  loyaltyPoints: number;
  rewards?: Array<{
    type: 'points' | 'nft' | 'discount';
    value: number;
    description: string;
  }>;
}

export class ShopifyEnterpriseSDK {
  private apiKey: string;
  private webhookUrl: string;
  private blockReceiptApiUrl: string;
  private merchantId: string;
  private shopDomains: string[];
  private shopifyApiKey: string;
  private shopifyApiSecret: string;

  constructor(config: {
    apiKey: string;
    webhookUrl: string;
    blockReceiptApiUrl: string;
    merchantId: string;
    shopDomains: string[];
    shopifyApiKey: string;
    shopifyApiSecret: string;
  }) {
    this.apiKey = config.apiKey;
    this.webhookUrl = config.webhookUrl;
    this.blockReceiptApiUrl = config.blockReceiptApiUrl;
    this.merchantId = config.merchantId;
    this.shopDomains = config.shopDomains;
    this.shopifyApiKey = config.shopifyApiKey;
    this.shopifyApiSecret = config.shopifyApiSecret;
  }

  /**
   * Process a receipt from Shopify order
   * This is called when a customer wants to mint a BlockReceipt NFT
   */
  async processReceipt(orderData: ShopifyOrderData): Promise<BlockReceiptResponse> {
    try {
      logger.info(`[Shopify SDK] Processing receipt for order ${orderData.orderId}`);

      // Validate the order data
      this.validateOrderData(orderData);

      // Generate unique token ID
      const tokenId = this.generateTokenId(orderData);

      // Create customer wallet if needed
      const walletAddress = await this.getOrCreateCustomerWallet(orderData);

      // Prepare BlockReceipt API payload
      const blockReceiptPayload = {
        tokenId,
        to: walletAddress,
        merchantName: orderData.merchantName,
        totalCents: Math.round(orderData.totalAmount * 100),
        paymentLast4: this.extractPaymentLast4(orderData),
        timestamp: orderData.timestamp,
        items: orderData.items.map(item => ({
          desc: item.name,
          qty: item.quantity,
          unitCents: Math.round(item.price * 100),
          sku: item.sku,
          category: item.category,
          vendor: item.vendor,
          tags: item.tags
        })),
        // Enterprise-specific metadata
        enterprise: {
          orderId: orderData.orderId,
          shopDomain: orderData.shopDomain,
          customerId: orderData.customerId,
          shippingAddress: orderData.shippingAddress,
          merchantId: this.merchantId
        }
      };

      // Call BlockReceipt API
      const response = await this.callBlockReceiptAPI(blockReceiptPayload);

      // Calculate loyalty rewards
      const loyaltyPoints = this.calculateLoyaltyPoints(orderData);
      const rewards = this.calculateRewards(orderData, loyaltyPoints);

      logger.info(`[Shopify SDK] Successfully processed receipt ${orderData.orderId}`);

      return {
        success: true,
        tokenId: response.tokenId,
        walletAddress: response.to,
        nftImageUrl: response.image,
        metadataUrl: response.metadata,
        transactionHash: response.txHash,
        loyaltyPoints,
        rewards
      };

    } catch (error) {
      logger.error(`[Shopify SDK] Error processing receipt: ${error}`);
      throw new Error(`Failed to process receipt: ${error.message}`);
    }
  }

  /**
   * Get customer's receipt history and loyalty status
   */
  async getCustomerStatus(customerEmail: string): Promise<{
    hasWallet: boolean;
    walletAddress?: string;
    totalReceipts: number;
    loyaltyPoints: number;
    recentReceipts: Array<{
      tokenId: number;
      merchantName: string;
      amount: number;
      timestamp: number;
      nftImageUrl: string;
    }>;
  }> {
    try {
      const response = await fetch(`${this.blockReceiptApiUrl}/api/customer/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({ customerEmail })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`[Shopify SDK] Error getting customer status: ${error}`);
      throw new Error(`Failed to get customer status: ${error.message}`);
    }
  }

  /**
   * Create Shopify app installation for merchant
   */
  async createAppInstallation(shopDomain: string): Promise<{
    success: boolean;
    installationUrl: string;
    webhookUrl: string;
  }> {
    try {
      const installationUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${this.shopifyApiKey}&scope=read_orders,write_orders&redirect_uri=${encodeURIComponent(this.webhookUrl)}`;
      
      return {
        success: true,
        installationUrl,
        webhookUrl: `${this.webhookUrl}/shopify/webhook`
      };
    } catch (error) {
      logger.error(`[Shopify SDK] Error creating app installation: ${error}`);
      throw new Error(`Failed to create app installation: ${error.message}`);
    }
  }

  /**
   * Validate order data before processing
   */
  private validateOrderData(data: ShopifyOrderData): void {
    if (!data.orderId || !data.merchantId || !data.totalAmount) {
      throw new Error('Missing required order data');
    }

    if (data.totalAmount <= 0) {
      throw new Error('Invalid total amount');
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('No items in order');
    }

    if (!this.shopDomains.includes(data.shopDomain)) {
      throw new Error('Invalid shop domain');
    }
  }

  /**
   * Generate unique token ID for the receipt
   */
  private generateTokenId(data: ShopifyOrderData): number {
    const timestamp = Math.floor(Date.now() / 1000);
    const random = Math.floor(Math.random() * 10000);
    return parseInt(`${timestamp}${random}`.slice(-8));
  }

  /**
   * Get or create customer wallet based on email
   */
  private async getOrCreateCustomerWallet(data: ShopifyOrderData): Promise<string> {
    if (!data.customerEmail) {
      // Generate anonymous wallet
      return this.generateAnonymousWallet();
    }

    try {
      const response = await fetch(`${this.blockReceiptApiUrl}/api/wallet/get-or-create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify({
          customerEmail: data.customerEmail,
          merchantId: this.merchantId
        })
      });

      if (!response.ok) {
        throw new Error(`Wallet API error: ${response.status}`);
      }

      const result = await response.json();
      return result.walletAddress;
    } catch (error) {
      logger.error(`[Shopify SDK] Error with customer wallet: ${error}`);
      // Fallback to anonymous wallet
      return this.generateAnonymousWallet();
    }
  }

  /**
   * Generate anonymous wallet for customers without email
   */
  private generateAnonymousWallet(): string {
    // Generate a deterministic wallet address for anonymous users
    const randomBytes = crypto.randomBytes(20);
    return '0x' + randomBytes.toString('hex');
  }

  /**
   * Extract payment method info (simplified for demo)
   */
  private extractPaymentLast4(data: ShopifyOrderData): string {
    // In real implementation, this would come from Shopify payment data
    return '****';
  }

  /**
   * Call BlockReceipt API to mint the NFT
   */
  private async callBlockReceiptAPI(payload: any): Promise<any> {
    const response = await fetch(`${this.blockReceiptApiUrl}/pos/mint`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`BlockReceipt API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Calculate loyalty points based on order
   */
  private calculateLoyaltyPoints(data: ShopifyOrderData): number {
    // Base points: 1 point per dollar
    let points = Math.floor(data.totalAmount);
    
    // Bonus points for specific categories
    data.items.forEach(item => {
      if (item.category === 'electronics' || item.category === 'technology') {
        points += 5; // Tech bonus
      }
      if (item.tags?.includes('sustainable') || item.tags?.includes('eco-friendly')) {
        points += 10; // Sustainability bonus
      }
      if (item.vendor === 'premium-brand') {
        points += 15; // Premium brand bonus
      }
    });

    // First-time customer bonus
    if (data.customerId && data.customerId.includes('new')) {
      points += 50; // New customer bonus
    }

    return points;
  }

  /**
   * Calculate rewards based on loyalty points
   */
  private calculateRewards(data: ShopifyOrderData, points: number): Array<{
    type: 'points' | 'nft' | 'discount';
    value: number;
    description: string;
  }> {
    const rewards = [];

    // Base points reward
    rewards.push({
      type: 'points',
      value: points,
      description: `${points} loyalty points earned`
    });

    // NFT chance (3% chance for orders over $100)
    if (data.totalAmount >= 100 && Math.random() < 0.03) {
      rewards.push({
        type: 'nft',
        value: 1,
        description: 'Exclusive NFT reward earned!'
      });
    }

    // Discount threshold (100 points = $1 off)
    if (points >= 100) {
      const discountValue = Math.floor(points / 100);
      rewards.push({
        type: 'discount',
        value: discountValue,
        description: `$${discountValue} discount available`
      });
    }

    return rewards;
  }
}

/**
 * Shopify Webhook Handler
 * Handles incoming webhooks from Shopify
 */
export class ShopifyWebhookHandler {
  private sdk: ShopifyEnterpriseSDK;
  private webhookSecret: string;

  constructor(sdk: ShopifyEnterpriseSDK, webhookSecret: string) {
    this.sdk = sdk;
    this.webhookSecret = webhookSecret;
  }

  /**
   * Verify Shopify webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(payload, 'utf8');
    const hash = hmac.digest('base64');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(hash, 'base64')
    );
  }

  /**
   * Handle Shopify order webhook
   */
  async handleOrderWebhook(payload: any): Promise<{
    success: boolean;
    message: string;
    blockReceiptResponse?: BlockReceiptResponse;
  }> {
    try {
      // Extract order data from Shopify webhook
      const orderData = payload;
      
      // Convert to BlockReceipt format
      const receiptData: ShopifyOrderData = {
        orderId: orderData.id.toString(),
        merchantId: this.sdk['merchantId'],
        merchantName: orderData.shop_name || 'Shopify Store',
        customerPhone: orderData.customer?.phone,
        customerEmail: orderData.customer?.email,
        totalAmount: parseFloat(orderData.total_price),
        subtotal: parseFloat(orderData.subtotal_price),
        tax: parseFloat(orderData.total_tax),
        shipping: parseFloat(orderData.total_shipping_price_set?.shop_money?.amount || '0'),
        discount: parseFloat(orderData.total_discounts),
        items: orderData.line_items?.map((item: any) => ({
          name: item.title,
          price: parseFloat(item.price),
          quantity: item.quantity,
          sku: item.sku,
          category: item.product_type,
          vendor: item.vendor,
          tags: item.tags?.split(',').map((tag: string) => tag.trim())
        })) || [],
        timestamp: new Date(orderData.created_at).getTime(),
        shopDomain: orderData.shop_domain,
        customerId: orderData.customer?.id?.toString(),
        shippingAddress: orderData.shipping_address ? {
          firstName: orderData.shipping_address.first_name,
          lastName: orderData.shipping_address.last_name,
          address1: orderData.shipping_address.address1,
          city: orderData.shipping_address.city,
          province: orderData.shipping_address.province,
          country: orderData.shipping_address.country,
          zip: orderData.shipping_address.zip
        } : undefined
      };

      // Process the receipt
      const blockReceiptResponse = await this.sdk.processReceipt(receiptData);

      return {
        success: true,
        message: 'Receipt processed successfully',
        blockReceiptResponse
      };

    } catch (error) {
      logger.error(`[Shopify Webhook] Error handling order: ${error}`);
      return {
        success: false,
        message: `Error processing receipt: ${error.message}`
      };
    }
  }
}

export default ShopifyEnterpriseSDK;
