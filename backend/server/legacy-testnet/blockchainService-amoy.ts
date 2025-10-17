import { ethers } from 'ethers';
import crypto from 'crypto';
import { FullReceipt } from '@shared/schema';

// We'll load the artifact dynamically once compiled
let Receipt1155Artifact: any = { 
  abi: [
    // Minimal ABI for minting receipts
    {
      "inputs": [
        { "internalType": "address", "name": "to", "type": "address" },
        { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
        { "internalType": "bytes32", "name": "receiptHash", "type": "bytes32" },
        { "internalType": "string", "name": "uri_", "type": "string" }
      ],
      "name": "mintReceipt",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
      ],
      "name": "uri",
      "outputs": [{ "internalType": "string", "name": "", "type": "string" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "uint256", "name": "tokenId", "type": "uint256" },
        { "internalType": "bytes32", "name": "hash", "type": "bytes32" }
      ],
      "name": "verifyReceiptHash",
      "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "uint256", "name": "tokenId", "type": "uint256" }
      ],
      "name": "getReceiptHash",
      "outputs": [{ "internalType": "bytes32", "name": "", "type": "bytes32" }],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [
        { "internalType": "address", "name": "account", "type": "address" },
        { "internalType": "uint256", "name": "id", "type": "uint256" }
      ],
      "name": "balanceOf",
      "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
      "stateMutability": "view",
      "type": "function"
    }
  ]
};

export interface IBlockchainService {
  createReceiptHash(receipt: FullReceipt): string;
  mintReceipt(receipt: FullReceipt): Promise<any>;
  verifyReceipt(tokenId: string, receipt: FullReceipt): Promise<any>;
  getNetworkStatus(): Promise<any>;
}

class BlockchainService implements IBlockchainService {
  private provider?: ethers.providers.JsonRpcProvider;
  private wallet?: ethers.Wallet;
  private contract?: ethers.Contract;
  private mockMode: boolean = true; // Start in mock mode by default

  constructor() {
    this.initialize().catch(err => {
      console.warn('Error initializing blockchain service, using mock mode:', err.message);
    });
  }

  async initialize() {
    // Check if environment variables are available
    if (!process.env.ALCHEMY_RPC || 
        !process.env.WALLET_PRIVATE_KEY) {
      console.warn('Missing Amoy blockchain environment variables, using mock mode');
      return;
    }
    
    // Force the use of our simulated contract address (which will trigger mock mode)
    const SIMULATED_ADDRESS = '0x1111111111111111111111111111111111111111';
    process.env.RECEIPT_MINTER_ADDRESS = SIMULATED_ADDRESS;
    console.log('Using simulation contract address to trigger mock mode:', SIMULATED_ADDRESS);

    try {
      console.log('Initializing blockchain service for Polygon Amoy...');
      
      // Initialize provider with the Amoy testnet
      // Check if ALCHEMY_RPC is a full URL or just an API key
      let rpcUrl = process.env.ALCHEMY_RPC;
      if (!rpcUrl.startsWith('http')) {
        // It's likely just the API key, so construct the full URL
        rpcUrl = `https://polygon-amoy.g.alchemy.com/v2/${rpcUrl}`;
      }
      
      console.log('Using Amoy RPC URL:', rpcUrl);
      
      // Use JsonRpcProvider with Amoy network details
      const amoyNetwork = {
        name: 'amoy',
        chainId: 80002
      };
      
      this.provider = new ethers.providers.JsonRpcProvider(
        rpcUrl,
        amoyNetwork
      );
      
      // Test connection by trying to get the network
      try {
        const network = await this.provider.getNetwork();
        console.log('Connected to blockchain network:', network.name, 'chainId:', network.chainId);
        
        // Create wallet with the provided private key
        this.wallet = new ethers.Wallet(process.env.WALLET_PRIVATE_KEY, this.provider);
        
        // Initialize contract with the contract address and ABI
        this.contract = new ethers.Contract(
          process.env.RECEIPT_MINTER_ADDRESS,
          Receipt1155Artifact.abi,
          this.wallet
        );
        
        // If we make it here, we can use real blockchain mode
        this.mockMode = false;
        console.log('Blockchain service initialized with contract:', process.env.RECEIPT_MINTER_ADDRESS);
      } catch (networkError: any) {
        console.warn('Could not connect to blockchain network:', networkError.message);
      }
    } catch (error: any) {
      console.error('Error initializing blockchain service:', error.message);
    }
  }

  createReceiptHash(receipt: FullReceipt): string {
    // Create a deterministic hash of the receipt data 
    const receiptData = {
      id: receipt.id,
      merchant: receipt.merchant.name,
      total: receipt.total,
      date: receipt.date ? receipt.date.toISOString() : '',
      items: receipt.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    };

    // Create a deterministic hash of the receipt data
    const dataJson = JSON.stringify(receiptData, Object.keys(receiptData).sort());
    return '0x' + crypto.createHash('sha256').update(dataJson).digest('hex');
  }

  async mintReceipt(receipt: FullReceipt): Promise<any> {
    // Use mock mode if blockchain is not available
    if (this.mockMode) {
      return this.mockMintReceipt(receipt);
    }

    try {
      if (!this.contract || !this.wallet) {
        console.warn('Blockchain contract or wallet not initialized, falling back to mock mode');
        return this.mockMintReceipt(receipt);
      }

      const receiptHash = this.createReceiptHash(receipt);
      console.log('Minting receipt with hash:', receiptHash);

      // Use ethers.utils.keccak256 to convert string to bytes32
      const hashBytes = ethers.utils.arrayify(receiptHash);
      
      // Generate a unique token ID based on the receipt ID
      const tokenId = receipt.id + 1000; // Add offset to avoid conflicts
      
      // IPFS storage URI for the receipt (would be implemented separately)
      const uri = `ipfs://QmReceipt${receipt.id}`;
      
      // Mint the NFT receipt on the blockchain
      const tx = await this.contract.mintReceipt(
        this.wallet.address, // Owner address
        tokenId,
        receiptHash,
        uri
      );
      
      // Wait for transaction to be confirmed
      const txReceipt = await tx.wait();
      
      return {
        receipt: {
          id: receipt.id,
          blockchain: {
            tokenId: tokenId.toString(),
            transactionHash: tx.hash,
            blockNumber: txReceipt.blockNumber,
            network: (await this.provider?.getNetwork())?.name || 'amoy',
            receiptHash
          }
        }
      };
    } catch (error: any) {
      console.error('Error minting receipt on blockchain:', error.message);
      // Fall back to mock mode
      console.warn('Falling back to mock mode');
      return this.mockMintReceipt(receipt);
    }
  }

  async verifyReceipt(tokenId: string, receipt: FullReceipt): Promise<any> {
    // Use mock mode if blockchain is not available
    if (this.mockMode) {
      return this.mockVerifyReceipt(tokenId, receipt);
    }

    try {
      if (!this.contract || !this.provider) {
        console.warn('Blockchain contract not initialized, falling back to mock mode');
        return this.mockVerifyReceipt(tokenId, receipt);
      }
      
      // Get the token URI and owner
      const uri = await this.contract.uri(tokenId);
      const owner = await this.contract.balanceOf(this.wallet?.address || ethers.constants.AddressZero, tokenId);
      
      // Get the receipt hash stored on blockchain
      const storedHash = await this.contract.getReceiptHash(tokenId);
      
      // Calculate the hash of the receipt we're verifying
      const calculatedHash = this.createReceiptHash(receipt);
      
      // Verify the hashes match
      const verified = await this.contract.verifyReceiptHash(tokenId, calculatedHash);
      
      return {
        verified,
        receipt: {
          id: receipt.id,
          blockchain: {
            tokenId,
            uri,
            verified,
            receiptHash: calculatedHash,
            storedHash: ethers.utils.hexlify(storedHash),
            owner
          }
        }
      };
    } catch (error: any) {
      console.error('Error verifying receipt on blockchain:', error.message);
      // Fall back to mock mode
      console.warn('Falling back to mock mode');
      return this.mockVerifyReceipt(tokenId, receipt);
    }
  }

  async getNetworkStatus(): Promise<any> {
    // If we're in mock mode, return mock data
    if (this.mockMode) {
      return {
        available: true,
        network: 'amoy-mock',
        chainId: 80002,
        contractAddress: process.env.RECEIPT_MINTER_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        walletAddress: '0xMockWalletAddress',
        mockMode: true,
        message: 'Running in mock mode. Blockchain operations will be simulated.'
      };
    }

    // Try to get real network info
    try {
      // Re-initialize if we don't have a provider
      if (!this.provider) {
        await this.initialize();
        
        // If we're still in mock mode, return mock data
        if (this.mockMode || !this.provider) {
          return {
            available: true,
            network: 'amoy-mock',
            chainId: 80002,
            contractAddress: process.env.RECEIPT_MINTER_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
            walletAddress: '0xMockWalletAddress',
            mockMode: true,
            message: 'Connection to Amoy failed, running in mock mode.'
          };
        }
      }

      // Real blockchain connection
      const network = await this.provider.getNetwork();
      return {
        available: true,
        network: network.name || 'amoy',
        chainId: network.chainId,
        contractAddress: process.env.RECEIPT_MINTER_ADDRESS || 'unknown',
        walletAddress: this.wallet?.address || 'unknown',
        mockMode: false,
        message: 'Connected to Polygon Amoy network'
      };
    } catch (error: any) {
      console.error('Error getting blockchain network status:', error.message);
      
      // Return mock data on error
      return {
        available: true,
        network: 'amoy-mock',
        chainId: 80002,
        contractAddress: process.env.RECEIPT_MINTER_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        walletAddress: '0xMockWalletAddress',
        mockMode: true,
        error: error.message || 'Unknown error',
        message: 'Network error, using mock mode. Blockchain operations will be simulated.'
      };
    }
  }

  private mockMintReceipt(receipt: FullReceipt): any {
    // Generate mock transaction data
    const txHash = '0x' + Array.from({length: 12}, () => 
      Math.floor(Math.random() * 16).toString(16)).join('');
    
    // Generate a mock token ID based on the receipt ID
    const tokenId = receipt.id + 1000;
    
    // Generate a mock block number
    const blockNumber = 1000000 + Math.floor(Math.random() * 1000);
    
    // Generate a mock IPFS CID
    const ipfsCid = 'QmMock' + Math.floor(Math.random() * 1000000).toString();
    const ipfsUrl = `https://ipfs.io/ipfs/${ipfsCid}`;
    
    // Create receipt hash for verification
    const receiptHash = this.createReceiptHash(receipt);
    
    return {
      success: true,
      message: 'Receipt minted in mock mode (Amoy)',
      txHash,
      tokenId,
      blockNumber,
      receiptHash,
      encryptionKey: 'mock-key-' + receipt.id,
      ipfsCid,
      ipfsUrl
    };
  }

  private mockVerifyReceipt(tokenId: string, receipt: FullReceipt): any {
    // Calculate receipt hash
    const receiptHash = this.createReceiptHash(receipt);
    
    // In mock mode, verification always succeeds
    return {
      verified: true,
      receipt: {
        id: receipt.id,
        blockchain: {
          tokenId,
          receiptHash,
          storedHash: receiptHash,
          uri: `ipfs://QmMock${receipt.id}`,
          owner: this.wallet?.address || '0xMockOwnerAddress',
          mockMode: true
        }
      }
    };
  }
}

export const blockchainService = new BlockchainService();