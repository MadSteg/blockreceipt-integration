/**
 * Legacy Mumbai blockchain service - DISABLED
 * 
 * This service has been disabled in favor of the Amoy blockchain service.
 * The code here exists only to satisfy imports, but does not actually initialize
 * a connection to the Mumbai network.
 */
// Use any available receipt interface
interface FullReceipt {
  id: string | number;
  merchant: { name: string };
  date: Date;
  total: number;
  items: Array<{ name: string; price: number; quantity: number }>;
}

export interface IBlockchainService {
  createReceiptHash(receipt: FullReceipt): string;
  mintReceipt(receipt: FullReceipt): Promise<any>;
  verifyReceipt(tokenId: string, receipt: FullReceipt): Promise<any>;
  getNetworkStatus(): Promise<any>;
  isConnected(): boolean;
  logEncryptionEvent(receiptId: string, walletAddress: string, metadataUri: string): Promise<any>;
}

class BlockchainService implements IBlockchainService {
  private mockMode: boolean = true;
  private connected: boolean = false;
  private provider: any = null;
  private contract: any = null;
  
  constructor() {
    this.connected = this.mockMode;
    console.log(`BlockchainService initialized in ${this.mockMode ? 'mock' : 'production'} mode`);
  }

  createReceiptHash(receipt: FullReceipt): string {
    // Create a deterministic hash of the receipt data 
    const receiptData = {
      id: receipt.id,
      merchant: receipt.merchant.name,
      date: receipt.date.toISOString(),
      total: receipt.total,
      items: receipt.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    };
    
    // Return a dummy hash - this service is disabled
    return '0x0000000000000000000000000000000000000000000000000000000000000000';
  }

  async mintReceipt(receipt: FullReceipt): Promise<any> {
    return this.mockMintReceipt(receipt);
  }

  async verifyReceipt(tokenId: string, receipt: FullReceipt): Promise<any> {
    return this.mockVerifyReceipt(tokenId, receipt);
  }

  /**
   * Get all NFTs owned by a wallet address
   * @param walletAddress The wallet address to check
   * @returns Array of NFTs owned by this address
   */
  async getNFTsForWallet(walletAddress: string): Promise<any[]> {
    console.log(`Getting NFTs for wallet: ${walletAddress}`);
    
    if (this.mockMode) {
      // In mock mode, return some sample NFTs for testing
      return [
        {
          tokenId: 'receipt-warrior-1',
          imageUrl: '/nft-images/receipt-warrior.png',
          ownerAddress: walletAddress,
          isLocked: true,
          hasMetadata: true,
          preview: {
            merchantName: 'Tech Store',
            date: new Date().toISOString().split('T')[0],
            total: 149.99
          }
        },
        {
          tokenId: 'crypto-receipt-1',
          imageUrl: '/nft-images/crypto-receipt.png',
          ownerAddress: walletAddress,
          isLocked: true,
          hasMetadata: true,
          preview: {
            merchantName: 'Crypto Exchange',
            date: new Date().toISOString().split('T')[0],
            total: 199.50
          }
        }
      ];
    }
    
    // In real mode, this would connect to the blockchain
    return [];
  }

  /**
   * Check if a wallet address owns a specific NFT
   * @param walletAddress The wallet address to check
   * @param tokenId The token ID to verify ownership
   * @returns Boolean indicating ownership
   */
  async verifyNFTOwnership(walletAddress: string, tokenId: string): Promise<boolean> {
    console.log(`Verifying ownership of token ${tokenId} for wallet: ${walletAddress}`);
    
    if (this.mockMode) {
      // In mock mode, always return true for testing
      return true;
    }
    
    // In real mode, this would check on the blockchain
    return false;
  }

  async getNetworkStatus(): Promise<any> {
    return {
      available: false,
      network: 'mumbai-disabled',
      chainId: 80001,
      contractAddress: '0x0000000000000000000000000000000000000000',
      walletAddress: '0x0000000000000000000000000000000000000000',
      mockMode: true,
      message: 'Mumbai network has been disabled. Please use Amoy network.'
    };
  }
  
  /**
   * Check if blockchain service is connected
   * @returns Boolean indicating connection status
   */
  isConnected(): boolean {
    return this.mockMode; // In mock mode, we're always "connected"
  }
  
  /**
   * Log an encryption event to the blockchain
   * @param receiptId The receipt ID
   * @param walletAddress The wallet address that owns the receipt
   * @param metadataUri The IPFS URI for the receipt metadata
   * @returns Mock transaction details in development mode
   */
  async logEncryptionEvent(
    receiptId: string, 
    walletAddress: string, 
    metadataUri: string
  ): Promise<any> {
    console.log(`[BlockchainService] Logging encryption event for receipt ${receiptId} owned by ${walletAddress}`);
    
    if (this.mockMode) {
      // Simulate blockchain latency
      await new Promise(resolve => setTimeout(resolve, 300));
      
      return {
        success: true,
        eventType: 'EncryptedData',
        transactionHash: `0x${Math.random().toString(16).substring(2, 66)}`,
        receiptId,
        walletAddress,
        metadataUri,
        timestamp: new Date(),
        blockNumber: Math.floor(Math.random() * 1000000),
        mock: true
      };
    }
    
    throw new Error('Mumbai network has been disabled. Please use Amoy network.');
  }

  private mockMintReceipt(receipt: FullReceipt): any {
    return {
      success: false,
      message: 'Mumbai network has been disabled. Please use Amoy network.',
      mockMode: true
    };
  }

  private mockVerifyReceipt(tokenId: string, receipt: FullReceipt): any {
    return {
      verified: false,
      receipt: {
        id: receipt.id,
        blockchain: {
          tokenId,
          verified: false,
          mockMode: true,
          message: 'Mumbai network has been disabled. Please use Amoy network.'
        }
      }
    };
  }
}

export const blockchainService = new BlockchainService();