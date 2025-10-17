const { Storage } = require('@google-cloud/storage');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger').logger;

/**
 * Google Cloud Storage Service
 * 
 * This service handles interactions with Google Cloud Storage for storing
 * and retrieving images and other files.
 */
class GoogleStorageService {
  constructor() {
    this.initialized = false;
    
    try {
      // Check if we have the required environment variables
      const credentials = process.env.GOOGLE_CLOUD_CREDENTIALS;
      // Override with the correct bucket name
      this.bucketName = "blockreceipt";
      
      if (!credentials) {
        logger.warn('[google-storage] Missing Google Cloud Storage credentials');
        return;
      }
      
      // Initialize Google Cloud Storage client
      this.storage = new Storage({
        credentials: JSON.parse(credentials)
      });
      
      this.initialized = true;
      logger.info(`[google-storage] Google Storage service initialized with bucket: ${this.bucketName}`);
    } catch (error) {
      logger.error('[google-storage] Failed to initialize Google Storage service:', error);
    }
  }

  /**
   * Check if the service is properly initialized
   */
  isInitialized() {
    return this.initialized;
  }

  /**
   * Get the public URL for a file
   * @param {string} fileName - The name of the file in the bucket
   * @returns {string} The public URL for the file
   */
  getPublicUrl(fileName) {
    return `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
  }

  /**
   * Generate a signed URL for a file with read access
   * @param {string} fileName - The name of the file in the bucket
   * @param {number} expiresIn - How long (in minutes) the signed URL should be valid (default: 15 minutes)
   * @returns {Promise<string>} A promise resolving to the signed URL
   */
  async getSignedUrl(fileName, expiresIn = 15) {
    if (!this.initialized) {
      throw new Error('Google Storage service not initialized');
    }

    try {
      const options = {
        version: 'v4',
        action: 'read',
        expires: Date.now() + expiresIn * 60 * 1000, // Convert minutes to milliseconds
      };

      const [url] = await this.storage
        .bucket(this.bucketName)
        .file(fileName)
        .getSignedUrl(options);

      return url;
    } catch (error) {
      logger.error(`[google-storage] Error generating signed URL for ${fileName}:`, error);
      throw new Error(`Failed to generate signed URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Upload a file to Google Cloud Storage
   * @param {Buffer} fileBuffer - The file buffer to upload
   * @param {string} originalFileName - The original name of the file
   * @param {string} folderPath - Optional folder path in the bucket (e.g., 'receipts/')
   * @returns {Promise<Object>} A promise resolving to the uploaded file details
   */
  async uploadFile(fileBuffer, originalFileName, folderPath = '') {
    if (!this.initialized) {
      throw new Error('Google Storage service not initialized');
    }

    try {
      // Generate a unique filename to avoid collisions
      const extension = originalFileName.split('.').pop() || 'png';
      const fileName = `${folderPath}${uuidv4()}.${extension}`;
      
      const file = this.storage.bucket(this.bucketName).file(fileName);
      
      // Upload the file to Google Cloud Storage
      await file.save(fileBuffer, {
        metadata: {
          contentType: `image/${extension}`,
        },
        resumable: false,
      });
      
      // Make the file publicly accessible
      await file.makePublic();
      
      const publicUrl = this.getPublicUrl(fileName);
      
      logger.info(`[google-storage] File uploaded successfully: ${fileName}`);
      return { fileName, publicUrl };
    } catch (error) {
      logger.error('[google-storage] Error uploading file:', error);
      throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * List files in a folder in the bucket
   * @param {string} folderPath - The folder path to list files from (e.g., 'receipts/')
   * @returns {Promise<Array<string>>} A promise resolving to an array of file names
   */
  async listFiles(folderPath) {
    if (!this.initialized) {
      throw new Error('Google Storage service not initialized');
    }

    try {
      const [files] = await this.storage.bucket(this.bucketName).getFiles({
        prefix: folderPath,
      });
      
      return files.map(file => file.name);
    } catch (error) {
      logger.error(`[google-storage] Error listing files in ${folderPath}:`, error);
      throw new Error(`Failed to list files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * List all files in the bucket with their details
   * @returns {Promise<Array<Object>>} A promise resolving to an array of file details
   */
  async listAllFiles() {
    if (!this.initialized) {
      throw new Error('Google Storage service not initialized');
    }

    try {
      const [files] = await this.storage.bucket(this.bucketName).getFiles();
      
      const fileDetails = await Promise.all(files.map(async (file) => {
        const [metadata] = await file.getMetadata();
        return {
          name: file.name,
          url: this.getPublicUrl(file.name),
          size: metadata.size ? parseInt(metadata.size) : undefined,
          contentType: metadata.contentType,
          updated: metadata.updated
        };
      }));
      
      return fileDetails;
    } catch (error) {
      logger.error('[google-storage] Error listing all files:', error);
      return []; // Return empty array on error
    }
  }

  /**
   * Check if a file exists in the bucket
   * @param {string} fileName - The name of the file to check
   * @returns {Promise<boolean>} A promise resolving to a boolean indicating if the file exists
   */
  async fileExists(fileName) {
    if (!this.initialized) {
      throw new Error('Google Storage service not initialized');
    }

    try {
      const [exists] = await this.storage
        .bucket(this.bucketName)
        .file(fileName)
        .exists();
      
      return exists;
    } catch (error) {
      logger.error(`[google-storage] Error checking if file exists: ${fileName}`, error);
      throw new Error(`Failed to check if file exists: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a file from the bucket
   * @param {string} fileName - The name of the file to delete
   * @returns {Promise<void>} A promise that resolves when the file is deleted
   */
  async deleteFile(fileName) {
    if (!this.initialized) {
      throw new Error('Google Storage service not initialized');
    }

    try {
      await this.storage
        .bucket(this.bucketName)
        .file(fileName)
        .delete();
      
      logger.info(`[google-storage] File deleted successfully: ${fileName}`);
    } catch (error) {
      logger.error(`[google-storage] Error deleting file: ${fileName}`, error);
      throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * List NFT images from a specific folder
   * @param {string} folderPath - The folder path to list NFT images from (default: 'bulldogs/')
   * @returns {Promise<Array<Object>>} A promise resolving to an array of NFT image details
   */
  async listNftImages(folderPath = 'bulldogs/') {
    try {
      const fileNames = await this.listFiles(folderPath);
      
      // Generate details for each file
      const imagePromises = fileNames.map(async (fileName) => {
        // Extract a simple ID from the filename (remove folder path and extension)
        const id = fileName.replace(folderPath, '').split('.')[0];
        const url = this.getPublicUrl(fileName);
        
        return {
          fileName,
          id,
          url
        };
      });
      
      return Promise.all(imagePromises);
    } catch (error) {
      logger.error(`[google-storage] Error listing NFT images in ${folderPath}:`, error);
      return []; // Return empty array on error
    }
  }
}

// Export a singleton instance
const googleStorageService = new GoogleStorageService();

module.exports = { googleStorageService };