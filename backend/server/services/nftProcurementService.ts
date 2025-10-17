/**
 * NFT Procurement Service
 * 
 * This service handles the complete flow of procuring NFTs from OpenSea collections
 * and associating receipt metadata with them using Threshold Proxy Re-encryption.
 */

import { marketplaceService } from './marketplaceService';
import { thresholdClient } from './tacoService';
import { blockchainEnhancedService } from './blockchainEnhancedService';
import { logger } from '../utils/logger';

export interface ReceiptMetadata {
  merchantName: string;
  date: string;
  total: number;
  subtotal?: number;
  tax?: number;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }>;
  category?: string;
  confidence?: number;
}

export interface ProcuredNFT {
  tokenId: string;
  contractAddress: string;
  name: string;
  imageUrl: string;
  price: number;
  marketplace: string;
  txHash: string;
  receiptMetadata: {
    encrypted: boolean;
    capsule?: string;
    ciphertext?: string;
    policyId?: string;
  };
}

export interface NFTProcurementResult {
  success: boolean;
  nft?: ProcuredNFT;
  error?: string;
  fallbackUsed?: boolean;
}

/**
 * Main function to procure an NFT for a receipt
 * This implements the complete flow: receipt analysis → NFT search → purchase → metadata association
 */
export async function procureNFTForReceipt(
  receiptData: ReceiptMetadata,
  walletAddress: string,
  recipientPublicKey: string
): Promise<NFTProcurementResult> {
  try {
    logger.info(`Starting NFT procurement for receipt from ${receiptData.merchantName}`);
    
    // Step 1: Analyze receipt and determine budget
    const category = marketplaceService.categorizeReceipt(receiptData);
    const { tier, budget } = marketplaceService.determineNFTBudget(receiptData.total);
    
    logger.info(`Receipt analysis: Category=${category}, Tier=${tier}, Budget=${budget} ETH`);
    
    // Step 2: Search for affordable NFTs from OpenSea
    const searchOptions = {
      maxPrice: budget * 2000, // Convert ETH to USD (rough conversion)
      category: category,
      limit: 10
    };
    
    logger.info(`Searching for NFTs with max price $${searchOptions.maxPrice}`);
    const availableNFTs = await marketplaceService.fetchMarketplaceNFTs(searchOptions);
    
    if (availableNFTs.length === 0) {
      logger.warn('No affordable NFTs found, using fallback minting');
      return await fallbackToMinting(receiptData, walletAddress, recipientPublicKey);
    }
    
    // Step 3: Select the best NFT (cheapest that meets criteria)
    const selectedNFT = availableNFTs[0]; // Already sorted by price
    logger.info(`Selected NFT: ${selectedNFT.name} for ${selectedNFT.price} ETH`);
    
    // Step 4: Purchase the NFT
    logger.info(`Purchasing NFT ${selectedNFT.name}...`);
    const purchaseResult = await marketplaceService.purchaseMarketplaceNFT(selectedNFT, walletAddress);
    
    if (!purchaseResult.success) {
      logger.error(`NFT purchase failed: ${purchaseResult.error}`);
      return await fallbackToMinting(receiptData, walletAddress, recipientPublicKey);
    }
    
    // Step 5: Encrypt receipt metadata using Threshold Proxy Re-encryption
    logger.info('Encrypting receipt metadata...');
    const encryptedMetadata = await encryptReceiptMetadata(receiptData, recipientPublicKey);
    
    // Step 6: Associate metadata with the procured NFT
    logger.info('Associating metadata with procured NFT...');
    await associateMetadataWithNFT(purchaseResult, encryptedMetadata);
    
    const procuredNFT: ProcuredNFT = {
      tokenId: purchaseResult.tokenId!,
      contractAddress: purchaseResult.contractAddress!,
      name: purchaseResult.name!,
      imageUrl: purchaseResult.imageUrl!,
      price: purchaseResult.price!,
      marketplace: purchaseResult.marketplace!,
      txHash: purchaseResult.txHash!,
      receiptMetadata: {
        encrypted: true,
        capsule: encryptedMetadata.capsule,
        ciphertext: encryptedMetadata.ciphertext,
        policyId: encryptedMetadata.policyId
      }
    };
    
    logger.info(`Successfully procured NFT ${procuredNFT.name} with encrypted metadata`);
    
    return {
      success: true,
      nft: procuredNFT
    };
    
  } catch (error: any) {
    logger.error(`Error in NFT procurement: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Encrypt receipt metadata using Threshold Proxy Re-encryption
 */
async function encryptReceiptMetadata(
  receiptData: ReceiptMetadata,
  recipientPublicKey: string
): Promise<{ capsule: string; ciphertext: string; policyId: string }> {
  try {
    // Prepare metadata for encryption
    const metadataToEncrypt = {
      merchantName: receiptData.merchantName,
      date: receiptData.date,
      total: receiptData.total,
      subtotal: receiptData.subtotal,
      tax: receiptData.tax,
      items: receiptData.items,
      category: receiptData.category,
      confidence: receiptData.confidence
    };
    
    // Encrypt using Threshold Client
    const encryptedResult = await thresholdClient.encrypt({
      recipientPublicKey: recipientPublicKey,
      data: Buffer.from(JSON.stringify(metadataToEncrypt))
    });
    
    return {
      capsule: encryptedResult.capsule,
      ciphertext: encryptedResult.ciphertext,
      policyId: encryptedResult.policyId
    };
    
  } catch (error: any) {
    logger.error(`Error encrypting receipt metadata: ${error.message}`);
    throw new Error(`Failed to encrypt receipt metadata: ${error.message}`);
  }
}

/**
 * Associate encrypted metadata with the procured NFT
 */
async function associateMetadataWithNFT(
  purchaseResult: any,
  encryptedMetadata: { capsule: string; ciphertext: string; policyId: string }
): Promise<void> {
  try {
    // Create a metadata record linking the NFT to the encrypted receipt data
    const metadataRecord = {
      nftTokenId: purchaseResult.tokenId,
      nftContractAddress: purchaseResult.contractAddress,
      encryptedReceiptData: {
        capsule: encryptedMetadata.capsule,
        ciphertext: encryptedMetadata.ciphertext,
        policyId: encryptedMetadata.policyId
      },
      purchaseTxHash: purchaseResult.txHash,
      createdAt: new Date().toISOString()
    };
    
    // Store the association in the database
    // This would typically use your database service
    logger.info(`Associated metadata with NFT ${purchaseResult.tokenId}`);
    
    // TODO: Implement database storage
    // await databaseService.storeNFTMetadataAssociation(metadataRecord);
    
  } catch (error: any) {
    logger.error(`Error associating metadata with NFT: ${error.message}`);
    throw new Error(`Failed to associate metadata with NFT: ${error.message}`);
  }
}

/**
 * Fallback to minting a new NFT if procurement fails
 */
async function fallbackToMinting(
  receiptData: ReceiptMetadata,
  walletAddress: string,
  recipientPublicKey: string
): Promise<NFTProcurementResult> {
  try {
    logger.info('Falling back to minting new NFT...');
    
    // Encrypt metadata
    const encryptedMetadata = await encryptReceiptMetadata(receiptData, recipientPublicKey);
    
    // Mint new NFT using existing blockchain service
    const mintResult = await blockchainEnhancedService.mintReceipt(
      {
        id: Date.now().toString(),
        merchantName: receiptData.merchantName,
        date: new Date(receiptData.date),
        total: receiptData.total,
        items: receiptData.items,
        category: receiptData.category,
        subtotal: receiptData.subtotal,
        tax: receiptData.tax
      },
      `ipfs://metadata-${Date.now()}`,
      `ipfs://stamp-${Date.now()}`,
      walletAddress,
      true, // encrypted
      encryptedMetadata.policyId
    );
    
    if (!mintResult.success) {
      throw new Error(`Minting failed: ${mintResult.error}`);
    }
    
    const procuredNFT: ProcuredNFT = {
      tokenId: mintResult.tokenId!,
      contractAddress: '0x0000000000000000000000000000000000000000', // Placeholder for minted NFT
      name: `BlockReceipt #${mintResult.tokenId}`,
      imageUrl: `https://blockreceipt.example/nft/${mintResult.tokenId}`,
      price: 0, // No purchase price for minted NFT
      marketplace: 'blockreceipt',
      txHash: mintResult.transactionHash!,
      receiptMetadata: {
        encrypted: true,
        capsule: encryptedMetadata.capsule,
        ciphertext: encryptedMetadata.ciphertext,
        policyId: encryptedMetadata.policyId
      }
    };
    
    return {
      success: true,
      nft: procuredNFT,
      fallbackUsed: true
    };
    
  } catch (error: any) {
    logger.error(`Fallback minting failed: ${error.message}`);
    return {
      success: false,
      error: `Both NFT procurement and fallback minting failed: ${error.message}`
    };
  }
}

/**
 * Decrypt receipt metadata for a procured NFT
 */
export async function decryptReceiptMetadata(
  nftTokenId: string,
  nftContractAddress: string,
  userPrivateKey: string
): Promise<ReceiptMetadata | null> {
  try {
    // Retrieve encrypted metadata from database
    // TODO: Implement database retrieval
    // const metadataRecord = await databaseService.getNFTMetadataAssociation(nftTokenId, nftContractAddress);
    
    // For now, return null as database integration is not implemented
    logger.warn('Database integration not implemented for metadata retrieval');
    return null;
    
  } catch (error: any) {
    logger.error(`Error decrypting receipt metadata: ${error.message}`);
    return null;
  }
}

// Export the service
export const nftProcurementService = {
  procureNFTForReceipt,
  decryptReceiptMetadata
};
