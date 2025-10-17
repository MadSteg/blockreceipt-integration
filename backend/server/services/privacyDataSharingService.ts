/**
 * Privacy-Controlled Data Sharing Service
 * 
 * Implements TACo-based privacy controls for user data sharing
 * Users control what data merchants can access in exchange for rewards
 */

import { thresholdClient, encryptData, decryptData, grantAccess, revokeAccess } from './tacoService';
import { logger } from '../utils/logger';
import { db } from '../db';
import { userDataSharing, merchants, userReceipts } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

export interface DataSharingConsent {
  userId: number;
  merchantId: number;
  dataTypes: Array<'purchase_history' | 'demographics' | 'preferences' | 'contact_info'>;
  rewardOffered: number; // Points offered for sharing this data
  expiresAt?: Date;
  isActive: boolean;
}

export interface DataSharingRequest {
  merchantId: number;
  dataTypes: Array<'purchase_history' | 'demographics' | 'preferences' | 'contact_info'>;
  rewardOffered: number;
  description: string;
  expiresAt?: Date;
}

export interface UserDataAccess {
  userId: number;
  merchantId: number;
  dataTypes: string[];
  encryptedData: any;
  accessGrantedAt: Date;
  expiresAt?: Date;
}

export class PrivacyDataSharingService {
  
  /**
   * Create a data sharing request from a merchant
   * Merchants can request access to specific user data in exchange for rewards
   */
  static async createDataSharingRequest(
    merchantId: number,
    request: DataSharingRequest
  ): Promise<{ success: boolean; requestId: string; message: string }> {
    try {
      logger.info(`[Privacy] Creating data sharing request for merchant ${merchantId}`);

      // Validate merchant exists
      const [merchant] = await db
        .select()
        .from(merchants)
        .where(eq(merchants.id, merchantId));

      if (!merchant) {
        return {
          success: false,
          requestId: '',
          message: 'Merchant not found'
        };
      }

      // Create unique request ID
      const requestId = `req_${merchantId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Store the request (in production, this would be in a database)
      const request = {
        requestId,
        merchantId,
        dataTypes: request.dataTypes,
        rewardOffered: request.rewardOffered,
        description: request.description,
        expiresAt: request.expiresAt,
        createdAt: new Date(),
        isActive: true
      };

      logger.info(`[Privacy] Data sharing request created: ${requestId}`);

      return {
        success: true,
        requestId,
        message: 'Data sharing request created successfully'
      };

    } catch (error) {
      logger.error(`[Privacy] Error creating data sharing request: ${error}`);
      return {
        success: false,
        requestId: '',
        message: `Failed to create request: ${error.message}`
      };
    }
  }

  /**
   * User grants consent to share specific data with a merchant
   * This is where TACo encryption comes into play
   */
  static async grantDataSharingConsent(
    userId: number,
    merchantId: number,
    dataTypes: Array<'purchase_history' | 'demographics' | 'preferences' | 'contact_info'>,
    rewardOffered: number
  ): Promise<{ success: boolean; message: string; encryptedData?: any }> {
    try {
      logger.info(`[Privacy] User ${userId} granting data sharing consent to merchant ${merchantId}`);

      // Get user's data that matches the requested types
      const userData = await this.getUserDataForSharing(userId, dataTypes);

      if (!userData || Object.keys(userData).length === 0) {
        return {
          success: false,
          message: 'No data available for the requested types'
        };
      }

      // Encrypt the data using TACo
      const merchantPublicKey = await this.getMerchantPublicKey(merchantId);
      const encryptedData = await encryptData(
        JSON.stringify(userData),
        merchantPublicKey
      );

      // Store the consent and encrypted data
      await db.insert(userDataSharing).values({
        userId,
        merchantId,
        dataTypes: dataTypes.join(','),
        encryptedData: JSON.stringify(encryptedData),
        rewardOffered,
        accessGrantedAt: new Date(),
        isActive: true
      });

      // Award the user the promised reward
      await this.awardDataSharingReward(userId, merchantId, rewardOffered);

      logger.info(`[Privacy] Data sharing consent granted and encrypted for user ${userId}`);

      return {
        success: true,
        message: 'Data sharing consent granted successfully',
        encryptedData
      };

    } catch (error) {
      logger.error(`[Privacy] Error granting data sharing consent: ${error}`);
      return {
        success: false,
        message: `Failed to grant consent: ${error.message}`
      };
    }
  }

  /**
   * Merchant accesses the shared data (with user's consent)
   * Data is decrypted using TACo
   */
  static async accessSharedData(
    merchantId: number,
    userId: number,
    dataTypes: string[]
  ): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      logger.info(`[Privacy] Merchant ${merchantId} accessing shared data from user ${userId}`);

      // Get the encrypted data
      const [dataSharing] = await db
        .select()
        .from(userDataSharing)
        .where(
          and(
            eq(userDataSharing.userId, userId),
            eq(userDataSharing.merchantId, merchantId),
            eq(userDataSharing.isActive, true)
          )
        );

      if (!dataSharing) {
        return {
          success: false,
          message: 'No shared data found or consent not granted'
        };
      }

      // Decrypt the data using TACo
      const merchantPrivateKey = await this.getMerchantPrivateKey(merchantId);
      const encryptedData = JSON.parse(dataSharing.encryptedData);
      
      const decryptedData = await decryptData(encryptedData, merchantPrivateKey);
      const userData = JSON.parse(decryptedData);

      // Filter data based on requested types
      const filteredData = this.filterDataByTypes(userData, dataTypes);

      logger.info(`[Privacy] Shared data accessed successfully for merchant ${merchantId}`);

      return {
        success: true,
        data: filteredData,
        message: 'Shared data accessed successfully'
      };

    } catch (error) {
      logger.error(`[Privacy] Error accessing shared data: ${error}`);
      return {
        success: false,
        message: `Failed to access shared data: ${error.message}`
      };
    }
  }

  /**
   * User revokes consent for data sharing
   */
  static async revokeDataSharingConsent(
    userId: number,
    merchantId: number
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`[Privacy] User ${userId} revoking data sharing consent for merchant ${merchantId}`);

      // Update the data sharing record to inactive
      await db
        .update(userDataSharing)
        .set({ 
          isActive: false,
          revokedAt: new Date()
        })
        .where(
          and(
            eq(userDataSharing.userId, userId),
            eq(userDataSharing.merchantId, merchantId)
          )
        );

      // Revoke access using TACo
      const [dataSharing] = await db
        .select()
        .from(userDataSharing)
        .where(
          and(
            eq(userDataSharing.userId, userId),
            eq(userDataSharing.merchantId, merchantId)
          )
        );

      if (dataSharing) {
        const encryptedData = JSON.parse(dataSharing.encryptedData);
        await revokeAccess(encryptedData.policyId, await this.getMerchantPublicKey(merchantId));
      }

      logger.info(`[Privacy] Data sharing consent revoked for user ${userId}`);

      return {
        success: true,
        message: 'Data sharing consent revoked successfully'
      };

    } catch (error) {
      logger.error(`[Privacy] Error revoking data sharing consent: ${error}`);
      return {
        success: false,
        message: `Failed to revoke consent: ${error.message}`
      };
    }
  }

  /**
   * Get user's data that can be shared
   */
  private static async getUserDataForSharing(
    userId: number,
    dataTypes: string[]
  ): Promise<any> {
    const userData: any = {};

    // Get user's receipt history
    if (dataTypes.includes('purchase_history')) {
      const receipts = await db
        .select()
        .from(userReceipts)
        .where(eq(userReceipts.userId, userId));

      userData.purchaseHistory = receipts.map(receipt => ({
        receiptId: receipt.id,
        merchantId: receipt.merchantId,
        amount: receipt.amount,
        timestamp: receipt.createdAt,
        items: receipt.items
      }));
    }

    // Get user demographics (placeholder - would come from user profile)
    if (dataTypes.includes('demographics')) {
      userData.demographics = {
        ageRange: '25-34', // Placeholder
        location: 'Urban', // Placeholder
        incomeRange: '50k-75k' // Placeholder
      };
    }

    // Get user preferences (placeholder - would come from user profile)
    if (dataTypes.includes('preferences')) {
      userData.preferences = {
        favoriteCategories: ['electronics', 'clothing'], // Placeholder
        preferredBrands: ['Apple', 'Nike'], // Placeholder
        shoppingFrequency: 'weekly' // Placeholder
      };
    }

    // Get contact info (placeholder - would come from user profile)
    if (dataTypes.includes('contact_info')) {
      userData.contactInfo = {
        email: 'user@example.com', // Placeholder
        phone: '+1234567890', // Placeholder
        marketingOptIn: true // Placeholder
      };
    }

    return userData;
  }

  /**
   * Get merchant's public key for encryption
   */
  private static async getMerchantPublicKey(merchantId: number): Promise<string> {
    // In production, this would fetch from a secure key store
    // For now, return a placeholder
    return `merchant_${merchantId}_public_key`;
  }

  /**
   * Get merchant's private key for decryption
   */
  private static async getMerchantPrivateKey(merchantId: number): Promise<string> {
    // In production, this would fetch from a secure key store
    // For now, return a placeholder
    return `merchant_${merchantId}_private_key`;
  }

  /**
   * Award user points for sharing data
   */
  private static async awardDataSharingReward(
    userId: number,
    merchantId: number,
    rewardPoints: number
  ): Promise<void> {
    // This would integrate with the existing loyalty system
    logger.info(`[Privacy] Awarding ${rewardPoints} points to user ${userId} for data sharing`);
    
    // In production, this would call the loyalty rewards service
    // await LoyaltyRewardsService.awardPoints(userId, merchantId, rewardPoints);
  }

  /**
   * Filter data based on requested types
   */
  private static filterDataByTypes(data: any, requestedTypes: string[]): any {
    const filteredData: any = {};

    requestedTypes.forEach(type => {
      if (data[type]) {
        filteredData[type] = data[type];
      }
    });

    return filteredData;
  }

  /**
   * Get user's data sharing consents
   */
  static async getUserDataSharingConsents(userId: number): Promise<DataSharingConsent[]> {
    try {
      const consents = await db
        .select()
        .from(userDataSharing)
        .where(eq(userDataSharing.userId, userId));

      return consents.map(consent => ({
        userId: consent.userId,
        merchantId: consent.merchantId,
        dataTypes: consent.dataTypes.split(',') as Array<'purchase_history' | 'demographics' | 'preferences' | 'contact_info'>,
        rewardOffered: consent.rewardOffered,
        expiresAt: consent.expiresAt,
        isActive: consent.isActive
      }));

    } catch (error) {
      logger.error(`[Privacy] Error getting user data sharing consents: ${error}`);
      return [];
    }
  }

  /**
   * Get merchant's data sharing requests
   */
  static async getMerchantDataSharingRequests(merchantId: number): Promise<DataSharingRequest[]> {
    try {
      // In production, this would fetch from a database
      // For now, return placeholder data
      return [
        {
          merchantId,
          dataTypes: ['purchase_history', 'preferences'],
          rewardOffered: 100,
          description: 'Share your purchase history and preferences for 100 bonus points',
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      ];

    } catch (error) {
      logger.error(`[Privacy] Error getting merchant data sharing requests: ${error}`);
      return [];
    }
  }
}

export default PrivacyDataSharingService;
