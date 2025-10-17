/**
 * NFT Pool Repository
 * 
 * This repository manages the NFT pool data, which defines the available
 * NFTs that can be minted for receipts.
 */

import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Define the structure of an NFT in the pool
export interface NFTOption {
  id: string;
  name: string;
  description: string;
  tier: string;
  image: string;
  metadataUri: string;
  category: string;
  rarity: string;
  tokenId: number;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

// Path to the NFT pool JSON file
const NFT_POOL_PATH = path.join(process.cwd(), 'data', 'nft_pool.json');

// In-memory cache of NFT pool data
let nftPoolCache: NFTOption[] | null = null;

/**
 * Load all available NFTs from the pool
 */
export async function getAllNFTs(): Promise<NFTOption[]> {
  if (nftPoolCache) {
    return nftPoolCache;
  }

  try {
    // Read NFT pool data from JSON file
    const data = fs.readFileSync(NFT_POOL_PATH, 'utf8');
    nftPoolCache = JSON.parse(data);
    
    if (!Array.isArray(nftPoolCache)) {
      logger.error('NFT pool data is not an array');
      nftPoolCache = [];
      return [];
    }
    
    logger.info(`Loaded ${nftPoolCache.length} NFTs from pool`);
    return nftPoolCache;
  } catch (error) {
    logger.error('Error loading NFT pool data:', error);
    return [];
  }
}

/**
 * Find an NFT by its ID
 */
export async function getNFTById(id: string): Promise<NFTOption | null> {
  const nfts = await getAllNFTs();
  return nfts.find(nft => nft.id === id) || null;
}

/**
 * Find an NFT by its token ID
 */
export async function getNFTByTokenId(tokenId: number): Promise<NFTOption | null> {
  const nfts = await getAllNFTs();
  return nfts.find(nft => nft.tokenId === tokenId) || null;
}

/**
 * Find NFTs matching a specific tier
 */
export async function getNFTsByTier(tier: string): Promise<NFTOption[]> {
  const nfts = await getAllNFTs();
  return nfts.filter(nft => nft.tier.toLowerCase() === tier.toLowerCase());
}

/**
 * Find NFTs matching a specific category
 */
export async function getNFTsByCategory(category: string): Promise<NFTOption[]> {
  const nfts = await getAllNFTs();
  return nfts.filter(nft => nft.category.toLowerCase() === category.toLowerCase());
}

/**
 * Select an appropriate NFT based on receipt data
 */
export async function selectNFTForReceipt(
  tier: string = 'standard',
  category: string = 'default',
  excludeIds: string[] = []
): Promise<NFTOption | null> {
  try {
    // First try to find NFTs matching both tier and category
    let nfts = await getNFTsByTier(tier);
    let categoryMatches = nfts.filter(nft => 
      nft.category.toLowerCase() === category.toLowerCase() &&
      !excludeIds.includes(nft.id)
    );
    
    // If we found matches, return a random one
    if (categoryMatches.length > 0) {
      return categoryMatches[Math.floor(Math.random() * categoryMatches.length)];
    }
    
    // Otherwise just use any NFT from the specified tier
    const tierMatches = nfts.filter(nft => !excludeIds.includes(nft.id));
    if (tierMatches.length > 0) {
      return tierMatches[Math.floor(Math.random() * tierMatches.length)];
    }
    
    // Fallback to any NFT if nothing else matches
    const allNfts = await getAllNFTs();
    const availableNfts = allNfts.filter(nft => !excludeIds.includes(nft.id));
    
    if (availableNfts.length > 0) {
      return availableNfts[Math.floor(Math.random() * availableNfts.length)];
    }
    
    return null;
  } catch (error) {
    logger.error('Error selecting NFT for receipt:', error);
    return null;
  }
}

/**
 * Clear the NFT pool cache to force reload from disk
 */
export function clearCache(): void {
  nftPoolCache = null;
}