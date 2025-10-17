import { ethers } from 'ethers';
import crypto from 'crypto';

// Receipt1155 ABI - minimal version with just the functions we need
const Receipt1155ABI = [
  "function mint(address to, string calldata uri_, bytes32 receiptHash) external returns (uint256)",
  "function uri(uint256 tokenId) public view returns (string memory)",
  "function verifyReceipt(uint256 tokenId, bytes32 receiptHash) public view returns (bool)",
  "function getReceiptHash(uint256 tokenId) public view returns (bytes32)",
  "function getReceiptOwner(uint256 tokenId) public view returns (address)"
];

class BlockchainService {
  constructor() {
    this.initialized = false;
    this.provider = null;
    this.contract = null;
    this.wallet = null;
    this.tokenIdCounter = 1;
  }

  // Initialize blockchain connection
  initialize() {
    try {
      const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;
      const rpcUrl = process.env.POLYGON_MUMBAI_RPC_URL;
      const contractAddress = process.env.RECEIPT_NFT_CONTRACT_ADDRESS;
      
      if (!privateKey || !rpcUrl || !contractAddress) {
        console.warn("Missing blockchain environment variables. Mock mode will be used.");
        return false;
      }

      this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
      this.wallet = new ethers.Wallet(privateKey, this.provider);
      this.contract = new ethers.Contract(contractAddress, Receipt1155ABI, this.wallet);
      this.initialized = true;
      
      return true;
    } catch (error) {
      console.error("Error initializing blockchain service:", error);
      this.initialized = false;
      return false;
    }
  }

  // Check if blockchain integration is available
  isAvailable() {
    if (!this.initialized) {
      this.initialize();
    }
    return this.initialized;
  }

  // Create receipt hash
  createReceiptHash(receipt) {
    // Create a hash of the receipt data
    const receiptData = JSON.stringify({
      merchant: receipt.merchant.name,
      date: receipt.date,
      total: receipt.total,
      items: receipt.items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    });
    
    return ethers.utils.id(receiptData);
  }

  // Mint receipt as NFT
  async mintReceiptNFT(receipt, items) {
    if (!this.isAvailable()) {
      console.warn("Blockchain not available. Using mock mint.");
      return this.mockMintReceipt(receipt, items);
    }
    
    try {
      // Create IPFS-style URI for the receipt data
      const uri = `ipfs://QmHash/${Date.now()}`;
      
      // Create receipt hash
      const receiptHash = this.createReceiptHash(receipt);
      
      // Call mint function on the contract
      const tx = await this.contract.mint(this.wallet.address, uri, receiptHash);
      const txReceipt = await tx.wait();
      
      // Get the token ID from the event
      const event = txReceipt.events.find(e => e.event === "ReceiptMinted");
      const tokenId = event ? event.args.tokenId.toNumber() : this.tokenIdCounter++;
      
      return {
        success: true,
        tokenId,
        transactionHash: tx.hash,
        blockNumber: txReceipt.blockNumber,
        network: (await this.provider.getNetwork()).name,
        mockMode: false
      };
    } catch (error) {
      console.error("Error minting receipt NFT:", error);
      // Fall back to mock mint on error
      return this.mockMintReceipt(receipt, items);
    }
  }

  // Mock mint for testing
  mockMintReceipt(receipt, items) {
    const tokenId = this.tokenIdCounter++;
    const receiptHash = this.createReceiptHash(receipt);
    
    return {
      success: true,
      tokenId,
      transactionHash: "0x" + crypto.randomBytes(32).toString('hex'),
      blockNumber: Math.floor(Math.random() * 10000000),
      network: "mock-mumbai",
      mockMode: true
    };
  }

  // Verify receipt on blockchain
  async verifyReceipt(tokenId, receipt) {
    if (!this.isAvailable()) {
      console.warn("Blockchain not available. Using mock verification.");
      return this.mockVerifyReceipt(tokenId, receipt);
    }
    
    try {
      const receiptHash = this.createReceiptHash(receipt);
      const verified = await this.contract.verifyReceipt(tokenId, receiptHash);
      const uri = await this.contract.uri(tokenId);
      const storedHash = await this.contract.getReceiptHash(tokenId);
      const owner = await this.contract.getReceiptOwner(tokenId);
      
      return {
        success: true,
        verified,
        tokenId,
        uri,
        receiptHash: ethers.utils.hexlify(receiptHash),
        storedHash: ethers.utils.hexlify(storedHash),
        owner,
        mockMode: false
      };
    } catch (error) {
      console.error("Error verifying receipt:", error);
      return this.mockVerifyReceipt(tokenId, receipt);
    }
  }

  // Mock verify for testing
  mockVerifyReceipt(tokenId, receipt) {
    const receiptHash = this.createReceiptHash(receipt);
    
    return {
      success: true,
      verified: true,
      tokenId,
      uri: `ipfs://QmHash/${tokenId}`,
      receiptHash: ethers.utils.hexlify(receiptHash),
      storedHash: ethers.utils.hexlify(receiptHash),
      owner: this.wallet ? this.wallet.address : "0x" + crypto.randomBytes(20).toString('hex'),
      mockMode: true
    };
  }

  // Get network information
  async getNetworkInfo() {
    if (!this.isAvailable()) {
      return {
        available: false,
        network: "unavailable",
        chainId: 0,
        contractAddress: null,
        walletAddress: null,
        mockMode: true
      };
    }
    
    try {
      const network = await this.provider.getNetwork();
      return {
        available: true,
        network: network.name,
        chainId: network.chainId,
        contractAddress: this.contract.address,
        walletAddress: this.wallet.address,
        mockMode: false
      };
    } catch (error) {
      console.error("Error getting network status:", error);
      return {
        available: false,
        network: "error",
        chainId: 0,
        contractAddress: null,
        walletAddress: null,
        error: error.message,
        mockMode: true
      };
    }
  }
}

// Create singleton instance
export const blockchainService = new BlockchainService();