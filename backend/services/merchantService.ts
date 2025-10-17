/**
 * Merchant Service
 * 
 * Handles merchant identification, pattern matching, and promotion management
 */

import { db } from '../db';
import { merchants, merchantNamePatterns, merchantPromotions } from '@shared/schema';
import { eq, like, and, gte, lte } from 'drizzle-orm';
import { createLogger } from '../logger';

const logger = createLogger('merchant-service');

export class MerchantService {
  /**
   * Identify a merchant from a receipt's extracted merchant name
   * Uses fuzzy matching against known merchant name patterns
   */
  async identifyMerchantFromReceipt(extractedMerchantName: string): Promise<{ merchantId: number | null, confidence: number }> {
    if (!extractedMerchantName || extractedMerchantName.trim() === '') {
      return { merchantId: null, confidence: 0 };
    }

    try {
      // Normalize the merchant name for better matching
      const normalizedName = extractedMerchantName.trim().toUpperCase();
      
      // Get all merchant patterns ordered by priority
      const patterns = await db.select()
        .from(merchantNamePatterns)
        .orderBy(merchantNamePatterns.priority);
      
      // Try exact matches first
      for (const pattern of patterns) {
        if (normalizedName === pattern.pattern.toUpperCase()) {
          return { merchantId: pattern.merchantId, confidence: 1.0 };
        }
      }
      
      // Then try contains matches
      for (const pattern of patterns) {
        if (normalizedName.includes(pattern.pattern.toUpperCase())) {
          return { merchantId: pattern.merchantId, confidence: 0.8 };
        }
      }
      
      // Try more fuzzy matching
      for (const pattern of patterns) {
        // Calculate Levenshtein distance or another fuzzy match algorithm
        const similarity = this.calculateStringSimilarity(normalizedName, pattern.pattern.toUpperCase());
        if (similarity > 0.7) {
          return { merchantId: pattern.merchantId, confidence: similarity };
        }
      }
      
      logger.info(`No merchant match found for "${extractedMerchantName}"`);
      return { merchantId: null, confidence: 0 };
    } catch (error) {
      logger.error(`Error identifying merchant: ${error}`);
      return { merchantId: null, confidence: 0 };
    }
  }

  /**
   * Simple string similarity calculation (0 to 1)
   * Uses Levenshtein distance normalized to string length
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    // Simple implementation for demo purposes
    // More sophisticated algorithms could be used in production
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;
    
    // Count matching characters
    let matches = 0;
    for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return matches / maxLength;
  }

  /**
   * Get active promotions for a merchant
   */
  async getMerchantPromotions(merchantId: number): Promise<any[]> {
    const now = new Date();
    
    try {
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
      
      return promotions;
    } catch (error) {
      logger.error(`Error fetching merchant promotions: ${error}`);
      return [];
    }
  }

  /**
   * Get a merchant by ID
   */
  async getMerchantById(merchantId: number) {
    try {
      const [merchant] = await db.select()
        .from(merchants)
        .where(eq(merchants.id, merchantId));
      
      return merchant || null;
    } catch (error) {
      logger.error(`Error fetching merchant: ${error}`);
      return null;
    }
  }

  /**
   * Add a merchant to the system
   */
  async addMerchant(merchantData: { 
    name: string, 
    logoUrl?: string, 
    website?: string, 
    category?: string,
    walletAddress?: string
  }) {
    try {
      const [merchant] = await db.insert(merchants)
        .values(merchantData)
        .returning();
      
      return merchant;
    } catch (error) {
      logger.error(`Error adding merchant: ${error}`);
      throw error;
    }
  }

  /**
   * Add a merchant name pattern
   */
  async addMerchantNamePattern(merchantId: number, pattern: string, priority: number = 0) {
    try {
      const [result] = await db.insert(merchantNamePatterns)
        .values({ merchantId, pattern, priority })
        .returning();
      
      return result;
    } catch (error) {
      logger.error(`Error adding merchant name pattern: ${error}`);
      throw error;
    }
  }

  /**
   * Create a merchant promotion
   */
  async createPromotion(promotionData: { 
    merchantId: number,
    title: string,
    description: string,
    startDate: Date,
    endDate: Date,
    couponCode?: string,
    discount?: number,
    minimumPurchase?: number
  }) {
    try {
      const [promotion] = await db.insert(merchantPromotions)
        .values({
          ...promotionData,
          isActive: true
        })
        .returning();
      
      return promotion;
    } catch (error) {
      logger.error(`Error creating promotion: ${error}`);
      throw error;
    }
  }
}

export const merchantService = new MerchantService();