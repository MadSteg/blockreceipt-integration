import { Receipt, LoyaltyProfile } from '../types';
import { CloudflareService } from '../lib/cloudflare';

const API_BASE_URL = 'https://blockreceipt-api.steven-donoghue-icloud.workers.dev';

export class BlockReceiptAPI {
  static async getWalletStatus(phoneNumber: string) {
    const response = await fetch(`${API_BASE_URL}/api/enterprise/customer/status/${phoneNumber}`);
    return response.json();
  }

  static async getLoyaltyProfile(userId: number) {
    try {
      // Get user analytics from Cloudflare API
      const analyticsResult = await CloudflareService.getUserAnalytics(userId.toString());
      
      if (!analyticsResult.success) {
        // Create default profile if analytics not available
        const profile: LoyaltyProfile = {
          userId,
          totalPoints: 0,
          availablePoints: 0,
          tier: 'basic',
          totalReceipts: 0,
          totalSpent: 0,
          averageOrderValue: 0,
          recentRewards: [],
          favoriteMerchants: []
        };

        return {
          success: true,
          data: profile
        };
      }

      const analytics = analyticsResult.analytics;
      
      // Calculate tier based on total spent
      let tier = 'basic';
      if (analytics.total_spent >= 1000) tier = 'luxury';
      else if (analytics.total_spent >= 500) tier = 'premium';
      else if (analytics.total_spent >= 200) tier = 'standard';

      const profile: LoyaltyProfile = {
        userId,
        totalPoints: Math.floor(analytics.total_spent * 10), // 10 points per dollar
        availablePoints: Math.floor(analytics.total_spent * 10),
        tier,
        totalReceipts: analytics.total_nfts || 0,
        totalSpent: analytics.total_spent || 0,
        averageOrderValue: analytics.average_price || 0,
        recentRewards: [], // Would need to implement receipt fetching
        favoriteMerchants: [] // Would need to implement merchant analytics
      };

      return {
        success: true,
        data: profile
      };
    } catch (error) {
      console.error('Error fetching loyalty profile:', error);
      return {
        success: false,
        error: 'Failed to fetch loyalty profile'
      };
    }
  }

  static async getReceipts(walletAddress: string) {
    try {
      // Get user by wallet address (would need to implement this in the API)
      const user = await CloudflareService.getUser(walletAddress);
      
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      // Get user's NFTs (which represent their receipts)
      const nfts = await CloudflareService.getUserNFTs(user.id);
      
      // Convert NFTs to receipt format
      const receipts = nfts.map(nft => ({
        id: nft.id,
        tokenId: nft.opensea_token_id,
        merchantName: 'Unknown Merchant', // Would need to store this in NFT metadata
        totalAmount: nft.purchase_price * 2000, // Convert ETH to USD
        timestamp: new Date(nft.created_at).getTime(),
        imageUrl: 'https://via.placeholder.com/300x200',
        metadataUrl: nft.metadata_url,
        transactionHash: nft.purchase_tx_hash,
        items: [],
        loyaltyPoints: Math.floor(nft.purchase_price * 2000 * 10), // 10 points per dollar
        rewards: []
      }));

      return {
        success: true,
        receipts
      };
    } catch (error) {
      console.error('Error fetching receipts:', error);
      return {
        success: false,
        error: 'Failed to fetch receipts'
      };
    }
  }

  static async createReceipt(receiptData: Partial<Receipt>) {
    try {
      const receipt = await CloudflareService.createReceipt(receiptData);
      return {
        success: !!receipt,
        data: receipt
      };
    } catch (error) {
      console.error('Error creating receipt:', error);
      return {
        success: false,
        error: 'Failed to create receipt'
      };
    }
  }

  static async createNFT(nftData: Partial<any>) {
    try {
      // This would need to be implemented in the API
      return {
        success: false,
        error: 'NFT creation not implemented yet'
      };
    } catch (error) {
      console.error('Error creating NFT:', error);
      return {
        success: false,
        error: 'Failed to create NFT'
      };
    }
  }

  static async updateLoyaltyPoints(userId: string, points: number, spent: number) {
    try {
      // This would need to be implemented in the API
      return {
        success: false,
        error: 'Loyalty points update not implemented yet'
      };
    } catch (error) {
      console.error('Error updating loyalty points:', error);
      return {
        success: false,
        error: 'Failed to update loyalty points'
      };
    }
  }

  // NFT Procurement Methods
  static async previewNFTs(receiptData: {
    merchantName: string;
    total: number;
    category?: string;
  }) {
    try {
      const result = await CloudflareService.previewNFTs(receiptData);
      return result;
    } catch (error) {
      console.error('Error previewing NFTs:', error);
      return {
        success: false,
        error: 'Failed to preview NFTs'
      };
    }
  }

  static async procureNFT(receiptData: any, selectedNFT: any, userWallet: string) {
    try {
      const result = await CloudflareService.procureNFT(receiptData, selectedNFT, userWallet);
      return result;
    } catch (error) {
      console.error('Error procuring NFT:', error);
      return {
        success: false,
        error: 'Failed to procure NFT'
      };
    }
  }

  // Storage Methods
  static async uploadReceiptImage(file: File, userId: string) {
    try {
      const result = await CloudflareService.uploadFile(file, userId, 'receipt');
      return {
        success: result.success,
        data: result.fileUrl,
        error: result.error
      };
    } catch (error: any) {
      console.error('Error uploading receipt image:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async uploadNFTMetadata(metadata: any, userId: string, receiptId: string) {
    try {
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      const result = await CloudflareService.uploadFile(metadataBlob as any, userId, 'metadata');
      return {
        success: result.success,
        data: result.fileUrl,
        error: result.error
      };
    } catch (error: any) {
      console.error('Error uploading NFT metadata:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async uploadUserAvatar(file: File, userId: string) {
    try {
      const result = await CloudflareService.uploadFile(file, userId, 'avatar');
      return {
        success: result.success,
        data: result.fileUrl,
        error: result.error
      };
    } catch (error: any) {
      console.error('Error uploading user avatar:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static async deleteFile(bucket: string, path: string) {
    try {
      // This would need to be implemented in the API
      return {
        success: false,
        error: 'File deletion not implemented yet'
      };
    } catch (error: any) {
      console.error('Error deleting file:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  static getFileURL(bucket: string, path: string) {
    return `https://pub-${bucket}.r2.dev/${path}`;
  }

  static async listUserFiles(userId: string, bucket: string) {
    try {
      // This would need to be implemented in the API
      return {
        success: false,
        error: 'File listing not implemented yet'
      };
    } catch (error: any) {
      console.error('Error listing user files:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Health check
  static async healthCheck() {
    try {
      const result = await CloudflareService.healthCheck();
      return {
        success: result.status === 'healthy',
        data: result
      };
    } catch (error) {
      console.error('Health check failed:', error);
      return {
        success: false,
        error: 'Health check failed'
      };
    }
  }
}
