import crypto from 'crypto';
import { db } from '../db';
import { merchants, receipts, paymentTokens, merchantStores } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createLogger } from '../logger';

const logger = createLogger('square-service');

interface SquarePaymentData {
  id: string;
  orderId?: string;
  locationId?: string;
  amountMoney: {
    amount: number;
    currency: string;
  };
  cardDetails?: {
    card?: {
      last4?: string;
      cardBrand?: string;
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface SquareLineItem {
  name: string;
  quantity: string;
  basePriceMoney: {
    amount: number;
    currency: string;
  };
}

interface MintedReceipt {
  id: number;
  merchantId: number;
  squareTransactionId: string;
  squarePaymentId: string;
  total: number;
  claimStatus: string;
  paymentToken: string;
}

class SquareService {
  /**
   * Verify Square webhook signature for security
   */
  async verifySquareWebhookSignature(
    body: string,
    signature: string,
    signatureKey: string
  ): Promise<boolean> {
    try {
      const hmac = crypto.createHmac('sha256', signatureKey);
      hmac.update(body);
      const hash = hmac.digest('base64');
      
      const isValid = hash === signature;
      
      if (!isValid) {
        logger.warn('[square] Webhook signature verification failed');
      }
      
      return isValid;
    } catch (error) {
      logger.error('[square] Error verifying webhook signature:', error);
      return false;
    }
  }

  /**
   * Generate payment token for matching (deterministic hash using immutable Square identifiers)
   * Never stores raw card numbers
   */
  generatePaymentToken(squareTransactionId: string, squarePaymentId: string, cardLast4?: string): string {
    const tokenData = `${squareTransactionId}_${squarePaymentId}_${cardLast4 || 'unknown'}`;
    const hash = crypto.createHash('sha256').update(tokenData).digest('hex');
    return hash.substring(0, 32);
  }

  /**
   * Generate hash of card last 4 digits only (for claim matching)
   * This allows customers to discover their receipts using just their card info
   */
  generateCardLast4Hash(cardLast4: string, cardType: string): string {
    const hashData = `${cardLast4}_${cardType.toUpperCase()}`;
    const hash = crypto.createHash('sha256').update(hashData).digest('hex');
    return hash.substring(0, 32);
  }

  /**
   * Get merchant by Square merchant ID
   */
  async getMerchantBySquareId(squareMerchantId: string) {
    if (!db) throw new Error("Database not available");
    
    const [merchant] = await db.select()
      .from(merchants)
      .where(eq(merchants.squareMerchantId, squareMerchantId))
      .limit(1);
    
    return merchant;
  }

  /**
   * Get store by Square location ID
   */
  async getStoreBySquareLocationId(locationId: string) {
    if (!db) throw new Error("Database not available");
    
    const [store] = await db.select()
      .from(merchantStores)
      .where(eq(merchantStores.squareLocationId, locationId))
      .limit(1);
    
    return store;
  }

  /**
   * Mint receipt from Square payment data
   * Extracts merchant info, store location, transaction details
   * Creates receipt record in database with claimStatus='unclaimed'
   */
  async mintReceiptFromSquarePayment(
    squarePaymentData: SquarePaymentData,
    merchantData: { id: number; name: string },
    lineItems: SquareLineItem[] = [],
    squareMerchantId: string
  ): Promise<MintedReceipt> {
    try {
      if (!db) throw new Error("Database not available");

      logger.info('[square] Starting receipt minting for payment:', squarePaymentData.id);

      const { id: paymentId, orderId, locationId, amountMoney, cardDetails, createdAt } = squarePaymentData;
      
      const cardLast4 = cardDetails?.card?.last4;
      const transactionId = orderId || paymentId;
      const paymentToken = this.generatePaymentToken(transactionId, paymentId, cardLast4);
      
      let storeId: number | null = null;
      if (locationId) {
        const store = await this.getStoreBySquareLocationId(locationId);
        storeId = store?.id || null;
      }

      const totalInCents = amountMoney.amount;
      
      const items = lineItems.map(item => ({
        name: item.name,
        price: item.basePriceMoney.amount / 100,
        quantity: parseInt(item.quantity) || 1
      }));

      const receiptData = {
        userId: null,
        merchantId: merchantData.id,
        storeId,
        date: new Date(createdAt),
        total: totalInCents,
        subtotal: totalInCents,
        tax: 0,
        items,
        category: 'General',
        squareTransactionId: orderId || paymentId,
        squarePaymentId: paymentId,
        claimStatus: 'unclaimed',
        autoMinted: true,
        isEncrypted: false
      };

      const [receipt] = await db.insert(receipts)
        .values(receiptData)
        .returning();

      const paymentMethod = cardDetails?.card?.cardBrand || 'UNKNOWN';
      const cardLast4HashValue = cardLast4 ? this.generateCardLast4Hash(cardLast4, paymentMethod) : null;
      
      await db.insert(paymentTokens)
        .values({
          receiptId: receipt.id,
          tokenType: cardLast4 ? 'card_last4' : 'card_token',
          tokenValue: paymentToken,
          paymentMethod: paymentMethod.toUpperCase(),
          cardLast4Hash: cardLast4HashValue
        });

      logger.info('[square] Receipt minted successfully:', {
        receiptId: receipt.id,
        paymentId,
        merchantId: merchantData.id,
        total: totalInCents / 100
      });

      return {
        id: receipt.id,
        merchantId: receipt.merchantId,
        squareTransactionId: receipt.squareTransactionId!,
        squarePaymentId: receipt.squarePaymentId!,
        total: receipt.total,
        claimStatus: receipt.claimStatus!,
        paymentToken
      };

    } catch (error) {
      logger.error('[square] Error minting receipt from payment:', error);
      throw error;
    }
  }

  /**
   * Exchange Square OAuth code for access token and store merchant credentials
   */
  async connectSquareMerchant(
    merchantId: number,
    oauthCode: string
  ): Promise<{ success: boolean; squareMerchantId?: string; error?: string }> {
    try {
      if (!db) throw new Error("Database not available");

      logger.info('[square] Exchanging OAuth code for merchant:', merchantId);

      const squareAppId = process.env.SQUARE_APPLICATION_ID;
      const squareAppSecret = process.env.SQUARE_APPLICATION_SECRET;
      
      if (!squareAppId || !squareAppSecret) {
        throw new Error('Square credentials not configured');
      }

      const tokenResponse = await fetch('https://connect.squareup.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Square-Version': '2024-01-18'
        },
        body: JSON.stringify({
          client_id: squareAppId,
          client_secret: squareAppSecret,
          code: oauthCode,
          grant_type: 'authorization_code'
        })
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(`Square OAuth failed: ${JSON.stringify(errorData)}`);
      }

      const tokenData = await tokenResponse.json();
      const { access_token, merchant_id } = tokenData;

      await db.update(merchants)
        .set({
          squareAccessToken: access_token,
          squareMerchantId: merchant_id,
          updatedAt: new Date()
        })
        .where(eq(merchants.id, merchantId));

      logger.info('[square] Successfully connected merchant to Square:', {
        merchantId,
        squareMerchantId: merchant_id
      });

      return {
        success: true,
        squareMerchantId: merchant_id
      };

    } catch (error) {
      logger.error('[square] Error connecting Square merchant:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

export const squareService = new SquareService();
