/**
 * Auto Wallet Creation Service
 * 
 * Seamlessly creates wallets for users based on phone number
 * Users can retrieve their BlockReceipts later by connecting their phone
 */

import crypto from 'crypto';
import { ethers } from 'ethers';
import { logger } from '../utils/logger';
import { db } from '../db';
import { userWallets, userReceipts } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface AutoWallet {
  id: number;
  userId: number;
  phoneNumber: string;
  email?: string;
  walletAddress: string;
  privateKey: string; // Encrypted
  publicKey: string;
  createdAt: Date;
  isActive: boolean;
  lastAccessedAt?: Date;
}

export interface WalletCreationResult {
  success: boolean;
  walletAddress: string;
  isNewWallet: boolean;
  message: string;
  existingReceipts?: number;
}

export class AutoWalletService {
  private static readonly ENCRYPTION_KEY = process.env.WALLET_ENCRYPTION_KEY || 'default-encryption-key';
  private static readonly RPC_URL = process.env.POLYGON_MAINNET_RPC_URL || 'https://polygon-rpc.com';

  /**
   * Get or create a wallet for a user based on phone number
   * This is the core function that makes BlockReceipt seamless
   */
  static async getOrCreateWallet(
    phoneNumber: string,
    email?: string,
    merchantId?: number
  ): Promise<WalletCreationResult> {
    try {
      logger.info(`[AutoWallet] Getting or creating wallet for phone: ${phoneNumber}`);

      // Check if wallet already exists
      const existingWallet = await this.findWalletByPhone(phoneNumber);

      if (existingWallet) {
        // Update last accessed time
        await this.updateLastAccessed(existingWallet.id);

        // Get existing receipts count
        const receiptsCount = await this.getUserReceiptsCount(existingWallet.userId);

        logger.info(`[AutoWallet] Found existing wallet for ${phoneNumber}`);

        return {
          success: true,
          walletAddress: existingWallet.walletAddress,
          isNewWallet: false,
          message: 'Existing wallet found',
          existingReceipts: receiptsCount
        };
      }

      // Create new wallet
      const newWallet = await this.createNewWallet(phoneNumber, email, merchantId);

      logger.info(`[AutoWallet] Created new wallet for ${phoneNumber}: ${newWallet.walletAddress}`);

      return {
        success: true,
        walletAddress: newWallet.walletAddress,
        isNewWallet: true,
        message: 'New wallet created successfully'
      };

    } catch (error) {
      logger.error(`[AutoWallet] Error getting or creating wallet: ${error}`);
      return {
        success: false,
        walletAddress: '',
        isNewWallet: false,
        message: `Failed to create wallet: ${error.message}`
      };
    }
  }

  /**
   * Create a new wallet for a user
   */
  private static async createNewWallet(
    phoneNumber: string,
    email?: string,
    merchantId?: number
  ): Promise<AutoWallet> {
    try {
      // Generate new wallet
      const wallet = ethers.Wallet.createRandom();
      const walletAddress = wallet.address;
      const privateKey = wallet.privateKey;
      const publicKey = wallet.publicKey;

      // Encrypt private key
      const encryptedPrivateKey = this.encryptPrivateKey(privateKey);

      // Create user ID (in production, this would be from user management system)
      const userId = this.generateUserId(phoneNumber);

      // Store wallet in database
      const [newWallet] = await db.insert(userWallets).values({
        userId,
        phoneNumber,
        email,
        walletAddress,
        privateKey: encryptedPrivateKey,
        publicKey,
        merchantId,
        createdAt: new Date(),
        isActive: true
      }).returning();

      logger.info(`[AutoWallet] New wallet created: ${walletAddress}`);

      return {
        id: newWallet.id,
        userId: newWallet.userId,
        phoneNumber: newWallet.phoneNumber,
        email: newWallet.email,
        walletAddress: newWallet.walletAddress,
        privateKey: newWallet.privateKey,
        publicKey: newWallet.publicKey,
        createdAt: newWallet.createdAt,
        isActive: newWallet.isActive
      };

    } catch (error) {
      logger.error(`[AutoWallet] Error creating new wallet: ${error}`);
      throw new Error(`Failed to create new wallet: ${error.message}`);
    }
  }

  /**
   * Find existing wallet by phone number
   */
  private static async findWalletByPhone(phoneNumber: string): Promise<AutoWallet | null> {
    try {
      const [wallet] = await db
        .select()
        .from(userWallets)
        .where(eq(userWallets.phoneNumber, phoneNumber));

      if (!wallet) {
        return null;
      }

      return {
        id: wallet.id,
        userId: wallet.userId,
        phoneNumber: wallet.phoneNumber,
        email: wallet.email,
        walletAddress: wallet.walletAddress,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        createdAt: wallet.createdAt,
        isActive: wallet.isActive,
        lastAccessedAt: wallet.lastAccessedAt
      };

    } catch (error) {
      logger.error(`[AutoWallet] Error finding wallet by phone: ${error}`);
      return null;
    }
  }

  /**
   * Update last accessed time for wallet
   */
  private static async updateLastAccessed(walletId: number): Promise<void> {
    try {
      await db
        .update(userWallets)
        .set({ lastAccessedAt: new Date() })
        .where(eq(userWallets.id, walletId));

    } catch (error) {
      logger.error(`[AutoWallet] Error updating last accessed time: ${error}`);
    }
  }

  /**
   * Get user's receipts count
   */
  private static async getUserReceiptsCount(userId: number): Promise<number> {
    try {
      const receipts = await db
        .select()
        .from(userReceipts)
        .where(eq(userReceipts.userId, userId));

      return receipts.length;

    } catch (error) {
      logger.error(`[AutoWallet] Error getting receipts count: ${error}`);
      return 0;
    }
  }

  /**
   * Generate user ID based on phone number
   */
  private static generateUserId(phoneNumber: string): number {
    // Create deterministic user ID from phone number
    const hash = crypto.createHash('sha256').update(phoneNumber).digest('hex');
    return parseInt(hash.substring(0, 8), 16);
  }

  /**
   * Encrypt private key for secure storage
   */
  private static encryptPrivateKey(privateKey: string): string {
    try {
      const cipher = crypto.createCipher('aes-256-cbc', this.ENCRYPTION_KEY);
      let encrypted = cipher.update(privateKey, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return encrypted;

    } catch (error) {
      logger.error(`[AutoWallet] Error encrypting private key: ${error}`);
      throw new Error('Failed to encrypt private key');
    }
  }

  /**
   * Decrypt private key for wallet operations
   */
  private static decryptPrivateKey(encryptedPrivateKey: string): string {
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.ENCRYPTION_KEY);
      let decrypted = decipher.update(encryptedPrivateKey, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;

    } catch (error) {
      logger.error(`[AutoWallet] Error decrypting private key: ${error}`);
      throw new Error('Failed to decrypt private key');
    }
  }

  /**
   * Get wallet by phone number for API calls
   */
  static async getWalletByPhone(phoneNumber: string): Promise<AutoWallet | null> {
    return await this.findWalletByPhone(phoneNumber);
  }

  /**
   * Get wallet by email for API calls
   */
  static async getWalletByEmail(email: string): Promise<AutoWallet | null> {
    try {
      const [wallet] = await db
        .select()
        .from(userWallets)
        .where(eq(userWallets.email, email));

      if (!wallet) {
        return null;
      }

      return {
        id: wallet.id,
        userId: wallet.userId,
        phoneNumber: wallet.phoneNumber,
        email: wallet.email,
        walletAddress: wallet.walletAddress,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        createdAt: wallet.createdAt,
        isActive: wallet.isActive,
        lastAccessedAt: wallet.lastAccessedAt
      };

    } catch (error) {
      logger.error(`[AutoWallet] Error finding wallet by email: ${error}`);
      return null;
    }
  }

  /**
   * Get user's receipt history
   */
  static async getUserReceipts(userId: number): Promise<Array<{
    receiptId: number;
    merchantId: number;
    amount: number;
    timestamp: Date;
    nftTokenId?: number;
    nftImageUrl?: string;
  }>> {
    try {
      const receipts = await db
        .select()
        .from(userReceipts)
        .where(eq(userReceipts.userId, userId));

      return receipts.map(receipt => ({
        receiptId: receipt.id,
        merchantId: receipt.merchantId,
        amount: receipt.amount,
        timestamp: receipt.createdAt,
        nftTokenId: receipt.nftTokenId,
        nftImageUrl: receipt.nftImageUrl
      }));

    } catch (error) {
      logger.error(`[AutoWallet] Error getting user receipts: ${error}`);
      return [];
    }
  }

  /**
   * Connect existing wallet to user account
   * This allows users to claim their existing receipts
   */
  static async connectWalletToAccount(
    phoneNumber: string,
    email: string,
    existingWalletAddress: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      logger.info(`[AutoWallet] Connecting wallet ${existingWalletAddress} to account ${phoneNumber}`);

      // Check if wallet exists
      const existingWallet = await this.findWalletByPhone(phoneNumber);

      if (existingWallet) {
        return {
          success: false,
          message: 'Wallet already exists for this phone number'
        };
      }

      // Create wallet record with existing address
      const userId = this.generateUserId(phoneNumber);
      
      await db.insert(userWallets).values({
        userId,
        phoneNumber,
        email,
        walletAddress: existingWalletAddress,
        privateKey: '', // User manages their own private key
        publicKey: '',
        createdAt: new Date(),
        isActive: true
      });

      logger.info(`[AutoWallet] Wallet connected successfully`);

      return {
        success: true,
        message: 'Wallet connected successfully'
      };

    } catch (error) {
      logger.error(`[AutoWallet] Error connecting wallet: ${error}`);
      return {
        success: false,
        message: `Failed to connect wallet: ${error.message}`
      };
    }
  }
}

export default AutoWalletService;
