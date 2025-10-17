import { ethers } from 'ethers';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// Import the contract ABI
const contractABI = [
  "function mintReceipt(address to, uint256 tokenId, bytes32 receiptHash, string calldata uri_, string calldata stampUri_, bool encrypted, string calldata policyId) external",
  "function mintNewReceipt(address to, bytes32 receiptHash, string calldata uri_, string calldata stampUri_, bool encrypted, string calldata policyId) external returns (uint256)",
  "function updateStampUri(uint256 tokenId, string calldata stampUri_) external",
  "function updatePolicyId(uint256 tokenId, string calldata policyId) external",
  "function setEncryptionStatus(uint256 tokenId, bool encrypted) external",
  "function uri(uint256 tokenId) public view returns (string memory)",
  "function stampUri(uint256 tokenId) public view returns (string memory)",
  "function getReceiptHash(uint256 tokenId) public view returns (bytes32)",
  "function verifyReceiptHash(uint256 tokenId, bytes32 hash) public view returns (bool)",
  "function isEncrypted(uint256 tokenId) public view returns (bool)",
  "function getPolicyId(uint256 tokenId) public view returns (string memory)",
  "function getTokenData(uint256 tokenId) public view returns (string memory tokenUri, string memory stampUri_, bool encrypted, string memory policyId)"
];

// Interface for receipt data
interface ReceiptData {
  id: string | number;
  merchantName: string;
  date: Date | string;
  total: number;
  items?: Array<{ name: string; price: number; quantity?: number; category?: string }>;
  category?: string;
  subtotal?: number;
  tax?: number;
  metadata?: any;
}

// Enhanced BlockchainService for Receipt1155Enhanced contract
export class BlockchainEnhancedService {
  private mockMode: boolean = true;
  private connected: boolean = false;
  private provider: ethers.providers.Provider | null = null;
  private contract: ethers.Contract | null = null;
  private wallet: ethers.Wallet | null = null;
  private contractAddress: string = '';
  private networkName: string = '';
  private chainId: number = 0;

  constructor() {
    // Initialize the blockchain service with environment variables
    this.mockMode = process.env.MOCK_BLOCKCHAIN === 'true' || 
                     process.env.RECEIPT_NFT_CONTRACT_ADDRESS === '0x1111111111111111111111111111111111111111';
    
    // Initialize the service
    this.init().catch(err => {
      logger.error('Failed to initialize blockchain service:', err);
      this.mockMode = true;
      this.connected = this.mockMode;
      logger.info(`Falling back to mock mode due to initialization error`);
    });
  }

  private async init() {
    try {
      // Check if we should use mock mode
      if (this.mockMode) {
        this.connected = true;
        logger.info('BlockchainEnhancedService initialized in mock mode');
        return;
      }

      // Get provider
      let providerUrl = process.env.ALCHEMY_RPC || process.env.POLYGON_MUMBAI_RPC_URL || '';
      if (!providerUrl) {
        throw new Error('Missing RPC URL in environment variables');
      }

      this.provider = new ethers.providers.JsonRpcProvider(providerUrl);
      
      // Get network information
      const network = await this.provider.getNetwork();
      this.chainId = network.chainId;
      this.networkName = network.name;
      
      // Get contract address
      this.contractAddress = process.env.RECEIPT_NFT_CONTRACT_ADDRESS || '';
      if (!this.contractAddress) {
        throw new Error('Missing contract address in environment variables');
      }
      
      // Check if the contract address is a mock address
      if (this.contractAddress === '0x1111111111111111111111111111111111111111') {
        logger.info('Using simulation contract address to trigger mock mode');
        this.mockMode = true;
        this.connected = true;
        return;
      }
      
      // Setup wallet with private key
      const privateKey = process.env.WALLET_PRIVATE_KEY || process.env.BLOCKCHAIN_PRIVATE_KEY || '';
      if (!privateKey) {
        throw new Error('Missing wallet private key in environment variables');
      }
      
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      
      // Connect to the contract
      this.contract = new ethers.Contract(
        this.contractAddress,
        contractABI,
        this.wallet
      );
      
      this.connected = true;
      logger.info(`Connected to blockchain network: ${this.networkName} chainId: ${this.chainId}`);
      logger.info(`Blockchain service initialized with contract: ${this.contractAddress}`);
      
    } catch (error) {
      logger.error('Error initializing blockchain service:', error);
      this.mockMode = true;
      this.connected = this.mockMode;
      throw error;
    }
  }

  /**
   * Create a receipt hash for verification
   * @param receipt The receipt data
   * @returns A bytes32 hash of the receipt data
   */
  createReceiptHash(receipt: ReceiptData): string {
    try {
      // Create a deterministic hash of the receipt data
      const receiptData = {
        id: receipt.id,
        merchantName: receipt.merchantName,
        date: typeof receipt.date === 'string' ? receipt.date : receipt.date.toISOString(),
        total: receipt.total.toString(),
        items: receipt.items ? receipt.items.map(item => ({
          name: item.name,
          price: item.price.toString(),
          quantity: (item.quantity || 1).toString(),
          category: item.category || ''
        })) : [],
        category: receipt.category || '',
        subtotal: (receipt.subtotal || receipt.total).toString(),
        tax: (receipt.tax || 0).toString()
      };
      
      // Create a JSON string and hash it
      const receiptJson = JSON.stringify(receiptData, Object.keys(receiptData).sort());
      const receiptHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(receiptJson));
      
      return receiptHash;
    } catch (error) {
      logger.error('Error creating receipt hash:', error);
      
      // In case of any error, use a fallback hash mechanism
      const fallbackString = `${receipt.id}-${receipt.merchantName}-${receipt.total}`;
      return ethers.utils.keccak256(ethers.utils.toUtf8Bytes(fallbackString));
    }
  }

  /**
   * Mint a new receipt NFT
   * @param receipt The receipt data 
   * @param metadataUri The URI pointing to the receipt's metadata
   * @param stampUri The URI pointing to the receipt's passport stamp
   * @param toAddress The wallet address to mint the NFT to
   * @param encrypted Whether the metadata is encrypted
   * @param policyId The encryption policy ID (if applicable)
   * @returns Transaction details or mock data in development mode
   */
  async mintReceipt(
    receipt: ReceiptData,
    metadataUri: string,
    stampUri: string,
    toAddress: string,
    encrypted: boolean = false,
    policyId: string = ''
  ): Promise<any> {
    logger.info(`Minting receipt NFT for ${receipt.merchantName} to ${toAddress}`);
    
    if (this.mockMode) {
      return this.mockMintReceipt(receipt, metadataUri, stampUri, toAddress, encrypted, policyId);
    }
    
    try {
      if (!this.contract || !this.connected) {
        throw new Error('Blockchain service not connected');
      }
      
      // Create receipt hash
      const receiptHash = this.createReceiptHash(receipt);
      
      // Mint a new receipt with the enhanced contract
      const tx = await this.contract.mintNewReceipt(
        toAddress,
        receiptHash,
        metadataUri,
        stampUri,
        encrypted,
        policyId
      );
      
      // Wait for transaction to be mined
      const receipt_ = await tx.wait();
      
      // Find the ReceiptMinted event to get the tokenId
      const event = receipt_.events.find((e: any) => e.event === 'ReceiptMinted');
      const tokenId = event ? event.args.tokenId.toString() : null;
      
      return {
        success: true,
        tokenId,
        transactionHash: tx.hash,
        blockNumber: receipt_.blockNumber,
        receiptHash,
        metadataUri,
        stampUri,
        toAddress,
        encrypted,
        policyId,
        mockMode: false
      };
    } catch (error) {
      logger.error('Error minting receipt NFT:', error);
      return {
        success: false,
        error: error.message,
        mockMode: false
      };
    }
  }

  /**
   * Update the passport stamp for an existing NFT
   * @param tokenId The token ID
   * @param stampUri The new stamp URI
   * @returns Transaction details or mock data in development mode
   */
  async updateStamp(tokenId: string | number, stampUri: string): Promise<any> {
    logger.info(`Updating passport stamp for token ${tokenId}`);
    
    if (this.mockMode) {
      return this.mockUpdateStamp(tokenId, stampUri);
    }
    
    try {
      if (!this.contract || !this.connected) {
        throw new Error('Blockchain service not connected');
      }
      
      // Update the stamp URI
      const tx = await this.contract.updateStampUri(tokenId, stampUri);
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      return {
        success: true,
        tokenId,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        stampUri,
        mockMode: false
      };
    } catch (error) {
      logger.error('Error updating passport stamp:', error);
      return {
        success: false,
        error: error.message,
        mockMode: false
      };
    }
  }

  /**
   * Update the encryption status for an NFT
   * @param tokenId The token ID
   * @param encrypted Whether the metadata is encrypted
   * @param policyId The encryption policy ID (if applicable)
   * @returns Transaction details or mock data in development mode
   */
  async updateEncryptionStatus(
    tokenId: string | number,
    encrypted: boolean,
    policyId: string = ''
  ): Promise<any> {
    logger.info(`Updating encryption status for token ${tokenId} to ${encrypted ? 'encrypted' : 'decrypted'}`);
    
    if (this.mockMode) {
      return this.mockUpdateEncryptionStatus(tokenId, encrypted, policyId);
    }
    
    try {
      if (!this.contract || !this.connected) {
        throw new Error('Blockchain service not connected');
      }
      
      // First update the encryption status
      const statusTx = await this.contract.setEncryptionStatus(tokenId, encrypted);
      await statusTx.wait();
      
      // If a policy ID is provided, update it as well
      let policyTx = null;
      if (policyId) {
        policyTx = await this.contract.updatePolicyId(tokenId, policyId);
        await policyTx.wait();
      }
      
      return {
        success: true,
        tokenId,
        transactionHash: statusTx.hash,
        policyTransactionHash: policyTx ? policyTx.hash : null,
        encrypted,
        policyId,
        mockMode: false
      };
    } catch (error) {
      logger.error('Error updating encryption status:', error);
      return {
        success: false,
        error: error.message,
        mockMode: false
      };
    }
  }

  /**
   * Get all token data for a specific token ID
   * @param tokenId The token ID to query
   * @returns Token data or mock data in development mode
   */
  async getTokenData(tokenId: string | number): Promise<any> {
    logger.info(`Getting token data for ${tokenId}`);
    
    if (this.mockMode) {
      return this.mockGetTokenData(tokenId);
    }
    
    try {
      if (!this.contract || !this.connected) {
        throw new Error('Blockchain service not connected');
      }
      
      // Get all token data from the contract
      const data = await this.contract.getTokenData(tokenId);
      
      return {
        success: true,
        tokenId,
        metadataUri: data.tokenUri,
        stampUri: data.stampUri_,
        encrypted: data.encrypted,
        policyId: data.policyId,
        mockMode: false
      };
    } catch (error) {
      logger.error('Error getting token data:', error);
      return {
        success: false,
        error: error.message,
        mockMode: false
      };
    }
  }

  /**
   * Verify a receipt hash against the blockchain
   * @param tokenId The token ID to verify
   * @param receipt The receipt data to verify
   * @returns Verification result or mock data in development mode
   */
  async verifyReceipt(tokenId: string | number, receipt: ReceiptData): Promise<any> {
    logger.info(`Verifying receipt hash for token ${tokenId}`);
    
    if (this.mockMode) {
      return this.mockVerifyReceipt(tokenId, receipt);
    }
    
    try {
      if (!this.contract || !this.connected) {
        throw new Error('Blockchain service not connected');
      }
      
      // Create receipt hash
      const receiptHash = this.createReceiptHash(receipt);
      
      // Verify the hash against the blockchain
      const verified = await this.contract.verifyReceiptHash(tokenId, receiptHash);
      
      return {
        success: true,
        verified,
        tokenId,
        receiptHash,
        mockMode: false
      };
    } catch (error) {
      logger.error('Error verifying receipt:', error);
      return {
        success: false,
        error: error.message,
        mockMode: false
      };
    }
  }

  /**
   * Check blockchain connection status
   * @returns Blockchain network status
   */
  async getNetworkStatus(): Promise<any> {
    if (this.mockMode) {
      return {
        available: true,
        network: 'development',
        chainId: 31337,
        contractAddress: '0x1111111111111111111111111111111111111111',
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        mockMode: true,
        message: 'Running in development mock mode'
      };
    }
    
    try {
      if (!this.provider || !this.wallet) {
        throw new Error('Blockchain service not fully initialized');
      }
      
      const network = await this.provider.getNetwork();
      
      return {
        available: this.connected,
        network: network.name,
        chainId: network.chainId,
        contractAddress: this.contractAddress,
        walletAddress: this.wallet.address,
        mockMode: false,
        message: this.connected ? 'Connected to blockchain' : 'Not connected to blockchain'
      };
    } catch (error) {
      logger.error('Error getting network status:', error);
      return {
        available: false,
        error: error.message,
        mockMode: false,
        message: 'Failed to get network status'
      };
    }
  }

  /**
   * Check if the service is connected to the blockchain
   * @returns Connection status
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Mock implementation for mintReceipt
   */
  private mockMintReceipt(
    receipt: ReceiptData,
    metadataUri: string,
    stampUri: string,
    toAddress: string,
    encrypted: boolean,
    policyId: string
  ): any {
    // Generate a random token ID
    const tokenId = Math.floor(Math.random() * 1000000).toString();
    
    // Calculate a real receipt hash for consistency
    const receiptHash = this.createReceiptHash(receipt);
    
    // Return mock transaction data
    return {
      success: true,
      tokenId,
      transactionHash: `0x${crypto.randomBytes(32).toString('hex')}`,
      blockNumber: Math.floor(Math.random() * 10000000),
      receiptHash,
      metadataUri,
      stampUri,
      toAddress,
      encrypted,
      policyId,
      mockMode: true,
      message: 'Mock mode: No actual blockchain transaction occurred'
    };
  }

  /**
   * Mock implementation for updateStamp
   */
  private mockUpdateStamp(tokenId: string | number, stampUri: string): any {
    return {
      success: true,
      tokenId,
      transactionHash: `0x${crypto.randomBytes(32).toString('hex')}`,
      blockNumber: Math.floor(Math.random() * 10000000),
      stampUri,
      mockMode: true,
      message: 'Mock mode: No actual blockchain transaction occurred'
    };
  }

  /**
   * Mock implementation for updateEncryptionStatus
   */
  private mockUpdateEncryptionStatus(
    tokenId: string | number,
    encrypted: boolean,
    policyId: string
  ): any {
    return {
      success: true,
      tokenId,
      transactionHash: `0x${crypto.randomBytes(32).toString('hex')}`,
      policyTransactionHash: policyId ? `0x${crypto.randomBytes(32).toString('hex')}` : null,
      encrypted,
      policyId,
      mockMode: true,
      message: 'Mock mode: No actual blockchain transaction occurred'
    };
  }

  /**
   * Mock implementation for getTokenData
   */
  private mockGetTokenData(tokenId: string | number): any {
    return {
      success: true,
      tokenId,
      metadataUri: `ipfs://Qm${crypto.randomBytes(44).toString('hex')}`,
      stampUri: `ipfs://Qm${crypto.randomBytes(44).toString('hex')}`,
      encrypted: Math.random() > 0.5,
      policyId: Math.random() > 0.5 ? `policy_${Date.now()}_${crypto.randomBytes(5).toString('hex')}` : '',
      mockMode: true,
      message: 'Mock mode: This data is simulated for development'
    };
  }

  /**
   * Mock implementation for verifyReceipt
   */
  private mockVerifyReceipt(tokenId: string | number, receipt: ReceiptData): any {
    // Always return verified as true in mock mode
    return {
      success: true,
      verified: true,
      tokenId,
      receiptHash: this.createReceiptHash(receipt),
      mockMode: true,
      message: 'Mock mode: No actual blockchain verification occurred'
    };
  }
}

// Create and export the service instance
export const blockchainEnhancedService = new BlockchainEnhancedService();