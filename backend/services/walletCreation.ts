import { ethers } from 'ethers';
import { createLogger } from '../logger';

const logger = createLogger('wallet-creation');

export interface CustomerWallet {
  address: string;
  privateKey: string;
  customerId: string;
  createdAt: string;
}

export interface NFTMintResult {
  success: boolean;
  tokenId?: string;
  walletAddress: string;
  transactionHash?: string;
  nftImageUrl: string;
  rewardPoints: number;
}

class WalletCreationService {
  private customerWallets = new Map<string, CustomerWallet>();

  /**
   * Create or retrieve wallet for customer at POS
   */
  createCustomerWallet(customerId: string): CustomerWallet {
    // Check if wallet already exists
    const existingWallet = this.customerWallets.get(customerId);
    if (existingWallet) {
      logger.info(`[wallet] Retrieved existing wallet for customer ${customerId}: ${existingWallet.address}`);
      return existingWallet;
    }

    // Create new wallet
    const wallet = ethers.Wallet.createRandom();
    const customerWallet: CustomerWallet = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      customerId,
      createdAt: new Date().toISOString()
    };

    this.customerWallets.set(customerId, customerWallet);
    logger.info(`[wallet] Created new wallet for customer ${customerId}: ${wallet.address}`);
    
    return customerWallet;
  }

  /**
   * Mint receipt NFT with random image from Google bucket
   */
  async mintReceiptNFT(
    customerId: string,
    receiptData: any,
    rewardPoints: number
  ): Promise<NFTMintResult> {
    try {
      // Get or create wallet
      const wallet = this.createCustomerWallet(customerId);

      // Select random NFT image from predefined collection
      const nftImages = [
        'Chocolate Donut.png',
        'Hot Coffee.png',
        'Frapaccino.png',
        'Breakfast Sandwich.png',
        'Plain Donut.png'
      ];
      
      const randomImage = nftImages[Math.floor(Math.random() * nftImages.length)];
      const nftImageUrl = `/api/image-proxy/${encodeURIComponent(randomImage)}`;

      // Simulate minting (in production, would interact with smart contract)
      const tokenId = `nft_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
      const transactionHash = `0x${Math.random().toString(16).substr(2, 64)}`;

      logger.info(`[wallet] Minted NFT ${tokenId} for wallet ${wallet.address} with image ${randomImage}`);
      logger.info(`[wallet] Receipt includes ${rewardPoints} reward points`);

      return {
        success: true,
        tokenId,
        walletAddress: wallet.address,
        transactionHash,
        nftImageUrl,
        rewardPoints
      };

    } catch (error) {
      logger.error(`[wallet] Failed to mint NFT for customer ${customerId}:`, error);
      
      // Return minimal wallet info even if minting fails
      const wallet = this.createCustomerWallet(customerId);
      return {
        success: false,
        walletAddress: wallet.address,
        nftImageUrl: '/api/image-proxy/Hot%20Coffee.png', // Default fallback
        rewardPoints: 0
      };
    }
  }

  /**
   * Get customer wallet if exists
   */
  getCustomerWallet(customerId: string): CustomerWallet | undefined {
    return this.customerWallets.get(customerId);
  }

  /**
   * Get all customer wallets (for admin)
   */
  getAllWallets(): CustomerWallet[] {
    return Array.from(this.customerWallets.values());
  }

  /**
   * Generate customer ID from phone/email (simplified)
   */
  generateCustomerId(phoneOrEmail: string): string {
    // In production, would hash/encrypt this
    return `customer_${Buffer.from(phoneOrEmail).toString('base64').substr(0, 12)}`;
  }
}

export const walletCreationService = new WalletCreationService();