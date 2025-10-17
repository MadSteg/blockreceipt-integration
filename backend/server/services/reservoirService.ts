/**
 * Reservoir Protocol Service
 * 
 * This service handles NFT purchases using Reservoir Protocol - the industry standard
 * for NFT purchases used by OpenSea, Blur, and other major platforms.
 * 
 * Reservoir Protocol provides:
 * - No API key required for basic functionality
 * - Real NFT purchases on Polygon
 * - Better pricing and liquidity than OpenSea API
 * - Industry standard used by major platforms
 */

import axios from 'axios';
import { ethers } from 'ethers';

// Reservoir Protocol endpoints
const RESERVOIR_BASE_URL = 'https://api.reservoir.tools';
const RESERVOIR_POLYGON_URL = 'https://api-polygon.reservoir.tools';

// Interface for Reservoir NFT data
export interface ReservoirNFT {
  token: {
    tokenId: string;
    contract: string;
    name: string;
    description: string;
    image: string;
    collection: {
      name: string;
      image: string;
    };
    owner: string;
  };
  market: {
    floorAsk: {
      price: {
        amount: {
          native: string; // Price in ETH
          usd: number; // Price in USD
        };
        currency: {
          contract: string;
          symbol: string;
        };
      };
      source: {
        domain: string;
        name: string;
      };
    };
  };
  source: {
    domain: string;
    name: string;
  };
}

// Interface for purchase parameters
export interface ReservoirPurchaseParams {
  token: string; // contract:tokenId format
  taker: string; // recipient wallet address
  source: string; // marketplace source (opensea, blur, etc.)
}

// Interface for purchase response
export interface ReservoirPurchaseResponse {
  steps: Array<{
    id: string;
    action: string;
    description: string;
    kind: string;
    items: Array<{
      status: string;
      data: any;
    }>;
  }>;
}

/**
 * Search for NFTs on Polygon using Reservoir Protocol
 * No API key required for basic functionality
 */
export async function searchReservoirNFTs(options: {
  maxPrice: number; // Maximum price in USD
  category?: string;
  limit?: number;
}): Promise<ReservoirNFT[]> {
  try {
    console.log('Searching Reservoir for NFTs under $', options.maxPrice);
    
    // Convert USD to ETH (rough conversion)
    const maxPriceInEth = options.maxPrice / 2000;
    
    // Search for NFTs on Polygon
    const response = await axios.get(`${RESERVOIR_POLYGON_URL}/tokens/v6`, {
      params: {
        // Filter by price
        minPrice: '0.000001', // Minimum price in ETH
        maxPrice: maxPriceInEth.toString(),
        
        // Filter by collection (optional)
        collection: options.category ? getCollectionForCategory(options.category) : undefined,
        
        // Limit results
        limit: options.limit || 20,
        
        // Sort by price ascending
        sortBy: 'price',
        sortDirection: 'asc',
        
        // Include metadata
        includeMetadata: true,
        includeTopBid: false,
        includeRawData: false,
        
        // Filter for listed items only
        status: 'active'
      },
      headers: {
        'User-Agent': 'BlockReceipt/1.0',
        'Accept': 'application/json'
      }
    });
    
    console.log(`Found ${response.data.tokens?.length || 0} NFTs from Reservoir`);
    
    return response.data.tokens || [];
    
  } catch (error) {
    console.error('Error searching Reservoir NFTs:', error);
    return [];
  }
}

/**
 * Get collection address for category
 */
function getCollectionForCategory(category: string): string | undefined {
  // Map categories to popular Polygon collections
  const categoryCollections: Record<string, string> = {
    'art': '0x23581767a106ae21c074b2276d25e5c3e136a68b', // Moonbirds
    'fashion': '0x8d04a8c79ceb0889bdd12acdf3fa9d207ed3ff63', // Blitmap
    'tech': '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d', // Bored Ape Yacht Club
    'crypto': '0xed5af388653567af2f388e6224dc7c4b3241c544', // Azuki
    'default': undefined // No specific collection
  };
  
  return categoryCollections[category.toLowerCase()] || categoryCollections['default'];
}

/**
 * Get purchase quote from Reservoir
 */
export async function getReservoirQuote(params: ReservoirPurchaseParams): Promise<ReservoirPurchaseResponse | null> {
  try {
    console.log('Getting purchase quote from Reservoir for token:', params.token);
    
    const response = await axios.get(`${RESERVOIR_POLYGON_URL}/execute/buy/v7`, {
      params: {
        token: params.token,
        taker: params.taker,
        source: params.source || 'opensea',
        onlyQuote: true
      },
      headers: {
        'User-Agent': 'BlockReceipt/1.0',
        'Accept': 'application/json'
      }
    });
    
    return response.data;
    
  } catch (error) {
    console.error('Error getting Reservoir quote:', error);
    return null;
  }
}

/**
 * Execute NFT purchase using Reservoir Protocol
 */
export async function executeReservoirPurchase(
  params: ReservoirPurchaseParams,
  privateKey: string,
  rpcUrl: string
): Promise<{
  success: boolean;
  txHash?: string;
  error?: string;
}> {
  try {
    console.log('Executing Reservoir purchase for token:', params.token);
    
    // Set up provider and wallet
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    
    // Get purchase quote
    const quote = await getReservoirQuote(params);
    if (!quote) {
      throw new Error('Failed to get purchase quote');
    }
    
    // Execute the purchase steps
    for (const step of quote.steps) {
      if (step.action === 'transaction') {
        // Execute the transaction
        const tx = await wallet.sendTransaction({
          to: step.items[0].data.to,
          value: step.items[0].data.value,
          data: step.items[0].data.data,
          gasLimit: step.items[0].data.gas,
          gasPrice: step.items[0].data.gasPrice
        });
        
        console.log('Transaction sent:', tx.hash);
        
        // Wait for confirmation
        const receipt = await tx.wait();
        console.log('Transaction confirmed:', receipt.transactionHash);
        
        return {
          success: true,
          txHash: receipt.transactionHash
        };
      }
    }
    
    throw new Error('No transaction step found in quote');
    
  } catch (error: any) {
    console.error('Error executing Reservoir purchase:', error);
    return {
      success: false,
      error: error.message || 'Failed to execute purchase'
    };
  }
}

/**
 * Find and purchase an NFT using Reservoir Protocol
 */
export async function findAndPurchaseNFT(
  maxPrice: number,
  recipientAddress: string,
  privateKey: string,
  rpcUrl: string,
  category?: string
): Promise<{
  success: boolean;
  nft?: {
    tokenId: string;
    contractAddress: string;
    name: string;
    imageUrl: string;
    price: number;
    txHash: string;
  };
  error?: string;
}> {
  try {
    console.log(`Finding NFT under $${maxPrice} for ${recipientAddress}`);
    
    // Search for NFTs
    const nfts = await searchReservoirNFTs({
      maxPrice,
      category,
      limit: 10
    });
    
    if (nfts.length === 0) {
      throw new Error('No NFTs found under the specified price');
    }
    
    // Try to purchase the first (cheapest) NFT
    const nft = nfts[0];
    const token = `${nft.token.contract}:${nft.token.tokenId}`;
    
    console.log(`Attempting to purchase ${nft.token.name} for ${nft.market.floorAsk.price.amount.native} ETH`);
    
    // Execute purchase
    const result = await executeReservoirPurchase(
      {
        token,
        taker: recipientAddress,
        source: 'opensea'
      },
      privateKey,
      rpcUrl
    );
    
    if (!result.success) {
      throw new Error(result.error || 'Purchase failed');
    }
    
    return {
      success: true,
      nft: {
        tokenId: nft.token.tokenId,
        contractAddress: nft.token.contract,
        name: nft.token.name,
        imageUrl: nft.token.image,
        price: parseFloat(nft.market.floorAsk.price.amount.native),
        txHash: result.txHash!
      }
    };
    
  } catch (error: any) {
    console.error('Error finding and purchasing NFT:', error);
    return {
      success: false,
      error: error.message || 'Failed to find and purchase NFT'
    };
  }
}

// Export the service
export const reservoirService = {
  searchReservoirNFTs,
  getReservoirQuote,
  executeReservoirPurchase,
  findAndPurchaseNFT
};
