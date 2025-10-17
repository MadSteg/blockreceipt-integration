import { Storage } from '@google-cloud/storage';

class GoogleCloudStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    if (!process.env.GOOGLE_CLOUD_CREDENTIALS || !process.env.GOOGLE_CLOUD_BUCKET_NAME) {
      throw new Error('Google Cloud Storage credentials or bucket name not configured');
    }

    // Parse the credentials from environment variable
    const credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
    
    this.storage = new Storage({
      credentials,
      projectId: credentials.project_id,
    });
    
    this.bucketName = 'blockreceipt'; // Use your actual bucket name
  }

  /**
   * List all NFT images in the bucket
   */
  async listNFTImages(): Promise<string[]> {
    try {
      const [files] = await this.storage.bucket(this.bucketName).getFiles();

      // Filter for image files and return their names
      return files
        .filter(file => {
          const name = file.name.toLowerCase();
          return name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.gif');
        })
        .map(file => file.name);
    } catch (error) {
      console.error('Error listing NFT images:', error);
      return [];
    }
  }

  /**
   * Get a public URL for an image in the bucket
   */
  getPublicUrl(fileName: string): string {
    // Generate a proper public URL for Google Cloud Storage
    return `https://storage.cloud.google.com/${this.bucketName}/${encodeURIComponent(fileName)}`;
  }

  /**
   * Make a file publicly accessible
   */
  async makeFilePublic(fileName: string): Promise<void> {
    try {
      const file = this.storage.bucket(this.bucketName).file(fileName);
      await file.makePublic();
      console.log(`Made ${fileName} publicly accessible`);
    } catch (error) {
      console.error(`Error making ${fileName} public:`, error);
    }
  }

  /**
   * Get a signed URL for private images (if bucket is not public)
   */
  async getSignedUrl(fileName: string): Promise<string> {
    try {
      const file = this.storage.bucket(this.bucketName).file(fileName);
      const [url] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      });
      return url;
    } catch (error) {
      console.error('Error generating signed URL:', error);
      return this.getPublicUrl(fileName); // Fallback to public URL
    }
  }

  /**
   * Get all NFT images with their accessible URLs
   */
  async getNFTImagesWithUrls(): Promise<Array<{ fileName: string; url: string }>> {
    try {
      const imageFileNames = await this.listNFTImages();
      const imagesWithUrls = await Promise.all(
        imageFileNames.map(async fileName => {
          // Try to make file public first
          await this.makeFilePublic(fileName);
          
          // Return public URL for better compatibility
          return {
            fileName,
            url: this.getPublicUrl(fileName)
          };
        })
      );
      return imagesWithUrls;
    } catch (error) {
      console.error('Error getting NFT images with URLs:', error);
      return [];
    }
  }

  /**
   * Check if bucket exists and is accessible
   */
  async testConnection(): Promise<boolean> {
    try {
      const [exists] = await this.storage.bucket(this.bucketName).exists();
      return exists;
    } catch (error) {
      console.error('Error testing Google Cloud Storage connection:', error);
      return false;
    }
  }
}

export const googleCloudStorageService = new GoogleCloudStorageService();