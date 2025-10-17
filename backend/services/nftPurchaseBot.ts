/**
 * NFT Purchase Bot Service
 * 
 * Handles automated NFT purchases from marketplaces when users upload receipts,
 * as well as fallback minting from our own collection when marketplace purchases fail.
 * 
 * Updated to support NFT selection from internal pool and external marketplaces.
 */

import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { marketplaceService, MarketplaceNFT } from './marketplaceService';
import * as nftPoolRepository from '../repositories/nftPoolRepository';
import { NFTOption } from '../repositories/nftPoolRepository';
import { nftProcurementService } from './nftProcurementService';

// Wallet tracker to prevent abuse (in-memory, replace with DB in production)
interface ClaimRecord {
  lastClaimTime: number;
  claimsInLast24h: number;
}

// Store claimed NFTs (in-memory - would use DB in production)
const claimedNFTs: Map<string, ClaimRecord> = new Map();

// Demo NFT collection for fallback minting
const mockNFTCollection = [
  {
    id: 'nft-001',
    name: 'Receipt Warrior',
    description: 'A heroic receipt ready to battle expense reports',
    image: '/nft-images/receipt-warrior.svg',
    price: 0.001,
    available: true
  },
  {
    id: 'nft-002',
    name: 'Crypto Receipt',
    description: 'A receipt for your crypto transactions',
    image: '/nft-images/crypto-receipt.svg',
    price: 0.002,
    available: true
  },
  {
    id: 'nft-003',
    name: 'Fashion Receipt',
    description: 'A stylish receipt for fashion purchases',
    image: '/nft-images/fashion-receipt.svg',
    price: 0.003,
    available: true
  },
  {
    id: 'nft-004',
    name: 'Electronics Receipt',
    description: 'A high-tech receipt for gadget purchases',
    image: '/nft-images/electronics-receipt.svg',
    price: 0.002,
    available: true
  },
  {
    id: 'nft-005',
    name: 'Food Receipt',
    description: 'A delicious receipt for food purchases',
    image: '/nft-images/food-receipt.svg',
    price: 0.001,
    available: true
  }
];

// Smart contract details
const contractAddress = process.env.RECEIPT_NFT_CONTRACT_ADDRESS || '0x1111111111111111111111111111111111111111';

// Result types
export interface NFTPurchaseResult {
  success: boolean;
  tokenId?: string;
  contractAddress?: string;
  name?: string;
  imageUrl?: string;
  marketplace?: string;
  price?: number;
  txHash?: string;
  error?: string;
  creator?: string;
  creatorName?: string;
  tier?: string;
}

// Initialize and log basic configs
console.log('NFT Bot using random wallet for testing only. No actual purchases will work!');

/**
 * Generate a random token ID for test NFTs
 */
function generateTokenId(): string {
  return `${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

/**
 * Check if a user is eligible to claim an NFT (limit 1 per 24h period)
 */
export async function isUserEligible(walletAddress: string): Promise<boolean> {
  const record = claimedNFTs.get(walletAddress);
  
  // Initialize claim records when first seen
  if (!claimedNFTs.has(walletAddress)) {
    console.log(`New wallet ${walletAddress} detected - eligible for NFT gift`);
    return true;
  }
  
  if (!record) return true;
  
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  
  if (now - record.lastClaimTime > oneDay) {
    // Reset if last claim was more than 24h ago
    console.log(`Wallet ${walletAddress} last claim was > 24h ago - eligible for NFT gift`);
    return true;
  }
  
  if (record.claimsInLast24h < 1) {
    // Allow if under daily limit
    console.log(`Wallet ${walletAddress} has not claimed in last 24h - eligible for NFT gift`);
    return true;
  }
  
  console.log(`Wallet ${walletAddress} already claimed in last 24h - not eligible for NFT gift`);
  return false;
}

/**
 * Record successful NFT claim for a wallet
 */
function recordNFTClaim(walletAddress: string): void {
  const now = Date.now();
  const record = claimedNFTs.get(walletAddress);
  
  if (record) {
    claimedNFTs.set(walletAddress, {
      lastClaimTime: now,
      claimsInLast24h: record.claimsInLast24h + 1
    });
  } else {
    claimedNFTs.set(walletAddress, {
      lastClaimTime: now,
      claimsInLast24h: 1
    });
  }
  
  console.log(`Recorded NFT claim for wallet ${walletAddress}`);
}

// Initialize claim records
console.log('Initialized NFT claim records');

/**
 * Find a relevant NFT from the pool based on category and tier
 * @param category The category to match
 * @param tier The tier of NFT to find (standard, premium, luxury, ultra)
 * @returns Promise resolving to NFTOption object or null if none found
 */
async function findRelevantNFT(category: string = '', tier: string = 'standard'): Promise<NFTOption | null> {
  try {
    // Normalize category and tier
    const lowerCategory = category.toLowerCase();
    const normalizedTier = ['standard', 'premium', 'luxury', 'ultra'].includes(tier) ? tier : 'standard';
    
    // Get a set of NFTs from the specified tier
    const nftOptions = await nftPoolRepository.getNFTsByTier(normalizedTier);
    
    if (!nftOptions || nftOptions.length === 0) {
      console.warn(`No NFTs found in tier: ${normalizedTier}, using standard tier as fallback`);
      
      // Fall back to standard tier if the specified tier has no options
      if (normalizedTier !== 'standard') {
        return findRelevantNFT(category, 'standard');
      }
      
      return null;
    }
    
    // Try to find an NFT that matches the category
    if (lowerCategory) {
      // Find an NFT where the category attribute matches our category
      const matchingNFT = nftOptions.find(nft => 
        nft.category.toLowerCase().includes(lowerCategory)
      );
      
      if (matchingNFT) {
        console.log(`Found category matching NFT: ${matchingNFT.name} for category ${lowerCategory}`);
        return matchingNFT;
      }
    }
    
    // If no category match, just return a random one from the available options
    const randomIndex = Math.floor(Math.random() * nftOptions.length);
    console.log(`Using random NFT: ${nftOptions[randomIndex].name} from tier ${normalizedTier}`);
    return nftOptions[randomIndex];
  } catch (error) {
    console.error('Error finding relevant NFT:', error);
    return null;
  }
}

/**
 * NEW: Procure NFT from OpenSea and associate receipt metadata
 * This is the main function that implements your vision of buying NFTs from OpenSea
 */
export async function procureNFTWithMetadata(
  walletAddress: string,
  receiptData: any,
  recipientPublicKey: string
): Promise<NFTPurchaseResult> {
  try {
    console.log(`Starting NFT procurement for wallet ${walletAddress}`);
    
    // Use the new procurement service to buy NFT from OpenSea and encrypt metadata
    const result = await nftProcurementService.procureNFTForReceipt(
      {
        merchantName: receiptData.merchantName,
        date: receiptData.date,
        total: receiptData.total,
        subtotal: receiptData.subtotal,
        tax: receiptData.tax,
        items: receiptData.items || [],
        category: receiptData.category,
        confidence: receiptData.confidence
      },
      walletAddress,
      recipientPublicKey
    );
    
    if (!result.success) {
      throw new Error(result.error || 'NFT procurement failed');
    }
    
    const nft = result.nft!;
    
    return {
      success: true,
      tokenId: nft.tokenId,
      contractAddress: nft.contractAddress,
      name: nft.name,
      imageUrl: nft.imageUrl,
      price: nft.price,
      marketplace: nft.marketplace,
      txHash: nft.txHash,
      encryptedMetadata: {
        capsule: nft.receiptMetadata.capsule,
        ciphertext: nft.receiptMetadata.ciphertext,
        policyId: nft.receiptMetadata.policyId
      },
      fallbackUsed: result.fallbackUsed || false
    };
    
  } catch (error: any) {
    console.error('Error in NFT procurement:', error);
    return {
      success: false,
      error: error.message || 'Unknown error during NFT procurement'
    };
  }
}

/**
 * Purchase an NFT from the pool based on user selection, or fallback to random selection
 * @param walletAddress The wallet address to transfer the NFT to
 * @param receiptId The ID of the uploaded receipt
 * @param receiptData The parsed receipt data
 * @param selectedNftId Optional ID of the user-selected NFT from the pool
 */
export async function purchaseAndTransferNFT(
  walletAddress: string,
  receiptId: string,
  receiptData: any,
  selectedNftId?: string
): Promise<NFTPurchaseResult> {
  try {
    console.log(`Attempting to acquire NFT for wallet ${walletAddress} based on receipt ${receiptId}`);
    
    // Determine receipt category and tier based on total
    const receiptTotal = receiptData.total || 0;
    const category = marketplaceService.categorizeReceipt(receiptData);
    const { tier } = marketplaceService.determineNFTBudget(receiptTotal);
    
    console.log(`Receipt info - Category: ${category}, Tier: ${tier}, Total: $${receiptTotal}`);
    
    let selectedNFT = null;
    
    // If user selected a specific NFT from the pool, use that
    if (selectedNftId) {
      console.log(`User selected NFT with ID: ${selectedNftId}`);
      selectedNFT = await nftPoolRepository.getNFTById(selectedNftId);
      
      if (!selectedNFT) {
        console.warn(`Selected NFT ${selectedNftId} not found, falling back to auto-selection`);
      }
    }
    
    // If no NFT was selected or the selected one wasn't found, find a relevant one
    if (!selectedNFT) {
      console.log(`Finding relevant NFT based on category ${category} and tier ${tier}`);
      selectedNFT = await findRelevantNFT(category, tier);
      
      if (!selectedNFT) {
        throw new Error("No suitable NFT found in our collection");
      }
    }
    
    console.log(`Selected NFT: ${selectedNFT.name} (ID: ${selectedNFT.id})`);
    
    // Simulate blockchain transaction with a random hash
    const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    
    // Simulate minting delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Record the NFT claim
    recordNFTClaim(walletAddress);
    
    // Note: Our current repository doesn't support disabling NFTs
    // This would be implemented in a database-backed system
    
    // Return success response with NFT details
    return {
      success: true,
      tokenId: selectedNFT.tokenId.toString(), // Use the token ID from our NFT
      contractAddress,
      name: selectedNFT.name,
      imageUrl: selectedNFT.image,
      marketplace: 'BlockReceipt',
      price: 0,
      txHash,
      creator: 'BlockReceipt',
      creatorName: 'BlockReceipt Artist',
      tier: selectedNFT.tier
    };
  } catch (error: any) {
    console.error(`Error acquiring NFT for ${walletAddress}:`, error);
    
    return {
      success: false,
      error: error.message || 'Failed to acquire NFT'
    };
  }
}

/**
 * Mint a fallback NFT from our pool
 * Used when the primary selection flow fails
 */
export async function mintFallbackNFT(
  walletAddress: string,
  receiptCategory: string = '',
  customName: string = ''
): Promise<NFTPurchaseResult> {
  try {
    console.log(`Minting fallback NFT for wallet ${walletAddress} with category ${receiptCategory}`);
    
    // Always use standard tier for fallback NFTs
    const tier = 'standard';
    
    // Get a fallback NFT from the pool
    const fallbackNFT = await findRelevantNFT(receiptCategory, tier);
    
    if (!fallbackNFT) {
      throw new Error("No fallback NFTs available in the pool");
    }
    
    // Use the token ID from the NFT
    const tokenId = fallbackNFT.tokenId.toString();
    
    // Simulate blockchain delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Record the NFT claim
    recordNFTClaim(walletAddress);
    
    // Note: Our current repository doesn't support disabling NFTs
    // This would be implemented in a database-backed system
    
    // Generate tx hash for the minting operation
    const txHash = `0x${Math.random().toString(16).substring(2, 66)}`;
    
    // Return success response with NFT details
    return {
      success: true,
      tokenId,
      contractAddress,
      name: customName ? `${customName} (${fallbackNFT.name})` : fallbackNFT.name,
      imageUrl: fallbackNFT.image,
      marketplace: 'BlockReceipt',
      price: 0,
      txHash,
      creator: 'BlockReceipt',
      creatorName: 'BlockReceipt Artist',
      tier: fallbackNFT.tier
    };
  } catch (error: any) {
    console.error(`Error minting fallback NFT for ${walletAddress}:`, error);
    
    return {
      success: false,
      error: error.message || 'Failed to mint fallback NFT'
    };
  }
}

/**
 * Get NFT status for a user
 */
export function getNFTClaimStatus(walletAddress: string): ClaimRecord | null {
  return claimedNFTs.get(walletAddress) || null;
}

// Export the public API
export const nftPurchaseBot = {
  isUserEligible,
  purchaseAndTransferNFT,
  mintFallbackNFT,
  getNFTClaimStatus,
  findRelevantNFT
};