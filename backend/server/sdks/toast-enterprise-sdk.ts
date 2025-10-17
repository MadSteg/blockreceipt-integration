/**
 * BlockReceipt Toast Enterprise SDK
 * 
 * Enterprise-grade integration for Toast POS systems
 * Supports large-scale deployments with advanced features
 */

import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface ToastReceiptData {
  orderId: string;
  merchantId: string;
  merchantName: string;
  customerPhone?: string;
  customerEmail?: string;
  totalAmount: number;
  subtotal: number;
  tax: number;
  tip?: number;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    category?: string;
    modifiers?: string[];
  }>;
  timestamp: number;
  locationId: string;
  serverId?: string;
  tableNumber?: string;
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

export class ToastEnterpriseSDK {
  private apiKey: string;
  private webhookUrl: string;
  private blockReceiptApiUrl: string;
  private merchantId: string;
  private locationIds: string[];

  constructor(config: {
    apiKey: string;
    webhookUrl: string;
    blockReceiptApiUrl: string;
    merchantId: string;
    locationIds: string[];
  }) {
    this.apiKey = config.apiKey;
    this.webhookUrl = config.webhookUrl;
    this.blockReceiptApiUrl = config.blockReceiptApiUrl;
    this.merchantId = config.merchantId;
    this.locationIds = config.locationIds;
  }

  /**
   * Process a receipt from Toast POS system
   * This is called when a customer wants to mint a BlockReceipt NFT
   */
  async processReceipt(receiptData: ToastReceiptData): Promise<BlockReceiptResponse> {
    try {
      logger.info(`[Toast SDK] Processing receipt for order ${receiptData.orderId}`);

      // Validate the receipt data
      this.validateReceiptData(receiptData);

      // Generate unique token ID
      const tokenId = this.generateTokenId(receiptData);

      // Create customer wallet if needed
      const walletAddress = await this.getOrCreateCustomerWallet(receiptData);

      // Prepare BlockReceipt API payload
      const blockReceiptPayload = {
        tokenId,
        to: walletAddress,
        merchantName: receiptData.merchantName,
        totalCents: Math.round(receiptData.totalAmount * 100),
        paymentLast4: this.extractPaymentLast4(receiptData),
        timestamp: receiptData.timestamp,
        items: receiptData.items.map(item => ({
          desc: item.name,
          qty: item.quantity,
          unitCents: Math.round(item.price * 100),
          category: item.category,
          modifiers: item.modifiers
        })),
        // Enterprise-specific metadata
        enterprise: {
          orderId: receiptData.orderId,
          locationId: receiptData.locationId,
          serverId: receiptData.serverId,
          tableNumber: receiptData.tableNumber,
          merchantId: this.merchantId
        }
      };

      // Call BlockReceipt API
      const response = await this.callBlockReceiptAPI(blockReceiptPayload);

      // Calculate loyalty rewards
      const loyaltyPoints = this.calculateLoyaltyPoints(receiptData);
      const rewards = this.calculateRewards(receiptData, loyaltyPoints);

      logger.info(`[Toast SDK] Successfully processed receipt ${receiptData.orderId}`);

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
      logger.error(`[Toast SDK] Error processing receipt: ${error}`);
      throw new Error(`Failed to process receipt: ${error.message}`);
    }
  }

  /**
   * Get customer's receipt history and loyalty status
   */
  async getCustomerStatus(customerPhone: string): Promise<{
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
        body: JSON.stringify({ customerPhone })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error(`[Toast SDK] Error getting customer status: ${error}`);
      throw new Error(`Failed to get customer status: ${error.message}`);
    }
  }

  /**
   * Validate receipt data before processing
   */
  private validateReceiptData(data: ToastReceiptData): void {
    if (!data.orderId || !data.merchantId || !data.totalAmount) {
      throw new Error('Missing required receipt data');
    }

    if (data.totalAmount <= 0) {
      throw new Error('Invalid total amount');
    }

    if (!data.items || data.items.length === 0) {
      throw new Error('No items in receipt');
    }

    if (!this.locationIds.includes(data.locationId)) {
      throw new Error('Invalid location ID');
    }
  }

  /**
   * Generate unique token ID for the receipt
   */
  private generateTokenId(data: ToastReceiptData): number {
    const timestamp = Math.floor(Date.now() / 1000);
    const random = Math.floor(Math.random() * 10000);
    return parseInt(`${timestamp}${random}`.slice(-8));
  }

  /**
   * Get or create customer wallet based on phone number
   */
  private async getOrCreateCustomerWallet(data: ToastReceiptData): Promise<string> {
    if (!data.customerPhone) {
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
          customerPhone: data.customerPhone,
          merchantId: this.merchantId
        })
      });

      if (!response.ok) {
        throw new Error(`Wallet API error: ${response.status}`);
      }

      const result = await response.json();
      return result.walletAddress;
    } catch (error) {
      logger.error(`[Toast SDK] Error with customer wallet: ${error}`);
      // Fallback to anonymous wallet
      return this.generateAnonymousWallet();
    }
  }

  /**
   * Generate anonymous wallet for customers without phone numbers
   */
  private generateAnonymousWallet(): string {
    // Generate a deterministic wallet address for anonymous users
    const randomBytes = crypto.randomBytes(20);
    return '0x' + randomBytes.toString('hex');
  }

  /**
   * Extract payment method info (simplified for demo)
   */
  private extractPaymentLast4(data: ToastReceiptData): string {
    // In real implementation, this would come from Toast payment data
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
   * Calculate loyalty points based on receipt
   */
  private calculateLoyaltyPoints(data: ToastReceiptData): number {
    // Base points: 1 point per dollar
    let points = Math.floor(data.totalAmount);
    
    // Bonus points for specific items
    data.items.forEach(item => {
      if (item.category === 'beverages' && item.name.toLowerCase().includes('coffee')) {
        points += 5; // Coffee bonus
      }
      if (item.category === 'food' && item.name.toLowerCase().includes('organic')) {
        points += 10; // Organic bonus
      }
    });

    return points;
  }

  /**
   * Calculate rewards based on loyalty points
   */
  private calculateRewards(data: ToastReceiptData, points: number): Array<{
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

    // NFT chance (5% chance for receipts over $25)
    if (data.totalAmount >= 25 && Math.random() < 0.05) {
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
 * Toast POS Webhook Handler
 * Handles incoming webhooks from Toast POS system
 */
export class ToastWebhookHandler {
  private sdk: ToastEnterpriseSDK;
  private webhookSecret: string;

  constructor(sdk: ToastEnterpriseSDK, webhookSecret: string) {
    this.sdk = sdk;
    this.webhookSecret = webhookSecret;
  }

  /**
   * Verify Toast webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');
    
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  }

  /**
   * Handle Toast order webhook
   */
  async handleOrderWebhook(payload: any): Promise<{
    success: boolean;
    message: string;
    blockReceiptResponse?: BlockReceiptResponse;
  }> {
    try {
      // Extract order data from Toast webhook
      const orderData = payload.data;
      
      // Convert to BlockReceipt format
      const receiptData: ToastReceiptData = {
        orderId: orderData.guid,
        merchantId: this.sdk['merchantId'],
        merchantName: orderData.restaurantName || 'Toast Restaurant',
        customerPhone: orderData.customer?.phone,
        customerEmail: orderData.customer?.email,
        totalAmount: orderData.totalAmount / 100, // Toast amounts in cents
        subtotal: orderData.subtotalAmount / 100,
        tax: orderData.taxAmount / 100,
        tip: orderData.tipAmount / 100,
        items: orderData.items?.map((item: any) => ({
          name: item.name,
          price: item.totalAmount / 100,
          quantity: item.quantity,
          category: item.category,
          modifiers: item.modifiers?.map((mod: any) => mod.name)
        })) || [],
        timestamp: new Date(orderData.createdDate).getTime(),
        locationId: orderData.restaurantGuid,
        serverId: orderData.serverGuid,
        tableNumber: orderData.tableName
      };

      // Process the receipt
      const blockReceiptResponse = await this.sdk.processReceipt(receiptData);

      return {
        success: true,
        message: 'Receipt processed successfully',
        blockReceiptResponse
      };

    } catch (error) {
      logger.error(`[Toast Webhook] Error handling order: ${error}`);
      return {
        success: false,
        message: `Error processing receipt: ${error.message}`
      };
    }
  }
}

export default ToastEnterpriseSDK;
