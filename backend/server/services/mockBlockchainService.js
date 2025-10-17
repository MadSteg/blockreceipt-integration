// Mock Blockchain Service - CommonJS module 
// This avoids ESM/CommonJS conflicts by implementing a mock service
// that can be used until the real contract is deployed

const crypto = require('crypto');

class MockBlockchainService {
  constructor() {
    this.tokenIdCounter = 1000;
    this.mockContracts = {
      Receipt1155: {
        address: '0x' + '1'.repeat(40)
      }
    };
    this.mockWallet = {
      address: '0x' + '2'.repeat(40)
    };
    this.mockProvider = {
      network: {
        name: 'mumbai-mock',
        chainId: 80001
      }
    };
  }

  // Create receipt hash
  createReceiptHash(receipt) {
    // Create a deterministic hash of the receipt data
    const receiptData = JSON.stringify({
      merchant: receipt.merchant.name,
      date: receipt.date,
      total: receipt.total,
      items: receipt.items?.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity
      }))
    });
    
    return '0x' + crypto.createHash('sha256').update(receiptData).digest('hex');
  }

  // Mock mint a receipt
  async mintReceipt(receipt) {
    const tokenId = this.tokenIdCounter++;
    const txHash = '0x' + crypto.randomBytes(32).toString('hex');
    const blockNumber = Math.floor(Math.random() * 1000000) + 15000000;
    const receiptHash = this.createReceiptHash(receipt);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      tokenId,
      transactionHash: txHash,
      blockNumber,
      network: this.mockProvider.network.name,
      receiptHash,
      mockMode: true
    };
  }

  // Mock verify a receipt
  async verifyReceipt(tokenId, receipt) {
    const receiptHash = this.createReceiptHash(receipt);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      success: true,
      verified: true, // Always verified in mock mode
      tokenId,
      uri: `ipfs://QmHash/${tokenId}`,
      receiptHash,
      storedHash: receiptHash, // Same hash in mock mode
      owner: this.mockWallet.address,
      mockMode: true
    };
  }

  // Get mock network status
  async getNetworkStatus() {
    return {
      available: true,
      network: this.mockProvider.network.name,
      chainId: this.mockProvider.network.chainId,
      contractAddress: this.mockContracts.Receipt1155.address,
      walletAddress: this.mockWallet.address,
      mockMode: true
    };
  }
}

// Export the mock service
module.exports = new MockBlockchainService();