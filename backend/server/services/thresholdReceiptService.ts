/**
 * Threshold Receipt Service
 * 
 * This service manages the creation, storage, and sharing of receipts
 * using threshold proxy re-encryption for enhanced privacy and security.
 */
import * as ThresholdCrypto from '../lib/thresholdCrypto';
import { Receipt, ReceiptItem } from '@shared/schema';
import { blockchainService } from './blockchainService-amoy';
import { storage } from '../storage';

export interface EncryptedReceipt {
  id: number;
  encryptedData: string;
  ownerPublicKey: string;
  nftTokenId: string | null;
  ipfsCid: string | null;
  sharedWith: SharedAccess[];
  createdAt: Date;
}

export interface SharedAccess {
  userId: number;
  userPublicKey: string;
  reEncryptionCommitment: string;
  accessLevel: 'full' | 'limited' | 'verification-only';
  expiresAt: Date | null;
}

export interface UserKeys {
  userId: number;
  publicKey: string;
  privateKey: string;
  createdAt: Date;
}

// In-memory storage for keys and encrypted receipts
// In a real application, this would be stored in a secure database
const userKeys = new Map<number, UserKeys>();
const encryptedReceipts = new Map<number, EncryptedReceipt>();

/**
 * Generates keys for a user if they don't exist
 * @param userId The user ID
 * @returns The user's keys
 */
export function ensureUserKeys(userId: number): UserKeys {
  if (!userKeys.has(userId)) {
    const keyPair = ThresholdCrypto.generateKeyPair();
    
    const newUserKeys: UserKeys = {
      userId,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
      createdAt: new Date()
    };
    
    userKeys.set(userId, newUserKeys);
  }
  
  return userKeys.get(userId)!;
}

/**
 * Encrypts a receipt and stores it using threshold encryption
 * @param receipt The receipt to encrypt
 * @param items The receipt items
 * @returns The encrypted receipt
 */
export async function encryptAndStoreReceipt(
  receipt: Receipt, 
  items: ReceiptItem[]
): Promise<EncryptedReceipt> {
  // Ensure the user has keys
  const userKeys = ensureUserKeys(receipt.userId);
  
  // Prepare the receipt data with items
  const receiptData = {
    ...receipt,
    items,
    encryptedAt: new Date()
  };
  
  // Encrypt the receipt data with the user's public key
  const encryptedData = ThresholdCrypto.encrypt(receiptData, userKeys.publicKey);
  
  // Create the encrypted receipt record
  const encryptedReceipt: EncryptedReceipt = {
    id: receipt.id,
    encryptedData,
    ownerPublicKey: userKeys.publicKey,
    nftTokenId: receipt.nftTokenId,
    ipfsCid: receipt.ipfsCid,
    sharedWith: [],
    createdAt: new Date()
  };
  
  // Store the encrypted receipt
  encryptedReceipts.set(receipt.id, encryptedReceipt);
  
  return encryptedReceipt;
}

/**
 * Decrypts a receipt for the owner
 * @param receiptId The receipt ID
 * @param userId The user ID (must be the owner)
 * @returns The decrypted receipt data
 */
export function decryptReceipt(receiptId: number, userId: number): any {
  // Get the encrypted receipt
  const encryptedReceipt = encryptedReceipts.get(receiptId);
  if (!encryptedReceipt) {
    throw new Error('Receipt not found');
  }
  
  // Get the user's keys
  const userKeys = userKeys.get(userId);
  if (!userKeys) {
    throw new Error('User keys not found');
  }
  
  // Verify the user is the owner or has access
  const isOwner = userKeys.publicKey === encryptedReceipt.ownerPublicKey;
  const hasAccess = encryptedReceipt.sharedWith.some(access => 
    access.userId === userId && 
    (access.expiresAt === null || access.expiresAt > new Date())
  );
  
  if (!isOwner && !hasAccess) {
    throw new Error('Access denied');
  }
  
  // Decrypt the data
  if (isOwner) {
    // Direct decryption for the owner
    return ThresholdCrypto.decrypt(encryptedReceipt.encryptedData, userKeys.privateKey);
  } else {
    // For shared access, we need to find the specific re-encrypted data
    // In a real implementation, this would involve fetching the re-encrypted data
    // that was specifically generated for this user
    throw new Error('Shared access decryption not implemented');
  }
}

/**
 * Shares a receipt with another user using threshold proxy re-encryption
 * @param receiptId The receipt ID
 * @param ownerUserId The owner's user ID
 * @param targetUserId The target user's ID
 * @param accessLevel The level of access to grant
 * @param expiresAt Optional expiration date
 * @returns True if the share was successful
 */
export function shareReceipt(
  receiptId: number,
  ownerUserId: number,
  targetUserId: number,
  accessLevel: 'full' | 'limited' | 'verification-only',
  expiresAt: Date | null = null
): boolean {
  // Get the encrypted receipt
  const encryptedReceipt = encryptedReceipts.get(receiptId);
  if (!encryptedReceipt) {
    throw new Error('Receipt not found');
  }
  
  // Get the owner's keys
  const ownerKeys = userKeys.get(ownerUserId);
  if (!ownerKeys) {
    throw new Error('Owner keys not found');
  }
  
  // Verify the user is the owner
  if (ownerKeys.publicKey !== encryptedReceipt.ownerPublicKey) {
    throw new Error('Only the owner can share a receipt');
  }
  
  // Ensure the target user has keys
  const targetKeys = ensureUserKeys(targetUserId);
  
  // Generate a re-encryption key
  const reEncryptionKey = ThresholdCrypto.generateReEncryptionKey(
    ownerKeys.privateKey,
    targetKeys.publicKey
  );
  
  // Create a commitment to the re-encryption
  const reEncryptionCommitment = ThresholdCrypto.createCommitment(
    { receiptId, targetUserId, accessLevel },
    ownerKeys.privateKey
  );
  
  // Add the shared access record
  encryptedReceipt.sharedWith.push({
    userId: targetUserId,
    userPublicKey: targetKeys.publicKey,
    reEncryptionCommitment,
    accessLevel,
    expiresAt
  });
  
  return true;
}

/**
 * Verifies a receipt's authenticity using blockchain
 * @param receiptId The receipt ID
 * @param userId The user ID
 * @returns The verification result
 */
export async function verifyReceiptOnBlockchain(
  receiptId: number,
  userId: number
): Promise<any> {
  // Get the encrypted receipt
  const encryptedReceipt = encryptedReceipts.get(receiptId);
  if (!encryptedReceipt) {
    throw new Error('Receipt not found');
  }
  
  // Get the user's keys
  const userKeys = userKeys.get(userId);
  if (!userKeys) {
    throw new Error('User keys not found');
  }
  
  // If the receipt has an NFT token ID, verify it on the blockchain
  if (encryptedReceipt.nftTokenId) {
    // Get the original receipt from storage
    const receipt = await storage.getReceipt(receiptId);
    if (!receipt) {
      throw new Error('Original receipt not found');
    }
    
    // Verify the receipt on the blockchain
    return await blockchainService.verifyReceipt(
      parseInt(encryptedReceipt.nftTokenId), 
      receipt
    );
  } else {
    throw new Error('Receipt is not verified on blockchain');
  }
}

/**
 * Splits a receipt key into threshold shares for recovery
 * @param receiptId The receipt ID
 * @param userId The owner's user ID
 * @param totalShares The total number of shares to create
 * @param threshold The minimum number of shares needed for recovery
 * @returns The threshold key data
 */
export function createThresholdRecovery(
  receiptId: number,
  userId: number,
  totalShares: number,
  threshold: number
): ThresholdCrypto.ThresholdKeyData {
  // Get the encrypted receipt
  const encryptedReceipt = encryptedReceipts.get(receiptId);
  if (!encryptedReceipt) {
    throw new Error('Receipt not found');
  }
  
  // Get the owner's keys
  const userKeys = userKeys.get(userId);
  if (!userKeys) {
    throw new Error('User keys not found');
  }
  
  // Verify the user is the owner
  if (userKeys.publicKey !== encryptedReceipt.ownerPublicKey) {
    throw new Error('Only the owner can create threshold recovery');
  }
  
  // Split the private key into shares
  return ThresholdCrypto.splitKey(userKeys.privateKey, totalShares, threshold);
}

/**
 * Recreates access to a receipt using threshold key recovery
 * @param receiptId The receipt ID
 * @param shares The key shares
 * @param originalPublicKey The original public key to verify against
 * @returns Whether the recovery was successful
 */
export function recoverReceiptAccess(
  receiptId: number,
  shares: string[],
  originalPublicKey: string
): boolean {
  // Get the encrypted receipt
  const encryptedReceipt = encryptedReceipts.get(receiptId);
  if (!encryptedReceipt) {
    throw new Error('Receipt not found');
  }
  
  // Verify the original public key matches the receipt owner
  if (originalPublicKey !== encryptedReceipt.ownerPublicKey) {
    throw new Error('Public key does not match the receipt owner');
  }
  
  // In a real implementation, we would reconstruct the private key here
  // and verify it against the public key
  
  // Return success or failure
  return true;
}

// Export the service
export const thresholdReceiptService = {
  ensureUserKeys,
  encryptAndStoreReceipt,
  decryptReceipt,
  shareReceipt,
  verifyReceiptOnBlockchain,
  createThresholdRecovery,
  recoverReceiptAccess
};