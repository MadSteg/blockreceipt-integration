/**
 * Blockchain Service for Polygon Amoy Testnet
 * This service handles interactions with the Polygon Amoy blockchain for Receipt NFTs
 */
import { ethers } from 'ethers';
import dotenv from 'dotenv';
import crypto from 'crypto';
import type { Receipt, ReceiptItem } from '@shared/schema';
import { Receipt1155Abi } from '../lib/Receipt1155Abi';

dotenv.config();

export interface ReceiptData {
  receiptId: number;
  merchant: string;
  total: string;
  date: string;
  items: Array<{
    name: string;
    price: string;
    quantity: number;
  }>;
}

class BlockchainServiceAmoy {
  private provider: ethers.providers.JsonRpcProvider | null = null;
  private wallet: ethers.Wallet | null = null;
  private contract: ethers.Contract | null = null;
  private mockMode = false;
  private initialized = false;
  private chainId = 80002; // Polygon Amoy chainId
  
  constructor() {
    this.initialize();
  }
  
  async initialize() {
    try {
      console.log('Initializing Amoy blockchain service...');
      
      // Check if required environment variables are set
      const rpcUrl = process.env.ALCHEMY_RPC;
      const privateKey = process.env.WALLET_PRIVATE_KEY;
      const contractAddress = process.env.RECEIPT_MINTER_ADDRESS;
      
      if (!rpcUrl || !privateKey || contractAddress === undefined) {
        console.warn('Missing Amoy blockchain environment variables, using mock mode');
        this.mockMode = true;
        this.initialized = true;
        return;
      }
      
      // Extra validation for empty values
      if (privateKey.trim() === '') {
        console.warn('Amoy blockchain private key is empty, using mock mode');
        this.mockMode = true;
        this.initialized = true;
        return;
      }
      
      // Create provider and wallet
      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      
      // Create contract instance
      this.contract = new ethers.Contract(contractAddress, Receipt1155Abi, this.wallet);
      
      // Test connection
      try {
        const network = await this.provider.getNetwork();
        console.log(`Connected to Amoy network: ${network.name} (${network.chainId})`);
        this.chainId = network.chainId;
        this.mockMode = false;
      } catch (error) {
        console.error('Could not connect to Amoy blockchain network:', error);
        this.mockMode = true;
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('Error initializing Amoy blockchain service:', error);
      this.mockMode = true;
      this.initialized = true;
    }
  }
  
  /**
   * Check if the blockchain service is available
   */
  async isAvailable() {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.mockMode) {
      return {
        available: true,
        network: 'amoy-mock',
        chainId: this.chainId,
        contractAddress: '0xMockContractAddress',
        walletAddress: '0xMockWalletAddress',
        mockMode: true,
        message: 'Running in mock mode. Blockchain operations will be simulated.'
      };
    }
    
    try {
      const network = await this.provider!.getNetwork();
      const blockNumber = await this.provider!.getBlockNumber();
      
      return {
        available: true,
        network: network.name,
        chainId: network.chainId,
        blockNumber,
        contractAddress: this.contract!.address,
        walletAddress: this.wallet!.address,
        mockMode: false
      };
    } catch (error) {
      console.error('Error checking Amoy blockchain availability:', error);
      return {
        available: false,
        error: 'Could not connect to Amoy blockchain network',
        mockMode: this.mockMode
      };
    }
  }
  
  /**
   * Create a hash of the receipt data for blockchain verification
   */
  createReceiptHash(receipt: Receipt, items: ReceiptItem[]) {
    // Create a standardized string representation of the receipt and hash it
    const receiptString = JSON.stringify({
      receiptId: receipt.id,
      merchantId: receipt.merchantId,
      date: receipt.date,
      total: receipt.total,
      items: items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    });
    
    return '0x' + crypto.createHash('sha256').update(receiptString).digest('hex');
  }
  
  /**
   * Mint a receipt as an NFT on the blockchain
   */
  async mintReceiptNFT(receipt: Receipt, items: ReceiptItem[]) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.mockMode) {
      return this.mockMintReceipt(receipt, items);
    }
    
    try {
      // Create receipt data
      const receiptData = {
        receiptId: receipt.id,
        merchant: receipt.merchant.name,
        total: receipt.total,
        date: receipt.date.toISOString(),
        items: items.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        }))
      };
      
      // Hash the receipt data for on-chain verification
      const receiptHash = this.createReceiptHash(receipt, items);
      
      // Generate a random token ID that will be unique for this receipt
      // We use the receipt ID + 1000 to ensure no conflicts
      const tokenId = receipt.id + 1000;
      
      // Create a simple encryption key for demonstration purposes
      // In a production environment, use a more secure method
      const encryptionKey = crypto.randomBytes(16).toString('hex');
      
      // In a real implementation, we would encrypt the receipt data with this key
      // and upload it to IPFS, then store the IPFS CID on-chain
      // For simplicity, we'll mock the IPFS upload here
      const mockIpfsCid = `QmReceipt${tokenId}`;
      
      // Mint the NFT - this calls the smart contract
      const tx = await this.contract!.mintReceipt(
        tokenId,
        receiptHash,
        `ipfs://${mockIpfsCid}`,
        { gasLimit: 500000 }
      );
      
      // Wait for transaction to be mined
      const receipt = await tx.wait();
      
      return {
        success: true,
        receipt: {
          id: receipt.id,
          merchant: receipt.merchant.name,
          date: receipt.date.toISOString(),
          total: receipt.total,
          blockchain: {
            tokenId: tokenId.toString(),
            transactionHash: tx.hash,
            blockNumber: receipt.blockNumber,
            network: 'amoy',
            receiptHash
          }
        }
      };
    } catch (error) {
      console.error('Error minting receipt NFT on Amoy blockchain:', error);
      
      // Fall back to mock mode if actual minting fails
      return {
        success: false,
        error: `Failed to mint receipt NFT: ${error}`,
        mockResult: this.mockMintReceipt(receipt, items)
      };
    }
  }
  
  /**
   * Mock minting a receipt NFT - for testing purposes
   */
  mockMintReceipt(receipt: Receipt, items: ReceiptItem[]) {
    // Create a mock hash
    const receiptHash = this.createReceiptHash(receipt, items);
    
    // Generate a deterministic token ID based on receipt ID
    const tokenId = receipt.id + 1000;
    
    // Generate deterministic mock data
    const mockTxHash = '0x' + crypto.createHash('md5').update(tokenId.toString()).digest('hex').substring(0, 12);
    const mockBlockNumber = 1000000 + Math.floor(Math.random() * 1000);
    const mockKey = `mock-key-${receipt.id}`;
    const mockIpfsCid = `QmMock${Math.floor(Math.random() * 1000000)}`;
    
    return {
      success: true,
      message: "Receipt minted using mock Amoy blockchain data",
      txHash: mockTxHash,
      tokenId,
      blockNumber: mockBlockNumber,
      encryptionKey: mockKey,
      ipfsCid: mockIpfsCid,
      ipfsUrl: `https://ipfs.io/ipfs/${mockIpfsCid}`,
      mockMode: true
    };
  }
  
  /**
   * Verify a receipt on the blockchain
   */
  async verifyReceipt(tokenId: number, receipt?: Receipt) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (this.mockMode) {
      return this.mockVerifyReceipt(tokenId, receipt);
    }
    
    try {
      // Call the contract to get the tokenURI and hash
      const tokenURI = await this.contract!.uri(tokenId);
      const storedHash = await this.contract!.receiptHashes(tokenId);
      const owner = await this.contract!.ownerOf(tokenId);
      
      // If a receipt is provided, verify the hash matches
      let verified = true;
      let calculatedHash = '';
      
      if (receipt) {
        // Get receipt items
        const items = await Promise.resolve([]);  // We would fetch items from storage here
        calculatedHash = this.createReceiptHash(receipt, items);
        verified = calculatedHash === storedHash;
      }
      
      return {
        success: true,
        verified,
        receipt: receipt ? {
          id: receipt.id,
          merchant: receipt.merchant.name,
          date: receipt.date.toISOString(),
          total: receipt.total,
          blockchain: {
            tokenId: tokenId.toString(),
            verified,
            uri: tokenURI,
            receiptHash: calculatedHash,
            storedHash,
            owner
          }
        } : null
      };
    } catch (error) {
      console.error('Error verifying receipt on Amoy blockchain:', error);
      
      // Fall back to mock verification
      return {
        success: false,
        error: `Failed to verify receipt: ${error}`,
        mockResult: this.mockVerifyReceipt(tokenId, receipt)
      };
    }
  }
  
  /**
   * Mock verifying a receipt - for testing purposes
   */
  mockVerifyReceipt(tokenId: number, receipt?: Receipt) {
    // Generate deterministic mock data
    const mockIpfsCid = `QmMock${tokenId % 10}`;
    const mockOwner = '0xMockOwnerAddress';
    
    // If a receipt is provided, use it to generate a hash
    let verified = true;
    let receiptHash = '0xc45734ed5448263415f642a651767b04707530ab6505cb8a948999c042e1bb46';
    
    if (receipt) {
      // Get receipt items - in a real implementation, we would fetch these from storage
      const items: ReceiptItem[] = [];
      receiptHash = this.createReceiptHash(receipt, items);
    }
    
    return {
      success: true,
      verified,
      receipt: receipt ? {
        id: receipt.id,
        merchant: receipt.merchant.name,
        date: receipt.date.toISOString(),
        total: receipt.total,
        blockchain: {
          tokenId: tokenId.toString(),
          verified,
          uri: `ipfs://${mockIpfsCid}`,
          receiptHash,
          storedHash: receiptHash,
          owner: mockOwner,
          mockMode: true
        }
      } : null
    };
  }
}

export const blockchainServiceAmoy = new BlockchainServiceAmoy();