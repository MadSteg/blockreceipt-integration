import { nftRepository } from '../repositories/nftRepository';
import { blockchainService } from './blockchainService';
import { thresholdClient, decryptData } from './tacoService';

/**
 * Service for the NFT Gallery
 * Combines data from blockchain and local database
 */
export class GalleryService {
  /**
   * Get all NFTs for a wallet address with metadata
   * @param walletAddress The wallet address to fetch NFTs for
   * @returns Array of NFTs with their metadata status
   */
  async getNFTsForWallet(walletAddress: string) {
    try {
      // First, get any NFTs tracked in our local database
      const localNFTs = await nftRepository.getMetadataByOwner(walletAddress);
      
      // Next, try to get NFTs from the blockchain
      let chainNFTs: any[] = [];
      try {
        // This will throw if the method doesn't exist yet
        chainNFTs = await blockchainService.getNFTsForWallet(walletAddress);
      } catch (error) {
        console.warn('Failed to fetch NFTs from blockchain', error);
        // Continue with local NFTs only
      }
      
      // Merge the lists, with blockchain data taking precedence
      const nftMap = new Map();
      
      // Add local NFTs to the map
      localNFTs.forEach(nft => {
        nftMap.set(nft.tokenId, {
          tokenId: nft.tokenId,
          imageUrl: `/api/nfts/image/${nft.tokenId}`,
          isLocked: true, // Assume locked until explicitly unlocked
          hasMetadata: true,
          ownerAddress: nft.ownerAddress,
          preview: nft.unencryptedPreview,
          createdAt: nft.createdAt
        });
      });
      
      // Merge in blockchain NFTs
      chainNFTs.forEach(nft => {
        const existing = nftMap.get(nft.tokenId);
        if (existing) {
          // Update existing entry with blockchain data
          nftMap.set(nft.tokenId, {
            ...existing,
            ...nft,
            // Keep the metadata status from local DB
            hasMetadata: existing.hasMetadata
          });
        } else {
          // New blockchain NFT
          nftMap.set(nft.tokenId, {
            ...nft,
            isLocked: true,
            hasMetadata: false
          });
        }
      });
      
      // Convert map to array
      return Array.from(nftMap.values());
    } catch (error) {
      console.error('Error fetching NFTs for wallet:', error);
      return [];
    }
  }
  
  /**
   * Unlock encrypted metadata for an NFT
   * @param tokenId The NFT token ID
   * @param walletAddress The wallet address requesting decryption
   * @returns The decrypted metadata or null if not authorized
   */
  async unlockNFTMetadata(tokenId: string, walletAddress: string) {
    try {
      // First verify ownership
      let ownershipVerified = false;
      
      try {
        // This will throw if the method doesn't exist yet
        ownershipVerified = await blockchainService.verifyNFTOwnership(tokenId, walletAddress);
      } catch (error) {
        console.warn('Failed to verify NFT ownership on blockchain', error);
        // Fall back to database ownership check
        const metadata = await nftRepository.getMetadataByTokenId(tokenId);
        if (metadata && metadata.ownerAddress.toLowerCase() === walletAddress.toLowerCase()) {
          ownershipVerified = true;
        }
      }
      
      if (!ownershipVerified) {
        console.warn(`Unauthorized metadata unlock attempt for token ${tokenId} by ${walletAddress}`);
        return null;
      }
      
      // Get the encrypted metadata
      const metadata = await nftRepository.getMetadataByTokenId(tokenId);
      if (!metadata) {
        console.warn(`No metadata found for token ${tokenId}`);
        return null;
      }
      
      // Get the encrypted user data from the metadata
      // With our dual metadata structure, the user data is stored separately from promotional data
      const userData = metadata.userData;
      
      // Attempt to decrypt using TaCo service
      try {
        // Check if we have userData in the expected format
        if (userData && typeof userData === 'object' && userData.ciphertext) {
          // Using our new thresholdClient implementation with userData
          const decryptedData = await decryptData({
            encryptedData: userData,
            recipientPublicKey: walletAddress
          });
          return decryptedData;
        } else {
          // For our updated dual metadata structure
          // Assuming metadata.userData contains the encrypted user data
          if (metadata.userData) {
            const decryptedData = await decryptData({
              encryptedData: metadata.userData,
              recipientPublicKey: walletAddress
            });
            return decryptedData;
          } else {
            // Fall back to development mode mock data
            console.warn('No userData found for NFT with tokenId:', tokenId);
            return null;
          }
        }
      } catch (error) {
        console.error('Failed to decrypt metadata:', error);
        
        // For testing/development only - return mock data
        if (process.env.NODE_ENV === 'development') {
          console.log('Using mock decrypted data for development');
          return {
            items: [
              { name: "Mock Product", price: 19.99, quantity: 1, category: "Test" },
              { name: "Mock Service", price: 9.99, quantity: 1, category: "Test" }
            ],
            subtotal: 29.98,
            tax: 2.40,
            total: 32.38,
            date: new Date().toISOString().split('T')[0],
            merchant: "Mock Store",
            receiptId: tokenId
          };
        }
        
        return null;
      }
    } catch (error) {
      console.error('Error unlocking NFT metadata:', error);
      return null;
    }
  }
}

export const galleryService = new GalleryService();