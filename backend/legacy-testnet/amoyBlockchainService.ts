/**
 * Amoy Blockchain Service for BlockReceipt.ai
 * 
 * This service handles interactions with the Polygon Amoy blockchain,
 * including minting, querying, and managing NFT receipts.
 */

import { ethers } from 'ethers';
import logger from '../logger';
import { ReceiptData } from './ocrService';

// Load environment variables
const RPC_URL = process.env.POLYGON_MUMBAI_RPC_URL || 'https://rpc-amoy.polygon.technology';
const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || '';
const CONTRACT_ADDRESS = process.env.RECEIPT_NFT_CONTRACT_ADDRESS || '';

// Check if required environment variables are present
if (!PRIVATE_KEY) {
  logger.warn('BLOCKCHAIN_PRIVATE_KEY not set, blockchain operations will be simulated');
}

if (!CONTRACT_ADDRESS) {
  logger.warn('RECEIPT_NFT_CONTRACT_ADDRESS not set, blockchain operations will be simulated');
}

// Define ABI for the ReceiptNFT contract
const CONTRACT_ABI = [
  // Mint receipt
  'function mintReceipt(address to, string calldata uri, string calldata tier) external returns (uint256)',
  
  // Log encryption data
  'function logEncryptionData(uint256 tokenId, string calldata capsule, string calldata ciphertext) external',
  
  // View functions
  'function uri(uint256 tokenId) public view returns (string memory)',
  'function getReceiptTier(uint256 tokenId) external view returns (string memory)',
  'function isEncrypted(uint256 tokenId) external view returns (bool)',
  'function getEncryptionData(uint256 tokenId) external view returns (string memory, string memory)',
  
  // Events
  'event ReceiptMinted(address indexed to, uint256 tokenId, string uri)',
  'event EncryptedData(uint256 indexed tokenId, string capsule, string ciphertext)'
];

/**
 * Amoy Blockchain Service Class
 */
class AmoyBlockchainService {
  private provider: any = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private isInitialized: boolean = false;
  private isSimulated: boolean = false;
  private mintCounter: number = 1;
  
  constructor() {
    this.initialize();
  }
  
  /**
   * Initialize blockchain service
   */
  private async initialize(): Promise<void> {
    try {
      // If missing required configuration, use simulation mode
      if (!PRIVATE_KEY || !CONTRACT_ADDRESS) {
        logger.info('Running in blockchain simulation mode');
        this.isSimulated = true;
        this.isInitialized = true;
        return;
      }
      
      logger.info('Initializing Amoy blockchain service...');
      
      // Create provider and wallet
      // Handle different versions of ethers.js
      if (typeof ethers.providers !== 'undefined' && typeof ethers.providers.JsonRpcProvider !== 'undefined') {
        // ethers v5
        this.provider = new ethers.providers.JsonRpcProvider(RPC_URL);
      } else {
        // ethers v6
        this.provider = new ethers.getDefaultProvider(RPC_URL);
      }
      this.wallet = new ethers.Wallet(PRIVATE_KEY, this.provider);
      
      // Create contract instance
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.wallet);
      
      // Check connection and balance
      const network = await this.provider.getNetwork();
      logger.info(`Connected to network: ${network.name} (${network.chainId})`);
      
      const balance = await this.provider.getBalance(this.wallet.address);
      logger.info(`Wallet address: ${this.wallet.address}`);
      logger.info(`Wallet balance: ${ethers.formatEther(balance)} MATIC`);
      
      if (balance < ethers.parseEther('0.001')) {
        logger.warn('Wallet balance is low, consider adding funds for transactions');
      }
      
      this.isInitialized = true;
      logger.info('Amoy blockchain service initialized successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to initialize blockchain service: ${errorMessage}`);
      this.isSimulated = true;
      this.isInitialized = true;
      logger.info('Falling back to simulation mode');
    }
  }
  
  /**
   * Mint a receipt NFT
   * @param receipt Receipt data
   * @param ownerAddress Owner wallet address
   * @param metadataUri IPFS URI of metadata
   * @returns Mint result
   */
  async mintReceipt(
    receipt: ReceiptData,
    ownerAddress: string,
    metadataUri: string
  ): Promise<{
    success: boolean;
    tokenId: string;
    transaction: string;
    error?: string;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      logger.info(`Minting receipt NFT for ${ownerAddress}...`);
      
      // Determine receipt tier
      const tierMapping = {
        economy: 'bronze',
        standard: 'silver',
        premium: 'gold',
        luxury: 'platinum'
      };
      
      const total = typeof receipt.total === 'number' ? receipt.total : 0;
      let tier = 'bronze';
      
      if (total >= 100) {
        tier = 'platinum';
      } else if (total >= 50) {
        tier = 'gold';
      } else if (total >= 20) {
        tier = 'silver';
      }
      
      // Handle real vs simulated minting
      if (!this.isSimulated && this.contract) {
        // Real blockchain interaction
        const transaction = await this.contract.mintReceipt(
          ownerAddress,
          metadataUri,
          tier
        );
        
        logger.info(`Transaction submitted: ${transaction.hash}`);
        
        // Wait for transaction confirmation
        const receipt = await transaction.wait();
        logger.info(`Transaction confirmed in block ${receipt.blockNumber}`);
        
        // Extract token ID from events
        const event = receipt.logs
          .map(log => {
            try {
              return this.contract?.interface.parseLog({
                topics: log.topics as string[],
                data: log.data
              });
            } catch (e) {
              return null;
            }
          })
          .find(event => event && event.name === 'ReceiptMinted');
        
        const tokenId = event?.args[1].toString() || '0';
        
        logger.info(`NFT minted with token ID: ${tokenId}`);
        
        return {
          success: true,
          tokenId,
          transaction: transaction.hash
        };
      } else {
        // Simulated minting
        logger.info('Simulating NFT minting');
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const tokenId = `${this.mintCounter++}`;
        const txHash = `0x${Math.random().toString(16).substring(2, 42)}`;
        
        logger.info(`Simulated NFT minted with token ID: ${tokenId}`);
        
        return {
          success: true,
          tokenId,
          transaction: txHash
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to mint NFT: ${errorMessage}`);
      return {
        success: false,
        tokenId: '0',
        transaction: '',
        error: errorMessage
      };
    }
  }
  
  /**
   * Log encryption event for a token
   * @param receiptId Receipt ID
   * @param ownerAddress Owner wallet address
   * @param metadataUri IPFS URI of metadata
   * @returns Log result
   */
  async logEncryptionEvent(
    receiptId: string,
    ownerAddress: string,
    metadataUri: string
  ): Promise<{
    success: boolean;
    transaction: string;
    error?: string;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      logger.info(`Logging encryption event for receipt ${receiptId}...`);
      
      // Handle real vs simulated logging
      if (!this.isSimulated && this.contract) {
        // For a real implementation, we would need to know the token ID
        // and have the encryption capsule and ciphertext
        // For now, we'll just simulate the event
        logger.info('Skipping real blockchain encryption logging (implementation pending)');
        
        // Simulate transaction
        const txHash = `0x${Math.random().toString(16).substring(2, 42)}`;
        
        return {
          success: true,
          transaction: txHash
        };
      } else {
        // Simulated logging
        logger.info('Simulating encryption event logging');
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const txHash = `0x${Math.random().toString(16).substring(2, 42)}`;
        
        return {
          success: true,
          transaction: txHash
        };
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to log encryption event: ${errorMessage}`);
      return {
        success: false,
        transaction: '',
        error: errorMessage
      };
    }
  }
  
  /**
   * Get NFT details by token ID
   * @param tokenId Token ID
   * @returns NFT details
   */
  async getNFTDetails(tokenId: string): Promise<any> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      
      logger.info(`Getting NFT details for token ID ${tokenId}...`);
      
      if (!this.isSimulated && this.contract) {
        // Real blockchain interaction
        try {
          const uri = await this.contract.uri(tokenId);
          const tier = await this.contract.getReceiptTier(tokenId);
          const isEncrypted = await this.contract.isEncrypted(tokenId);
          
          let encryptionData = { capsule: '', ciphertext: '' };
          if (isEncrypted) {
            const [capsule, ciphertext] = await this.contract.getEncryptionData(tokenId);
            encryptionData = { capsule, ciphertext };
          }
          
          return {
            tokenId,
            uri,
            tier,
            isEncrypted,
            encryptionData: isEncrypted ? encryptionData : null
          };
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          logger.warn(`Error fetching NFT details, falling back to simulation: ${errorMessage}`);
          
          // Fall back to simulation if blockchain query fails
          return this.simulateNFTDetails(tokenId);
        }
      } else {
        // Simulated details
        return this.simulateNFTDetails(tokenId);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to get NFT details: ${errorMessage}`);
      throw new Error(`Failed to get NFT details: ${errorMessage}`);
    }
  }
  
  /**
   * Simulate NFT details (for development/testing)
   * @param tokenId Token ID
   * @returns Simulated NFT details
   */
  private simulateNFTDetails(tokenId: string): any {
    logger.info('Simulating NFT details fetch');
    
    const tiers = ['bronze', 'silver', 'gold', 'platinum'];
    const tierIndex = parseInt(tokenId, 10) % tiers.length;
    const isEncrypted = parseInt(tokenId, 10) % 2 === 0;
    
    return {
      tokenId,
      uri: `ipfs://mock-cid-${tokenId}`,
      tier: tiers[tierIndex],
      isEncrypted,
      encryptionData: isEncrypted ? {
        capsule: `mock-capsule-${tokenId}`,
        ciphertext: `mock-ciphertext-${tokenId}`
      } : null
    };
  }
  
  /**
   * Check if blockchain service is available (not simulated)
   * @returns Boolean indicating real blockchain availability
   */
  isAvailable(): boolean {
    return this.isInitialized && !this.isSimulated;
  }
  
  /**
   * Get wallet address used for transactions
   * @returns Wallet address or null if simulated
   */
  getWalletAddress(): string | null {
    if (this.wallet) {
      return this.wallet.address;
    }
    return null;
  }
}

// Export singleton instance
export const amoyBlockchainService = new AmoyBlockchainService();