import { supabase } from './supabase';

// Supabase Storage Configuration
const SUPABASE_STORAGE_URL = 'https://sxhderkbcdyvpvrumlko.storage.supabase.co/storage/v1/s3';
const SUPABASE_ACCESS_KEY = 'd62d2d86eb71644b9775ed4ee0055399';

// Storage Service for BlockReceipt
export class StorageService {
  // Upload receipt image to Supabase Storage
  static async uploadReceiptImage(file: File, userId: string): Promise<{url: string, error?: string}> {
    try {
      const fileName = `${userId}/${Date.now()}-receipt.jpg`;
      const { data, error } = await supabase.storage
        .from('receipt-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading receipt image:', error);
        return { url: '', error: error.message };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('receipt-images')
        .getPublicUrl(fileName);

      return { url: urlData.publicUrl };
    } catch (error: any) {
      console.error('Storage upload error:', error);
      return { url: '', error: error.message };
    }
  }

  // Upload NFT metadata to Supabase Storage
  static async uploadNFTMetadata(metadata: any, userId: string, receiptId: string): Promise<{url: string, error?: string}> {
    try {
      const fileName = `${userId}/nft-metadata/${receiptId}.json`;
      const metadataBlob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });
      
      const { data, error } = await supabase.storage
        .from('nft-metadata')
        .upload(fileName, metadataBlob, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading NFT metadata:', error);
        return { url: '', error: error.message };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('nft-metadata')
        .getPublicUrl(fileName);

      return { url: urlData.publicUrl };
    } catch (error: any) {
      console.error('NFT metadata upload error:', error);
      return { url: '', error: error.message };
    }
  }

  // Upload user avatar to Supabase Storage
  static async uploadUserAvatar(file: File, userId: string): Promise<{url: string, error?: string}> {
    try {
      const fileName = `${userId}/avatar-${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from('user-avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) {
        console.error('Error uploading user avatar:', error);
        return { url: '', error: error.message };
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('user-avatars')
        .getPublicUrl(fileName);

      return { url: urlData.publicUrl };
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      return { url: '', error: error.message };
    }
  }

  // Delete file from Supabase Storage
  static async deleteFile(bucket: string, path: string): Promise<{success: boolean, error?: string}> {
    try {
      const { error } = await supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        console.error('Error deleting file:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      console.error('File deletion error:', error);
      return { success: false, error: error.message };
    }
  }

  // Get file URL from Supabase Storage
  static getFileURL(bucket: string, path: string): string {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);
    
    return data.publicUrl;
  }

  // List files in a bucket
  static async listFiles(bucket: string, path?: string): Promise<{files: any[], error?: string}> {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .list(path || '', {
          limit: 100,
          offset: 0
        });

      if (error) {
        console.error('Error listing files:', error);
        return { files: [], error: error.message };
      }

      return { files: data || [] };
    } catch (error: any) {
      console.error('File listing error:', error);
      return { files: [], error: error.message };
    }
  }
}

// Storage bucket names
export const STORAGE_BUCKETS = {
  RECEIPT_IMAGES: 'receipt-images',
  NFT_METADATA: 'nft-metadata',
  USER_AVATARS: 'user-avatars',
  APP_ASSETS: 'app-assets'
} as const;

// Storage configuration
export const STORAGE_CONFIG = {
  SUPABASE_URL: SUPABASE_STORAGE_URL,
  ACCESS_KEY: SUPABASE_ACCESS_KEY,
  REGION: 'us-east-2',
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  ALLOWED_METADATA_TYPES: ['application/json']
} as const;
