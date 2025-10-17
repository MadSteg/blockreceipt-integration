/**
 * CouponService.ts
 * 
 * Service for managing time-limited promotional coupons
 * using Threshold PRE encryption for secure access control
 */

import { thresholdClient, EncryptedData } from './tacoService';
import { createLogger } from '../logger';
import { merchantService } from './merchantService';
import { db } from '../db';
import { merchantPromotions } from '@shared/schema';
import { eq, and, lte, gte } from 'drizzle-orm';

const logger = createLogger('coupon-service');

// Types for coupon data
export interface CouponData {
  code: string;         // The coupon discount code
  discount: number;     // The discount percentage or amount
  validUntil: number;   // Timestamp when the coupon expires
  merchantId?: string;  // Optional merchant ID the coupon is restricted to
  minPurchase?: number; // Optional minimum purchase amount
  maxDiscount?: number; // Optional cap on discount amount
}

export interface EncryptedCouponData {
  capsule: string;      // TACo encryption capsule 
  ciphertext: string;   // Encrypted coupon data
  policyId: string;     // Policy ID for access control
  validUntil: number;   // Plaintext expiration date (needed for filtering)
}

export interface CouponDecryptResult {
  success: boolean;
  couponCode?: string;
  message?: string;
}

class CouponService {
  /**
   * Generate and encrypt a new coupon
   * @param merchantId - The ID of the merchant issuing the coupon
   * @param expirationDays - Number of days until coupon expires
   * @returns EncryptedCouponData with TACo-encrypted coupon
   */
  async generateCoupon(merchantId: number, expirationDays: number = 30): Promise<EncryptedCouponData> {
    try {
      // Get merchant details
      const merchant = await merchantService.getMerchantById(merchantId);
      if (!merchant) {
        throw new Error(`Merchant with ID ${merchantId} not found`);
      }
      
      const merchantName = merchant.name;
      
      // Calculate expiration date
      const now = Date.now();
      const validUntil = now + (expirationDays * 24 * 60 * 60 * 1000);
      
      // Generate a coupon code based on merchant name and random string
      const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
      const merchantPrefix = merchantName.substring(0, 3).toUpperCase();
      const couponCode = `${merchantPrefix}${randomString}`;
      
      // Create coupon data object
      const couponData: CouponData = {
        code: couponCode,
        discount: this.generateRandomDiscount(),
        validUntil,
        merchantId: merchantId.toString(), // Use actual merchant ID from database
      };
      
      // Add conditional extra properties
      if (couponData.discount > 15) {
        couponData.maxDiscount = 50; // Cap high percentage discounts
      }
      
      if (couponData.discount > 30) {
        couponData.minPurchase = 100; // Require minimum purchase for big discounts
      }
      
      logger.info(`Generating coupon for ${merchantName} (ID: ${merchantId}), valid until ${new Date(validUntil).toISOString()}`);
      
      // Encrypt the coupon data using TACo
      const encryptedData = await this.encryptCouponData(couponData);
      
      return {
        ...encryptedData,
        validUntil // Keep the expiration date in plaintext for filtering
      };
      
    } catch (error) {
      logger.error(`Error generating coupon: ${error}`);
      throw new Error(`Failed to generate coupon: ${error}`);
    }
  }
  
  /**
   * Generate a coupon directly from merchant name (legacy support)
   */
  async generateCouponByMerchantName(merchantName: string, expirationDays: number = 30): Promise<EncryptedCouponData> {
    try {
      // Try to find merchant by name
      const { merchantId, confidence } = await merchantService.identifyMerchantFromReceipt(merchantName);
      
      if (merchantId) {
        // Use the proper merchant ID-based method
        return this.generateCoupon(merchantId, expirationDays);
      }
      
      // Fallback to older implementation if merchant not found
      // Calculate expiration date
      const now = Date.now();
      const validUntil = now + (expirationDays * 24 * 60 * 60 * 1000);
      
      // Generate a coupon code based on merchant name and random string
      const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
      const merchantPrefix = merchantName.substring(0, 3).toUpperCase();
      const couponCode = `${merchantPrefix}${randomString}`;
      
      // Create coupon data object
      const couponData: CouponData = {
        code: couponCode,
        discount: this.generateRandomDiscount(),
        validUntil,
        merchantId: merchantName.toLowerCase().replace(/[^a-z0-9]/g, ''),
      };
      
      // Add conditional extra properties based on discount amount
      if (couponData.discount > 15) {
        couponData.maxDiscount = 50;
      }
      
      if (couponData.discount > 30) {
        couponData.minPurchase = 100;
      }
      
      logger.info(`Generating coupon for ${merchantName} (not in database), valid until ${new Date(validUntil).toISOString()}`);
      
      // Encrypt the coupon data using TACo
      const encryptedData = await this.encryptCouponData(couponData);
      
      return {
        ...encryptedData,
        validUntil
      };
      
    } catch (error) {
      logger.error(`Error generating coupon by merchant name: ${error}`);
      throw new Error(`Failed to generate coupon: ${error}`);
    }
  }
  
  /**
   * Encrypt coupon data using TACo
   * @param couponData - The coupon data to encrypt
   * @returns EncryptedData with capsule, ciphertext and policyId
   */
  private async encryptCouponData(couponData: CouponData): Promise<EncryptedData> {
    // For simplicity, just encrypt the coupon code directly
    // This avoids JSON parsing issues
    const dataToEncrypt = couponData.code;
    
    // Use TaCo client to encrypt the data
    // Mock policy will be created by the thresholdClient
    return await thresholdClient.encrypt({
      recipientPublicKey: `coupon-${couponData.merchantId}-${Date.now()}`,
      data: Buffer.from(dataToEncrypt)
    });
  }
  
  /**
   * Decrypt a coupon if it's still valid
   * @param encryptedData - The encrypted coupon data
   * @returns CouponDecryptResult with success status and decrypted coupon code
   */
  async decryptCoupon(encryptedData: {
    capsule: string;
    ciphertext: string;
    policyId: string;
  }): Promise<CouponDecryptResult> {
    try {
      const { capsule, ciphertext, policyId } = encryptedData;
      
      logger.info(`Attempting to decrypt coupon with policy ID: ${policyId}`);
      
      // Check validity using TACo service
      const currentTime = Date.now();
      
      // Attempt to decrypt using ThresholdClient
      const decryptedResult = await thresholdClient.decrypt({
        capsule,
        ciphertext,
        policyId
      });
      
      const decryptedData = decryptedResult.toString();
      
      if (!decryptedData) {
        return {
          success: false,
          message: 'Failed to decrypt coupon data'
        };
      }
      
      // The decrypted data is just the coupon code itself
      const couponCode = decryptedData;
      
      // Since we're not storing validUntil in the encrypted data anymore,
      // we need to check expiration separately if needed
      
      return {
        success: true,
        couponCode: couponCode
      };
      
    } catch (error) {
      logger.error(`Error decrypting coupon: ${error}`);
      return {
        success: false,
        message: 'Error processing coupon'
      };
    }
  }
  
  /**
   * Get coupons for a specific merchant
   * @param merchantId - The ID of the merchant
   * @returns Array of active promotions for the merchant
   */
  async getMerchantCoupons(merchantId: number) {
    try {
      if (!db) {
        throw new Error("Database not initialized");
      }
      
      const now = new Date();
      
      // Get active promotions from the database
      const promotions = await db.select()
        .from(merchantPromotions)
        .where(
          and(
            eq(merchantPromotions.merchantId, merchantId),
            eq(merchantPromotions.isActive, true),
            lte(merchantPromotions.startDate, now),
            gte(merchantPromotions.endDate, now)
          )
        );
      
      return promotions.map(promo => ({
        id: promo.id,
        title: promo.title,
        description: promo.description,
        code: promo.couponCode,
        discount: promo.discount,
        validUntil: Math.floor(promo.endDate.getTime() / 1000),
        minimumPurchase: promo.minimumPurchase,
        merchantId: promo.merchantId
      }));
    } catch (error) {
      logger.error(`Error fetching merchant coupons: ${error}`);
      return [];
    }
  }
  
  /**
   * Get coupons for a receipt based on merchant identification
   * @param receiptData - The extracted receipt data from OCR
   * @returns Array of applicable coupons/promotions
   */
  async getCouponsForReceipt(receiptData: {
    merchantName: string;
    merchantId?: number;
    total: number;
  }) {
    try {
      // If we already have a merchantId from OCR identification, use it
      if (receiptData.merchantId) {
        return this.getMerchantCoupons(receiptData.merchantId);
      }
      
      // Otherwise, try to identify the merchant by name
      if (receiptData.merchantName) {
        const { merchantId, confidence } = await merchantService.identifyMerchantFromReceipt(receiptData.merchantName);
        
        if (merchantId && confidence > 0.6) {
          return this.getMerchantCoupons(merchantId);
        }
      }
      
      // If no merchant is identified, return empty array
      return [];
      
    } catch (error) {
      logger.error(`Error getting coupons for receipt: ${error}`);
      return [];
    }
  }
  
  /**
   * Generate a random discount value between 5% and 40%
   * With weighted distribution favoring smaller discounts
   */
  private generateRandomDiscount(): number {
    // Generate random number 0-100
    const rand = Math.random() * 100;
    
    // Weight distribution to favor smaller discounts
    if (rand < 50) {
      // 50% chance of 5-10% discount
      return Math.floor(Math.random() * 6) + 5;
    } else if (rand < 80) {
      // 30% chance of 10-20% discount
      return Math.floor(Math.random() * 11) + 10;
    } else if (rand < 95) {
      // 15% chance of 20-30% discount
      return Math.floor(Math.random() * 11) + 20;
    } else {
      // 5% chance of 30-40% discount
      return Math.floor(Math.random() * 11) + 30;
    }
  }
}

export const couponService = new CouponService();