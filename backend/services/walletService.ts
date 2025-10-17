import { ethers } from 'ethers';
import crypto from 'crypto';
import { db } from '../db';
import { userWallets, users } from '@shared/schema';
import { eq } from 'drizzle-orm';

export interface WalletInfo {
  address: string;
  mnemonic: string;
  privateKey: string;
}

export interface UserWalletData {
  id: number;
  address: string;
  seedPhrase?: string;
  userId: number;
}

export class WalletService {
  private static encryptionKey = process.env.WALLET_ENCRYPTION_KEY || 'default-dev-key-not-secure';

  /**
   * Generate a new wallet with mnemonic seed phrase
   */
  static generateWallet(): WalletInfo {
    // Generate a random wallet with mnemonic
    const wallet = ethers.Wallet.createRandom();
    
    return {
      address: wallet.address,
      mnemonic: wallet.mnemonic?.phrase || '',
      privateKey: wallet.privateKey
    };
  }

  /**
   * Encrypt sensitive data for database storage
   */
  private static encrypt(text: string): string {
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * Decrypt sensitive data from database
   */
  private static decrypt(encryptedText: string): string {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Create and store a wallet for a user
   */
  static async createUserWallet(userId: number): Promise<UserWalletData> {
    // Check if user already has a wallet
    const existingWallet = await this.getUserWallet(userId);
    if (existingWallet) {
      return existingWallet;
    }

    // Generate new wallet
    const walletInfo = this.generateWallet();
    
    // Encrypt the private key for storage
    const encryptedPrivateKey = this.encrypt(walletInfo.privateKey);

    // Store in database
    const [newWallet] = await db.insert(userWallets).values({
      userId,
      address: walletInfo.address,
      encryptedPrivateKey
    }).returning();

    return {
      id: newWallet.id,
      address: newWallet.address,
      seedPhrase: walletInfo.mnemonic,
      userId: newWallet.userId
    };
  }

  /**
   * Get user's wallet from database
   */
  static async getUserWallet(userId: number): Promise<UserWalletData | null> {
    const [wallet] = await db
      .select()
      .from(userWallets)
      .where(eq(userWallets.userId, userId));

    if (!wallet) return null;

    return {
      id: wallet.id,
      address: wallet.address,
      userId: wallet.userId
    };
  }

  /**
   * Get wallet with decrypted private key (for signing transactions)
   */
  static async getUserWalletWithPrivateKey(userId: number): Promise<WalletInfo | null> {
    const [wallet] = await db
      .select()
      .from(userWallets)
      .where(eq(userWallets.userId, userId));

    if (!wallet || !wallet.encryptedPrivateKey) return null;

    const privateKey = this.decrypt(wallet.encryptedPrivateKey);
    const ethersWallet = new ethers.Wallet(privateKey);

    return {
      address: wallet.address,
      privateKey,
      mnemonic: '' // We don't store mnemonic in DB for security
    };
  }

  /**
   * Create a guest wallet (no user account required)
   */
  static createGuestWallet(): WalletInfo {
    return this.generateWallet();
  }

  /**
   * Validate if an address is a valid Ethereum address
   */
  static isValidAddress(address: string): boolean {
    return ethers.utils.isAddress(address);
  }

  /**
   * Generate a secure access token for wallet operations
   */
  static generateAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}