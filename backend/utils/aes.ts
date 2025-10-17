/**
 * AES Encryption Utilities
 * 
 * This file provides utility functions for encrypting and decrypting 
 * receipt data using AES-256-GCM, a secure encryption algorithm.
 */
import crypto from 'crypto';

const ALGO = 'aes-256-gcm';

/**
 * Encrypt a JSON object using AES-256-GCM
 * @param obj Object to encrypt
 * @returns Encrypted data string and encryption key
 */
export function encryptJSON(obj: any): { encrypted: string; key: string } {
  const iv = crypto.randomBytes(12);
  const key = crypto.randomBytes(32);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const data = Buffer.from(JSON.stringify(obj), 'utf8');
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return {
    encrypted: Buffer.concat([iv, tag, encrypted]).toString('base64'),
    key: key.toString('hex'),
  };
}

/**
 * Decrypt an encrypted JSON string using an encryption key
 * @param encryptedStr Encrypted data string
 * @param keyHex Encryption key in hex format
 * @returns Decrypted object
 */
export function decryptJSON(encryptedStr: string, keyHex: string): any {
  try {
    const key = Buffer.from(keyHex, 'hex');
    const encryptedData = Buffer.from(encryptedStr, 'base64');
    
    // Extract IV (first 12 bytes), auth tag (next 16 bytes), and ciphertext
    const iv = encryptedData.subarray(0, 12);
    const tag = encryptedData.subarray(12, 28);
    const ciphertext = encryptedData.subarray(28);
    
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final()
    ]);
    
    return JSON.parse(decrypted.toString('utf8'));
  } catch (error) {
    throw new Error(`Failed to decrypt data: ${error instanceof Error ? error.message : String(error)}`);
  }
}