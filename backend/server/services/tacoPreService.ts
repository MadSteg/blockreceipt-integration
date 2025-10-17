import { generateKeyPairSync, randomBytes, createCipheriv } from 'crypto';
import * as tacoPreClient from './tacoPreClient';
import { storage } from '../storage-real';
import { db } from '../db';
import { receiptPolicies, receipts, merchants } from '@shared/schema';
import { eq, sql, ilike } from 'drizzle-orm';

export function generateKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  });

  return {
    privateKeyPem: privateKey,
    publicKeyPem: publicKey
  };
}

// Helper to convert amount to cents (integer)
function toCents(amount: string | number | undefined): number {
  if (!amount) return 0;
  if (typeof amount === 'number') return Math.round(amount);
  // Parse string amount (could be dollars like "4.87")
  const parsed = parseFloat(amount);
  if (isNaN(parsed)) return 0;
  // If it's a small number (< 100), assume it's in dollars and convert to cents
  // Otherwise assume it's already in cents
  return parsed < 100 ? Math.round(parsed * 100) : Math.round(parsed);
}

async function ensureMerchantId(merchantIdInput: string | number | undefined): Promise<number> {
  if (!db) throw new Error('Database not available');
  
  // If it's already a number, return it
  if (typeof merchantIdInput === 'number') {
    return merchantIdInput;
  }
  
  // If it's a string, look up or create a merchant
  if (typeof merchantIdInput === 'string') {
    // Try to find existing merchant by name (case-insensitive)
    const [existingMerchant] = await db.select({ id: merchants.id, name: merchants.name })
      .from(merchants)
      .where(ilike(merchants.name, merchantIdInput))
      .limit(1);
    
    if (existingMerchant) {
      return existingMerchant.id;
    }
    
    // Merchant doesn't exist, create a new one
    const [newMerchant] = await db.insert(merchants)
      .values({
        name: merchantIdInput,
        category: 'demo'
      })
      .returning({ id: merchants.id });
    
    return newMerchant.id;
  }
  
  // If merchantId is missing/undefined, create or find default demo merchant
  const defaultMerchantName = 'Default Demo Merchant';
  const [defaultMerchant] = await db.select({ id: merchants.id, name: merchants.name })
    .from(merchants)
    .where(eq(merchants.name, defaultMerchantName))
    .limit(1);
  
  if (defaultMerchant) {
    return defaultMerchant.id;
  }
  
  // Create default merchant if it doesn't exist
  const [newDefaultMerchant] = await db.insert(merchants)
    .values({
      name: defaultMerchantName,
      category: 'demo'
    })
    .returning({ id: merchants.id });
  
  return newDefaultMerchant.id;
}

export async function encryptReceipt(receipt: any, policyId: string): Promise<{
  receiptId: number;
  capsuleB64: string;
  capsuleHash: string;
  encryptedData: string;
  nonce: string;
  authTag: string;
}> {
  // Generate random 32-byte AES-256 DEK
  const dek = randomBytes(32);
  
  // Generate random 12-byte nonce for GCM
  const nonce = randomBytes(12);
  
  // Encrypt receipt JSON with AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', dek, nonce);
  const receiptJson = JSON.stringify(receipt);
  let ciphertext = cipher.update(receiptJson, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');
  
  // Get TACo allowlist condition
  const condition = await tacoPreClient.getAllowlistCondition();
  
  // Create capsule using TACo
  const { capsuleB64, capsuleHashHex } = await tacoPreClient.makeCapsuleForPolicy(dek, condition);
  
  // Store as JSON with all encryption metadata
  const encryptedData = JSON.stringify({
    ciphertext,
    nonce: nonce.toString('base64'),
    authTag
  });
  
  // Store encrypted receipt in database
  if (!db) throw new Error('Database not available');
  
  // Ensure we have a valid numeric merchantId (look up or create merchant if needed)
  const validMerchantId = await ensureMerchantId(receipt.merchantId);
  
  // Create a complete receipt record with encrypted data
  // Note: Using capsuleHash as tokenId/cid for now (IPFS integration can come later)
  const [insertedReceipt] = await db.insert(receipts).values({
    merchantId: validMerchantId,
    date: receipt.timestamp ? new Date(receipt.timestamp) : new Date(),
    total: toCents(receipt.total || receipt.amount),
    subtotal: toCents(receipt.subtotal),
    tax: toCents(receipt.tax),
    items: receipt.items || [],
    category: receipt.category,
    tokenId: capsuleHashHex, // Using capsuleHash as tokenId/cid for now
    encryptedData,
    capsuleBase64: capsuleB64,
    capsuleHash: capsuleHashHex,
    prePolicy: policyId,
    isEncrypted: true,
    encryptionScheme: 'TACo-PRE-AES256-GCM'
  }).returning();
  
  return {
    receiptId: insertedReceipt.id,
    capsuleB64,
    capsuleHash: capsuleHashHex,
    encryptedData: ciphertext,
    nonce: nonce.toString('base64'),
    authTag
  };
}

export async function createPolicy(
  policyId: string,
  delegateePubKeyPem: string,
  ttlSeconds: number,
  maxReencryptions: number
): Promise<{ ok: true; policyId: string }> {
  // Validate inputs
  if (!policyId || typeof policyId !== 'string') {
    throw new Error('policyId must be a non-empty string');
  }
  if (!delegateePubKeyPem || typeof delegateePubKeyPem !== 'string') {
    throw new Error('delegateePubKeyPem must be a non-empty string');
  }
  if (typeof ttlSeconds !== 'number' || ttlSeconds <= 0) {
    throw new Error('ttlSeconds must be a positive number');
  }
  if (typeof maxReencryptions !== 'number' || maxReencryptions <= 0) {
    throw new Error('maxReencryptions must be a positive number');
  }
  
  // Insert policy record into database with upsert behavior
  // If policyId already exists, update it (makes this idempotent)
  if (!db) throw new Error('Database not available');
  
  await db.insert(receiptPolicies)
    .values({
      policyId,
      delegateePubKeyPem,
      ttlSeconds,
      maxReencryptions
    })
    .onConflictDoUpdate({
      target: receiptPolicies.policyId,
      set: {
        delegateePubKeyPem,
        ttlSeconds,
        maxReencryptions
      }
    });
  
  return { ok: true, policyId };
}

export async function reencryptForDelegate(
  receiptId: string,
  delegateePubKeyPem: string
): Promise<{
  ok: true;
  reencryptedDEK: string;
  nonce: string;
  authTag: string;
  ciphertext: string;
}> {
  if (!db) throw new Error('Database not available');
  
  // Fetch receipt from database
  const [receipt] = await db.select()
    .from(receipts)
    .where(eq(receipts.id, Number(receiptId)))
    .limit(1);
  
  if (!receipt) {
    throw new Error(`Receipt with id ${receiptId} not found`);
  }
  
  if (!receipt.capsuleBase64) {
    throw new Error(`Receipt ${receiptId} does not have a capsule (not encrypted with TACo)`);
  }
  
  // Check if receipt has a policy
  if (!receipt.prePolicy) {
    throw new Error(`Receipt ${receiptId} does not have an associated policy`);
  }
  
  // Fetch policy from database to validate TTL and limits
  const [policy] = await db.select()
    .from(receiptPolicies)
    .where(eq(receiptPolicies.policyId, receipt.prePolicy))
    .limit(1);
  
  if (!policy) {
    throw new Error(`Policy ${receipt.prePolicy} not found for receipt ${receiptId}`);
  }
  
  // Validate TTL hasn't expired
  const policyCreatedAt = policy.createdAt.getTime();
  const ttlMs = policy.ttlSeconds * 1000;
  const expirationTime = policyCreatedAt + ttlMs;
  const now = Date.now();
  
  if (now > expirationTime) {
    const expiredDate = new Date(expirationTime).toISOString();
    throw new Error(
      `Policy ${receipt.prePolicy} has expired. Expired at ${expiredDate}, current time is ${new Date(now).toISOString()}`
    );
  }
  
  // Note: Reencryption count tracking skipped for MVP
  // TODO: Track reencryption count and enforce maxReencryptions limit
  // This would require a new column in receipts table or a separate tracking table
  
  // Parse encrypted data
  if (!receipt.encryptedData) {
    throw new Error(`Receipt ${receiptId} does not have encrypted data`);
  }
  
  const encryptedPayload = JSON.parse(receipt.encryptedData);
  const { ciphertext, nonce, authTag } = encryptedPayload;
  
  // Call TACo re-encryption
  const { reencryptedDEK } = await tacoPreClient.reencryptCapsuleToDelegate(
    receipt.capsuleBase64,
    delegateePubKeyPem
  );
  
  return {
    ok: true,
    reencryptedDEK,
    nonce,
    authTag,
    ciphertext
  };
}
