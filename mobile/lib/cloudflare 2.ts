/**
 * Cloudflare API Integration for BlockReceipt Mobile App
 * 
 * Replaces Supabase with Cloudflare Workers API
 * - Database operations via D1
 * - File storage via R2
 * - NFT procurement via OpenSea
 */

const CLOUDFLARE_API_URL = 'https://blockreceipt-api.steven-donoghue-icloud.workers.dev';

// Types
export interface User {
  id: string;
  email: string;
  wallet_address: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  merchant_name: string;
  total_amount: number;
  image_url?: string;
  nft_created: boolean;
  created_at: string;
  updated_at: string;
  nft_token_id?: number;
  nft_contract_address?: string;
  metadata_uri?: string;
  items?: any[];
}

export interface NFT {
  id: string;
  user_id: string;
  receipt_id: string;
  opensea_token_id: string;
  contract_address: string;
  purchase_price: number;
  purchase_tx_hash?: string;
  metadata_url?: string;
  encrypted_metadata?: any;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyPoints {
  id: string;
  user_id: string;
  points: number;
  tier: string;
  total_spent: number;
  total_receipts: number;
  average_order_value: number;
  created_at: string;
  updated_at: string;
}

export interface NFTPreview {
  tokenId: string;
  contractAddress: string;
  name: string;
  description: string;
  imageUrl: string;
  price: number;
  priceUSD: number;
  marketplace: string;
  collection: string;
  openseaUrl: string;
}

export interface NFTProcurementResult {
  success: boolean;
  nft?: {
    id: string;
    tokenId: string;
    contractAddress: string;
    price: number;
    txHash: string;
    metadataUrl?: string;
  };
  purchase?: {
    success: boolean;
    nftId: string;
    contractAddress: string;
    price: number;
    priceUSD: number;
    txHash: string;
    recipient: string;
    timestamp: string;
    marketplace: string;
  };
  metadata?: {
    encrypted: boolean;
    capsule?: string;
    url?: string;
  };
  error?: string;
}

// Cloudflare API Service
export class CloudflareService {
  private static async makeRequest(endpoint: string, options: RequestInit = {}) {
    try {
      const response = await fetch(`${CLOUDFLARE_API_URL}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Cloudflare API request failed:', error);
      throw error;
    }
  }

  // User operations
  static async getUser(userId: string): Promise<User | null> {
    try {
      const result = await this.makeRequest(`/api/users/${userId}`);
      return result.success ? result.user : null;
    } catch (error) {
      console.error('Error fetching user:', error);
      return null;
    }
  }

  static async createUser(userData: Partial<User>): Promise<User | null> {
    try {
      const result = await this.makeRequest('/api/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      return result.success ? result.user : null;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  // Receipt operations
  static async getReceipt(receiptId: string): Promise<Receipt | null> {
    try {
      const result = await this.makeRequest(`/api/receipts/${receiptId}`);
      return result.success ? result.receipt : null;
    } catch (error) {
      console.error('Error fetching receipt:', error);
      return null;
    }
  }

  static async createReceipt(receiptData: Partial<Receipt>): Promise<Receipt | null> {
    try {
      const result = await this.makeRequest('/api/receipts', {
        method: 'POST',
        body: JSON.stringify(receiptData),
      });
      return result.success ? result.receipt : null;
    } catch (error) {
      console.error('Error creating receipt:', error);
      return null;
    }
  }

  static async processReceipt(receiptId: string): Promise<boolean> {
    try {
      const result = await this.makeRequest(`/api/receipts/${receiptId}/process`, {
        method: 'POST',
      });
      return result.success;
    } catch (error) {
      console.error('Error processing receipt:', error);
      return false;
    }
  }

  // NFT operations
  static async previewNFTs(receiptData: {
    merchantName: string;
    total: number;
    category?: string;
  }): Promise<{ success: boolean; availableNFTs?: NFTPreview[]; budget?: number; error?: string }> {
    try {
      const result = await this.makeRequest('/api/nft-procurement/preview', {
        method: 'POST',
        body: JSON.stringify({ receiptData }),
      });
      return result;
    } catch (error) {
      console.error('Error previewing NFTs:', error);
      return { success: false, error: error.message };
    }
  }

  static async procureNFT(
    receiptData: any,
    selectedNFT: NFTPreview,
    userWallet: string
  ): Promise<NFTProcurementResult> {
    try {
      const result = await this.makeRequest('/api/nft-procurement/procure', {
        method: 'POST',
        body: JSON.stringify({
          receiptData,
          selectedNFT,
          userWallet,
        }),
      });
      return result;
    } catch (error) {
      console.error('Error procuring NFT:', error);
      return { success: false, error: error.message };
    }
  }

  static async getUserNFTs(userId: string): Promise<NFT[]> {
    try {
      const result = await this.makeRequest(`/api/nfts/user/${userId}`);
      return result.success ? result.nfts : [];
    } catch (error) {
      console.error('Error fetching user NFTs:', error);
      return [];
    }
  }

  static async getNFT(nftId: string): Promise<NFT | null> {
    try {
      const result = await this.makeRequest(`/api/nfts/${nftId}`);
      return result.success ? result.nft : null;
    } catch (error) {
      console.error('Error fetching NFT:', error);
      return null;
    }
  }

  // File storage operations
  static async uploadFile(file: File, userId: string, type: string = 'receipt'): Promise<{ success: boolean; fileUrl?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', userId);
      formData.append('type', type);

      const response = await fetch(`${CLOUDFLARE_API_URL}/api/storage/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error uploading file:', error);
      return { success: false, error: error.message };
    }
  }

  static async getFile(fileId: string): Promise<{ success: boolean; data?: ArrayBuffer; error?: string }> {
    try {
      const response = await fetch(`${CLOUDFLARE_API_URL}/api/storage/${fileId}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.arrayBuffer();
      return { success: true, data };
    } catch (error) {
      console.error('Error fetching file:', error);
      return { success: false, error: error.message };
    }
  }

  // Analytics operations
  static async getUserAnalytics(userId: string): Promise<{ success: boolean; analytics?: any; error?: string }> {
    try {
      const result = await this.makeRequest(`/api/analytics/user/${userId}`);
      return result;
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      return { success: false, error: error.message };
    }
  }

  // OpenSea operations
  static async searchOpenSea(query: string, maxPrice: number, category: string, limit: number = 20): Promise<{ success: boolean; nfts?: NFTPreview[]; error?: string }> {
    try {
      const result = await this.makeRequest('/api/opensea/search', {
        method: 'POST',
        body: JSON.stringify({ query, maxPrice, category, limit }),
      });
      return result;
    } catch (error) {
      console.error('Error searching OpenSea:', error);
      return { success: false, error: error.message };
    }
  }

  static async getOpenSeaCollections(): Promise<{ success: boolean; collections?: any[]; error?: string }> {
    try {
      const result = await this.makeRequest('/api/opensea/collections');
      return result;
    } catch (error) {
      console.error('Error fetching OpenSea collections:', error);
      return { success: false, error: error.message };
    }
  }

  // Health check
  static async healthCheck(): Promise<{ status: string; features: any; message: string }> {
    try {
      const result = await this.makeRequest('/health');
      return result;
    } catch (error) {
      console.error('Health check failed:', error);
      return { status: 'unhealthy', features: {}, message: 'API unavailable' };
    }
  }
}

// Legacy compatibility - maps CloudflareService to SupabaseService interface
export class SupabaseService {
  static async getUser(userId: string): Promise<User | null> {
    return CloudflareService.getUser(userId);
  }

  static async createUser(email: string, walletAddress: string): Promise<User> {
    const user = await CloudflareService.createUser({ email, wallet_address: walletAddress });
    if (!user) throw new Error('Failed to create user');
    return user;
  }

  static async getUserReceipts(userId: string): Promise<Receipt[]> {
    // This would need to be implemented in the API
    return [];
  }

  static async createReceipt(receiptData: Partial<Receipt>): Promise<Receipt> {
    const receipt = await CloudflareService.createReceipt(receiptData);
    if (!receipt) throw new Error('Failed to create receipt');
    return receipt;
  }

  static async createNFT(nftData: Partial<NFT>): Promise<NFT> {
    // This would need to be implemented in the API
    throw new Error('Not implemented yet');
  }

  static async getUserLoyaltyPoints(userId: string): Promise<LoyaltyPoints | null> {
    // This would need to be implemented in the API
    return null;
  }

  static async createLoyaltyPoints(userId: string, initialPoints: number, initialTier: string): Promise<LoyaltyPoints> {
    // This would need to be implemented in the API
    throw new Error('Not implemented yet');
  }

  static async updateLoyaltyPoints(userId: string, updates: Partial<LoyaltyPoints>): Promise<LoyaltyPoints> {
    // This would need to be implemented in the API
    throw new Error('Not implemented yet');
  }
}

// Export the Cloudflare client for compatibility
export const supabase = {
  from: (table: string) => ({
    select: (columns: string) => ({
      eq: (column: string, value: any) => ({
        single: async () => ({ data: null, error: null }),
        order: (column: string, options: any) => ({
          limit: (count: number) => Promise.resolve({ data: [], error: null })
        })
      })
    }),
    insert: (data: any) => ({
      select: () => ({
        single: async () => ({ data: null, error: null })
      })
    }),
    update: (data: any) => ({
      eq: (column: string, value: any) => ({
        select: () => ({
          single: async () => ({ data: null, error: null })
        })
      })
    })
  }
};
