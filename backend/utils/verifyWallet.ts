/**
 * Wallet signature verification utilities
 * 
 * This file contains functions for verifying wallet signatures for authentication.
 */
import { ethers } from 'ethers';

/**
 * Verify a wallet signature matches the expected message and address
 * 
 * @param walletAddress The wallet address that signed the message
 * @param signature The signature to verify
 * @param nonce The nonce used in the message (for preventing replay attacks)
 * @returns Boolean indicating if the signature is valid
 */
export function verifyWalletSignature(walletAddress: string, signature: string, nonce: string): boolean {
  try {
    // The message should match exactly what was shown to the user to sign
    const message = `Login to BlockReceipt with nonce: ${nonce}`;
    
    // Recover the address that signed the message
    const recoveredAddress = ethers.utils.verifyMessage(message, signature);
    
    // Compare the recovered address to the expected address (case-insensitive)
    return recoveredAddress.toLowerCase() === walletAddress.toLowerCase();
  } catch (error) {
    console.error('Wallet signature verification error:', error);
    return false;
  }
}

/**
 * Generate a random nonce for wallet signature requests
 * 
 * @returns A random nonce string
 */
export function generateWalletNonce(): string {
  // Generate a random string for use as a nonce
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}