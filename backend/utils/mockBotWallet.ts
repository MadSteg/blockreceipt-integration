import { ethers } from 'ethers';
import { logger } from './logger';

/**
 * Mock wallet utility for testing NFT purchases in development
 * This simulates a bot wallet for automatic purchasing without using real funds
 */
class MockBotWallet {
  private wallet: ethers.Wallet;
  
  constructor() {
    // Create a deterministic wallet for consistent testing
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY || 
                       process.env.WALLET_PRIVATE_KEY || 
                       '0x' + '1'.repeat(64); // Mock private key if none available
    
    try {
      this.wallet = new ethers.Wallet(privateKey);
      logger.info(`Mock bot wallet initialized with address: ${this.wallet.address}`);
    } catch (error) {
      // If there's an error, create a deterministic wallet for testing
      const testMnemonic = 'test test test test test test test test test test test junk';
      this.wallet = ethers.Wallet.fromMnemonic(testMnemonic);
      logger.info(`Mock bot wallet initialized with test mnemonic: ${this.wallet.address}`);
    }
  }
  
  /**
   * Get the wallet address
   * @returns The wallet address
   */
  getAddress(): string {
    return this.wallet.address;
  }
  
  /**
   * Sign a message with the wallet
   * @param message The message to sign
   * @returns The signature
   */
  async signMessage(message: string): Promise<string> {
    return this.wallet.signMessage(message);
  }
  
  /**
   * Get the provider-connected wallet
   * @param provider The provider to connect to
   * @returns The wallet with provider
   */
  connectToProvider(provider: ethers.providers.Provider): ethers.Wallet {
    return this.wallet.connect(provider);
  }
}

export const mockBotWallet = new MockBotWallet();