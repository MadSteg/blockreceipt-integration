/**
 * Encrypted Payment Service
 * 
 * This service extends the payment functionality with threshold encryption
 * to enhance privacy and security in the payment flow.
 */
import * as ThresholdCrypto from '../lib/thresholdCrypto';
import { log } from '../vite';
import { thresholdReceiptService } from './thresholdReceiptService';

// Types
export interface EncryptedPaymentDetails {
  id: string;
  amount: number;
  encryptedData: string;
  ownerPublicKey: string;
  createdAt: Date;
  status: 'pending' | 'processed' | 'failed';
}

// In-memory store for encrypted payment data
// In a production app, this would be in a database
const encryptedPayments = new Map<string, EncryptedPaymentDetails>();

/**
 * Create an encrypted payment record
 * @param paymentId The payment ID (from Stripe or mock)
 * @param paymentData Payment data to encrypt
 * @param userId The user ID
 * @returns The encrypted payment details
 */
export async function createEncryptedPayment(
  paymentId: string,
  paymentData: any,
  userId: number
): Promise<EncryptedPaymentDetails> {
  try {
    // Ensure user has encryption keys
    const userKeys = thresholdReceiptService.ensureUserKeys(userId);
    
    // Prepare payment data with timestamp
    const dataToEncrypt = {
      ...paymentData,
      encryptedAt: new Date(),
      originalPaymentId: paymentId
    };
    
    // Encrypt the payment data
    const encryptedData = ThresholdCrypto.encrypt(dataToEncrypt, userKeys.publicKey);
    
    // Create encrypted payment record
    const encryptedPayment: EncryptedPaymentDetails = {
      id: paymentId,
      amount: paymentData.amount,
      encryptedData,
      ownerPublicKey: userKeys.publicKey,
      createdAt: new Date(),
      status: 'pending'
    };
    
    // Store the encrypted payment
    encryptedPayments.set(paymentId, encryptedPayment);
    
    log(`Created encrypted payment ${paymentId}`, 'payments');
    return encryptedPayment;
  } catch (error: any) {
    log(`Error creating encrypted payment: ${error.message}`, 'payments');
    throw new Error(`Failed to create encrypted payment: ${error.message}`);
  }
}

/**
 * Get an encrypted payment by ID
 * @param paymentId The payment ID
 * @returns The encrypted payment details or undefined if not found
 */
export function getEncryptedPayment(paymentId: string): EncryptedPaymentDetails | undefined {
  return encryptedPayments.get(paymentId);
}

/**
 * Decrypt a payment for the owner
 * @param paymentId The payment ID
 * @param userId The user ID (must be the owner)
 * @returns The decrypted payment data
 */
export function decryptPayment(paymentId: string, userId: number): any {
  try {
    // Get the encrypted payment
    const encryptedPayment = encryptedPayments.get(paymentId);
    if (!encryptedPayment) {
      throw new Error('Payment not found');
    }
    
    // Get the user's keys
    const userKeys = thresholdReceiptService.ensureUserKeys(userId);
    
    // Decrypt the payment data
    const decryptedData = ThresholdCrypto.decrypt(
      encryptedPayment.encryptedData, 
      userKeys.privateKey
    );
    
    return {
      success: true,
      payment: {
        ...decryptedData,
        id: paymentId,
        amount: encryptedPayment.amount,
        status: encryptedPayment.status
      }
    };
  } catch (error: any) {
    log(`Error decrypting payment: ${error.message}`, 'payments');
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update the status of an encrypted payment
 * @param paymentId The payment ID
 * @param status The new status
 * @returns The updated payment or undefined if not found
 */
export function updateEncryptedPaymentStatus(
  paymentId: string,
  status: 'pending' | 'processed' | 'failed'
): EncryptedPaymentDetails | undefined {
  const payment = encryptedPayments.get(paymentId);
  
  if (payment) {
    payment.status = status;
    encryptedPayments.set(paymentId, payment);
    
    log(`Updated payment ${paymentId} status to ${status}`, 'payments');
    return payment;
  }
  
  return undefined;
}

/**
 * Links an encrypted payment to a receipt NFT
 * @param paymentId The payment ID
 * @param receiptId The receipt ID
 * @param nftTokenId The NFT token ID
 * @returns Success status
 */
export function linkPaymentToReceiptNFT(
  paymentId: string,
  receiptId: number,
  nftTokenId: string
): boolean {
  try {
    const payment = encryptedPayments.get(paymentId);
    
    if (!payment) {
      throw new Error('Payment not found');
    }
    
    // In a real implementation, we would update the encrypted data
    // to include the receipt and NFT information
    
    // Update payment status
    payment.status = 'processed';
    encryptedPayments.set(paymentId, payment);
    
    log(`Linked payment ${paymentId} to receipt ${receiptId} with NFT ${nftTokenId}`, 'payments');
    return true;
  } catch (error: any) {
    log(`Error linking payment to receipt NFT: ${error.message}`, 'payments');
    return false;
  }
}

// Export the service functions
export const encryptedPaymentService = {
  createEncryptedPayment,
  getEncryptedPayment,
  decryptPayment,
  updateEncryptedPaymentStatus,
  linkPaymentToReceiptNFT
};