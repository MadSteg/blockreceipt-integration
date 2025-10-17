import { WalletService } from './walletService';
import { db } from '../db';
import { userReceipts, users, userWallets } from '@shared/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { ExtractedReceiptData } from '@shared/schema';

export interface ReceiptDeliveryOptions {
  phoneNumber?: string;
  email?: string;
  walletAddress?: string;
  createWalletIfNeeded?: boolean;
}

export interface ReceiptAccessLink {
  accessToken: string;
  receiptId: number;
  walletAddress: string;
  expiresAt: Date;
  shareableUrl: string;
}

export interface InstantReceiptResult {
  success: boolean;
  receiptId: number;
  walletAddress: string;
  accessLink: ReceiptAccessLink;
  seedPhrase?: string; // Only provided if new wallet was created
  message: string;
}

export class ReceiptDeliveryService {
  
  /**
   * Process an instant receipt delivery - core functionality
   */
  static async deliverInstantReceipt(
    receiptData: ExtractedReceiptData,
    deliveryOptions: ReceiptDeliveryOptions
  ): Promise<InstantReceiptResult> {
    
    let walletAddress = deliveryOptions.walletAddress;
    let seedPhrase: string | undefined;
    let userId: number | null = null;

    // Step 1: Handle wallet creation/lookup
    if (!walletAddress && deliveryOptions.createWalletIfNeeded) {
      // Create guest wallet instantly
      const guestWallet = WalletService.createGuestWallet();
      walletAddress = guestWallet.address;
      seedPhrase = guestWallet.mnemonic;
    } else if (!walletAddress) {
      throw new Error('No wallet address provided and wallet creation not enabled');
    }

    // Step 2: Check for existing user by wallet or contact info
    if (deliveryOptions.email) {
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.email, deliveryOptions.email));
      
      if (existingUser) {
        userId = existingUser.id;
        // Get or create wallet for existing user
        let userWallet = await WalletService.getUserWallet(userId);
        if (!userWallet) {
          userWallet = await WalletService.createUserWallet(userId);
          seedPhrase = userWallet.seedPhrase;
        }
        walletAddress = userWallet.address;
      }
    }

    // Step 3: Store receipt in database
    const receiptRecord = await db.insert(userReceipts).values({
      userId: userId || 0, // Use 0 for guest receipts
      merchantName: receiptData.merchantName,
      date: receiptData.date,
      total: Math.round(receiptData.total * 100), // Convert to cents
      subtotal: Math.round((receiptData.subtotal || 0) * 100),
      tax: Math.round((receiptData.tax || 0) * 100),
      items: receiptData.items,
      category: receiptData.category
    }).returning();

    const receipt = receiptRecord[0];

    // Step 4: Generate secure access link
    const accessLink = await this.generateReceiptAccessLink(receipt.id, walletAddress);

    // Step 5: Return result with all necessary info
    return {
      success: true,
      receiptId: receipt.id,
      walletAddress,
      accessLink,
      seedPhrase,
      message: seedPhrase 
        ? "Receipt delivered! New wallet created for you."
        : "Receipt delivered to your wallet!"
    };
  }

  /**
   * Generate a secure, shareable access link for a receipt
   */
  static async generateReceiptAccessLink(
    receiptId: number, 
    walletAddress: string
  ): Promise<ReceiptAccessLink> {
    
    const accessToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30 days expiry

    // Store access token in memory/cache (in production, use Redis)
    // For now, we'll encode the info in the token itself
    const tokenData = {
      receiptId,
      walletAddress,
      expiresAt: expiresAt.getTime(),
      signature: this.signTokenData(receiptId, walletAddress, expiresAt)
    };

    const encodedToken = Buffer.from(JSON.stringify(tokenData)).toString('base64url');
    
    const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    const shareableUrl = `${baseUrl}/receipt/${encodedToken}`;

    return {
      accessToken: encodedToken,
      receiptId,
      walletAddress,
      expiresAt,
      shareableUrl
    };
  }

  /**
   * Verify and decode an access token
   */
  static verifyAccessToken(token: string): {
    receiptId: number;
    walletAddress: string;
    expiresAt: Date;
    isValid: boolean;
  } {
    try {
      const decodedData = JSON.parse(Buffer.from(token, 'base64url').toString());
      const { receiptId, walletAddress, expiresAt, signature } = decodedData;
      
      const expectedSignature = this.signTokenData(receiptId, walletAddress, new Date(expiresAt));
      const isSignatureValid = signature === expectedSignature;
      const isNotExpired = new Date() < new Date(expiresAt);
      
      return {
        receiptId,
        walletAddress,
        expiresAt: new Date(expiresAt),
        isValid: isSignatureValid && isNotExpired
      };
    } catch (error) {
      return {
        receiptId: 0,
        walletAddress: '',
        expiresAt: new Date(),
        isValid: false
      };
    }
  }

  /**
   * Get receipt by access token
   */
  static async getReceiptByToken(token: string) {
    const tokenData = this.verifyAccessToken(token);
    
    if (!tokenData.isValid) {
      throw new Error('Invalid or expired access token');
    }

    const [receipt] = await db
      .select()
      .from(userReceipts)
      .where(eq(userReceipts.id, tokenData.receiptId));

    if (!receipt) {
      throw new Error('Receipt not found');
    }

    return {
      receipt,
      walletAddress: tokenData.walletAddress
    };
  }

  /**
   * Send receipt via SMS (placeholder for future integration)
   */
  static async sendSMS(phoneNumber: string, message: string): Promise<boolean> {
    // Placeholder for SMS service integration (Twilio, etc.)
    console.log(`SMS would be sent to ${phoneNumber}: ${message}`);
    return true;
  }

  /**
   * Send receipt via email (placeholder for future integration)
   */
  static async sendEmail(email: string, subject: string, body: string): Promise<boolean> {
    // Placeholder for email service integration (SendGrid, etc.)
    console.log(`Email would be sent to ${email}: ${subject}`);
    return true;
  }

  /**
   * Private helper to sign token data for security
   */
  private static signTokenData(receiptId: number, walletAddress: string, expiresAt: Date): string {
    const secret = process.env.JWT_SECRET || 'default-dev-secret';
    const data = `${receiptId}:${walletAddress}:${expiresAt.getTime()}`;
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
}