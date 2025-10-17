import { ethers } from 'ethers';
import { thresholdClient } from './tacoService';
import { logger } from '../utils/logger';

export interface EncryptedPayload {
  cipherText: string;
  capsule: string;
  receiptHash: string;
}

export interface DecryptedReceipt {
  receiptData: any;
  metadata: {
    encryptedAt: string;
    owner: string;
    tokenId: string;
  };
}

class PREEncryptionService {
  private provider: ethers.providers.Provider;
  private contractAddress: string;
  private contract: ethers.Contract | null = null;

  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(process.env.POLYGON_RPC_URL);
    this.contractAddress = process.env.ENHANCED_CONTRACT_ADDRESS || process.env.CONTRACT_ADDRESS || '';
    
    if (this.contractAddress) {
      // Enhanced contract ABI with PRE methods
      const abi = [
        "function mintEncrypted(address to, uint256 id, uint256 amount, bytes calldata data, bytes32 receiptHash, string calldata uri_) external",
        "function grantAccess(uint256 id, address delegatee) external",
        "function revokeAccess(uint256 id, address delegatee) external",
        "function getEncryptedReceipt(uint256 tokenId) external view returns (bytes memory)",
        "function getReCapsule(uint256 tokenId, address user) external view returns (bytes memory)",
        "function hasAccess(uint256 tokenId, address user) external view returns (bool)"
      ];
      
      this.contract = new ethers.Contract(this.contractAddress, abi, this.provider);
    }
  }

  /**
   * Encrypt receipt data using TACo PRE
   */
  async encryptReceiptData(receiptData: any, ownerPublicKey: string): Promise<EncryptedPayload> {
    try {
      const receiptJson = JSON.stringify(receiptData);
      
      // Use existing TACo integration for encryption
      const encryptedData = await thresholdClient.encrypt(receiptJson);
      
      // Generate receipt hash for verification
      const receiptHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(receiptJson));
      
      return {
        cipherText: encryptedData.ciphertext, // Fix property name
        capsule: encryptedData.capsule,
        receiptHash
      };
    } catch (error) {
      logger.error('Failed to encrypt receipt data:', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Mint encrypted NFT with PRE protection
   */
  async mintEncryptedNFT(
    to: string,
    tokenId: number,
    encryptedPayload: EncryptedPayload,
    metadataUri: string,
    signerPrivateKey: string
  ): Promise<string> {
    try {
      const wallet = new ethers.Wallet(signerPrivateKey, this.provider);
      const contractWithSigner = this.contract.connect(wallet);

      // Encode the encrypted data and capsule
      const encodedData = ethers.utils.defaultAbiCoder.encode(
        ['bytes', 'bytes'],
        [encryptedPayload.cipherText, encryptedPayload.capsule]
      );

      const tx = await contractWithSigner.mintEncrypted(
        to,
        tokenId,
        1, // amount
        encodedData,
        encryptedPayload.receiptHash,
        metadataUri
      );

      await tx.wait();
      logger.info(`Encrypted NFT minted: tokenId=${tokenId}, tx=${tx.hash}`);
      
      return tx.hash;
    } catch (error) {
      logger.error('Failed to mint encrypted NFT:', error);
      throw new Error('Minting failed');
    }
  }

  /**
   * Grant access to encrypted receipt
   */
  async grantAccess(tokenId: number, delegateeAddress: string, signerPrivateKey: string): Promise<string> {
    try {
      const wallet = new ethers.Wallet(signerPrivateKey, this.provider);
      const contractWithSigner = this.contract.connect(wallet);

      const tx = await contractWithSigner.grantAccess(tokenId, delegateeAddress);
      await tx.wait();
      
      logger.info(`Access granted: tokenId=${tokenId}, delegatee=${delegateeAddress}`);
      return tx.hash;
    } catch (error) {
      logger.error('Failed to grant access:', error);
      throw new Error('Access grant failed');
    }
  }

  /**
   * Revoke access to encrypted receipt
   */
  async revokeAccess(tokenId: number, delegateeAddress: string, signerPrivateKey: string): Promise<string> {
    try {
      const wallet = new ethers.Wallet(signerPrivateKey, this.provider);
      const contractWithSigner = this.contract.connect(wallet);

      const tx = await contractWithSigner.revokeAccess(tokenId, delegateeAddress);
      await tx.wait();
      
      logger.info(`Access revoked: tokenId=${tokenId}, delegatee=${delegateeAddress}`);
      return tx.hash;
    } catch (error) {
      logger.error('Failed to revoke access:', error);
      throw new Error('Access revocation failed');
    }
  }

  /**
   * Decrypt receipt data for authorized user
   */
  async decryptReceiptData(tokenId: number, userAddress: string, userPrivateKey: string): Promise<DecryptedReceipt> {
    try {
      // Check if user has access
      const hasAccess = await this.contract.hasAccess(tokenId, userAddress);
      if (!hasAccess) {
        throw new Error('User does not have access to this receipt');
      }

      // Get encrypted data and re-capsule
      const encryptedData = await this.contract.getEncryptedReceipt(tokenId);
      const reCapsule = await this.contract.getReCapsule(tokenId, userAddress);

      if (!encryptedData || !reCapsule) {
        throw new Error('No encrypted data or re-capsule found');
      }

      // Use TACo to decrypt
      const decryptedJson = await thresholdClient.decrypt(encryptedData, reCapsule, userPrivateKey);
      const receiptData = JSON.parse(decryptedJson);

      return {
        receiptData,
        metadata: {
          encryptedAt: new Date().toISOString(),
          owner: userAddress,
          tokenId: tokenId.toString()
        }
      };
    } catch (error) {
      logger.error('Failed to decrypt receipt data:', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Check if user has access to encrypted receipt
   */
  async checkAccess(tokenId: number, userAddress: string): Promise<boolean> {
    try {
      return await this.contract.hasAccess(tokenId, userAddress);
    } catch (error) {
      logger.error('Failed to check access:', error);
      return false;
    }
  }
}

export const preEncryptionService = new PREEncryptionService();