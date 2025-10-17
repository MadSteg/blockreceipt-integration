import { db } from '../db';
import { 
  encryptedMetadata,
  InsertEncryptedMetadata,
  nftOwnership,
  InsertNftOwnership
} from '../../shared/schema';
import { eq } from 'drizzle-orm';

/**
 * Repository for handling NFT data and encrypted metadata
 */
class NFTRepository {
  /**
   * Store encrypted metadata for an NFT
   * @param metadataRecord The metadata record to store
   * @returns The stored metadata record
   */
  async storeEncryptedMetadata(metadataRecord: InsertEncryptedMetadata) {
    try {
      if (!db) throw new Error('Database not initialized');
      
      // Check if a record with this tokenId already exists
      const existingRecord = await this.getMetadataByTokenId(metadataRecord.tokenId);
      
      if (existingRecord) {
        // Update the existing record
        const [updated] = await db
          .update(encryptedMetadata)
          .set({
            encryptedData: metadataRecord.encryptedData,
            dataHash: metadataRecord.dataHash,
            ownerAddress: metadataRecord.ownerAddress,
            unencryptedPreview: metadataRecord.unencryptedPreview,
            updatedAt: new Date()
          })
          .where(eq(encryptedMetadata.tokenId, metadataRecord.tokenId))
          .returning();
        return updated;
      } else {
        // Insert a new record
        const [inserted] = await db
          .insert(encryptedMetadata)
          .values(metadataRecord)
          .returning();
        return inserted;
      }
    } catch (error: any) {
      console.error('NFT Repository - Error storing encrypted metadata:', error);
      throw error;
    }
  }
  
  /**
   * Get encrypted metadata for a token ID
   * @param tokenId The token ID
   * @returns The metadata record or null if not found
   */
  async getMetadataByTokenId(tokenId: string) {
    try {
      if (!db) throw new Error('Database not initialized');
      
      const [record] = await db
        .select()
        .from(encryptedMetadata)
        .where(eq(encryptedMetadata.tokenId, tokenId));
      
      return record || null;
    } catch (error: any) {
      console.error(`NFT Repository - Error getting metadata for token ${tokenId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all encrypted metadata for a wallet address
   * @param ownerAddress The wallet address
   * @returns Array of metadata records
   */
  async getMetadataByOwner(ownerAddress: string) {
    try {
      if (!db) throw new Error('Database not initialized');
      
      const records = await db
        .select()
        .from(encryptedMetadata)
        .where(eq(encryptedMetadata.ownerAddress, ownerAddress));
      
      return records;
    } catch (error: any) {
      console.error(`NFT Repository - Error getting metadata for wallet ${ownerAddress}:`, error);
      throw error;
    }
  }
  
  /**
   * Update the owner of an NFT's metadata
   * @param tokenId The token ID
   * @param newOwnerAddress The new owner's address
   * @returns The updated metadata record
   */
  async updateMetadataOwner(tokenId: string, newOwnerAddress: string) {
    try {
      if (!db) throw new Error('Database not initialized');
      
      const [updated] = await db
        .update(encryptedMetadata)
        .set({
          ownerAddress: newOwnerAddress,
          updatedAt: new Date()
        })
        .where(eq(encryptedMetadata.tokenId, tokenId))
        .returning();
      
      return updated;
    } catch (error: any) {
      console.error(`NFT Repository - Error updating owner for token ${tokenId}:`, error);
      throw error;
    }
  }
  
  /**
   * Record NFT ownership in the database
   * @param ownershipRecord The ownership record
   * @returns The stored ownership record
   */
  async recordNFTOwnership(ownershipRecord: InsertNftOwnership) {
    try {
      if (!db) throw new Error('Database not initialized');
      
      const [inserted] = await db
        .insert(nftOwnership)
        .values(ownershipRecord)
        .returning();
      
      return inserted;
    } catch (error: any) {
      console.error('NFT Repository - Error recording NFT ownership:', error);
      throw error;
    }
  }
}

export const nftRepository = new NFTRepository();