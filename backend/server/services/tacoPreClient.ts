// server/services/tacoPreClient.ts — MOCK TACo PRE Client (bypasses WebAssembly issues)
// ==================================================================================
// ⚠️  THIS IS A MOCK IMPLEMENTATION FOR TESTING PURPOSES ONLY  ⚠️
// ==================================================================================
// This implementation simulates TACo PRE functionality without using the actual
// TACo library, bypassing WebAssembly compatibility issues in the Node.js environment.
// It maintains the same API surface so the service layer doesn't need changes.

import { publicEncrypt, constants, createHash, randomBytes } from 'crypto';
import { ethers } from 'ethers';

// Simple config object with AMOY_RPC fallback
const CONFIG = {
  AMOY_RPC: 'https://rpc-amoy.polygon.technology'
};

// Inline sha256Hex implementation
function sha256Hex(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function rsaEncryptToPem(pubPem: string, data: Buffer): Buffer {
  return publicEncrypt(
    { key: pubPem, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    data
  );
}

let signer: ethers.Wallet | null = null;
let initialized = false;

/**
 * MOCK: Initialize TACo (bypasses actual TACo library)
 * Simply creates a signer from the private key without loading WASM
 */
export async function initTaco() {
  if (initialized) return;

  console.log('[TACo MOCK] Initializing mock TACo client (no WASM)');

  let pk = process.env.TACO_SIGNER_PRIVATE_KEY;
  if (!pk) throw new Error('TACO_SIGNER_PRIVATE_KEY missing');
  if (!pk.startsWith('0x')) pk = '0x' + pk;

  const provider = new ethers.providers.JsonRpcProvider(process.env.AMOY_RPC || CONFIG.AMOY_RPC);
  signer = new ethers.Wallet(pk, provider);

  initialized = true;
  console.log('[TACo MOCK] Mock TACo client initialized');
}

/**
 * MOCK: Get signer address
 * Returns the wallet address from the mock signer
 */
export async function getSignerAddress(): Promise<string> {
  await initTaco();
  return (await signer!.getAddress()).toLowerCase();
}

/**
 * MOCK: Get vault public key (returns placeholder)
 */
export function getVaultPublicKeyPem() { 
  return 'TACO_CONDITION'; 
}

/**
 * MOCK: Build allowlist condition
 * Returns a mock condition object instead of calling TACo
 */
export async function getAllowlistCondition(): Promise<any> {
  const addr = await getSignerAddress();
  console.log('[TACo MOCK] Creating mock allowlist condition for:', addr);
  
  return {
    type: 'mock-allowlist',
    addresses: [addr]
  };
}

/**
 * MOCK: Create capsule for policy
 * Generates a mock capsule without calling TACo encrypt
 * - Generates random 32-byte data to represent encrypted DEK
 * - Returns base64 capsule and SHA-256 hash
 */
export async function makeCapsuleForPolicy(
  dek: Buffer,
  condition: any
): Promise<{ capsuleB64: string; capsuleHashHex: string }> {
  await initTaco();
  
  console.log('[TACo MOCK] Creating mock capsule (DEK size:', dek.length, 'bytes)');
  
  // Generate random 32-byte key to represent the "encrypted" DEK
  const mockEncryptedData = randomBytes(32);
  
  // Create base64 capsule from the random data
  const capsuleB64 = mockEncryptedData.toString('base64');
  
  // Calculate SHA-256 hash
  const capsuleHashHex = sha256Hex(Buffer.from(capsuleB64, 'base64'));
  
  console.log('[TACo MOCK] Mock capsule created, hash:', capsuleHashHex.substring(0, 16) + '...');
  
  return { capsuleB64, capsuleHashHex };
}

/**
 * MOCK: Re-encrypt capsule to delegate
 * Simulates re-encryption without calling TACo decrypt
 * - Uses a mock 32-byte DEK
 * - RSA encrypts it to the delegate's public key
 */
export async function reencryptCapsuleToDelegate(
  capsuleBase64: string,
  transportRsaPubPem: string
): Promise<{ reencryptedDEK: string }> {
  await initTaco();
  
  console.log('[TACo MOCK] Mock re-encrypting capsule to delegate');
  
  // Create a mock 32-byte DEK (in real implementation, this would be decrypted from capsule)
  const mockDek = randomBytes(32);
  
  // RSA encrypt the mock DEK to the delegate's public key
  const rewrapped = rsaEncryptToPem(transportRsaPubPem, mockDek);
  
  console.log('[TACo MOCK] Mock re-encryption complete');
  
  return { reencryptedDEK: rewrapped.toString('base64') };
}
