/**
 * OpenSea API Service
 * 
 * Handles OpenSea API integration for NFT metadata, collection info, and marketplace data
 */

import axios from 'axios';

export interface OpenSeaAsset {
  id: number;
  token_id: string;
  name: string;
  description: string;
  image_url: string;
  animation_url?: string;
  external_link?: string;
  asset_contract: {
    address: string;
    name: string;
    symbol: string;
  };
  collection: {
    name: string;
    slug: string;
    image_url: string;
  };
  owner: {
    address: string;
  };
  last_sale?: {
    total_price: string;
    payment_token: {
      symbol: string;
      decimals: number;
    };
  };
  traits: Array<{
    trait_type: string;
    value: string | number;
  }>;
}

export interface OpenSeaCollection {
  name: string;
  slug: string;
  description: string;
  image_url: string;
  banner_image_url?: string;
  external_url?: string;
  stats: {
    total_supply: number;
    num_owners: number;
    floor_price: number;
    total_volume: number;
  };
}

export class OpenSeaService {
  private apiKey: string;
  private baseUrl: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.opensea.io/api/v1';
  }

  private getHeaders() {
    return {
      'X-API-KEY': this.apiKey,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Get NFT asset details by contract address and token ID
   */
  async getAsset(contractAddress: string, tokenId: string): Promise<OpenSeaAsset | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/asset/${contractAddress}/${tokenId}`,
        { headers: this.getHeaders() }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching OpenSea asset:', error);
      return null;
    }
  }

  /**
   * Get collection information
   */
  async getCollection(collectionSlug: string): Promise<OpenSeaCollection | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/collection/${collectionSlug}`,
        { headers: this.getHeaders() }
      );
      
      return response.data.collection;
    } catch (error) {
      console.error('Error fetching OpenSea collection:', error);
      return null;
    }
  }

  /**
   * Search for NFTs by query
   */
  async searchAssets(query: string, limit: number = 20): Promise<OpenSeaAsset[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/assets`,
        {
          headers: this.getHeaders(),
          params: {
            search: query,
            limit,
            order_direction: 'desc'
          }
        }
      );
      
      return response.data.assets || [];
    } catch (error) {
      console.error('Error searching OpenSea assets:', error);
      return [];
    }
  }

  /**
   * Get assets by owner address
   */
  async getAssetsByOwner(ownerAddress: string, limit: number = 20): Promise<OpenSeaAsset[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/assets`,
        {
          headers: this.getHeaders(),
          params: {
            owner: ownerAddress,
            limit,
            order_direction: 'desc'
          }
        }
      );
      
      return response.data.assets || [];
    } catch (error) {
      console.error('Error fetching assets by owner:', error);
      return [];
    }
  }

  /**
   * Get collection stats
   */
  async getCollectionStats(collectionSlug: string): Promise<any> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/collection/${collectionSlug}/stats`,
        { headers: this.getHeaders() }
      );
      
      return response.data.stats;
    } catch (error) {
      console.error('Error fetching collection stats:', error);
      return null;
    }
  }

  /**
   * Get events (sales, transfers, etc.) for an asset
   */
  async getAssetEvents(contractAddress: string, tokenId: string, limit: number = 20): Promise<any[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/events`,
        {
          headers: this.getHeaders(),
          params: {
            asset_contract_address: contractAddress,
            token_id: tokenId,
            limit
          }
        }
      );
      
      return response.data.asset_events || [];
    } catch (error) {
      console.error('Error fetching asset events:', error);
      return [];
    }
  }
}

// Export a singleton instance
let openSeaService: OpenSeaService | null = null;

export function getOpenSeaService(): OpenSeaService | null {
  if (!openSeaService && process.env.OPENSEA_API_KEY) {
    openSeaService = new OpenSeaService(process.env.OPENSEA_API_KEY);
  }
  return openSeaService;
}
