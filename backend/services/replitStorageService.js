const { Client } = require('@replit/object-storage');

class ReplitStorageService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.init();
  }

  async init() {
    try {
      this.client = new Client();
      this.isConnected = true;
      console.log('[replit-storage] Connected to Replit Object Storage successfully');
    } catch (error) {
      console.error('[replit-storage] Failed to connect:', error);
      this.isConnected = false;
    }
  }

  async listImages() {
    if (!this.isConnected || !this.client) {
      throw new Error('Replit Object Storage not connected');
    }

    try {
      const objects = await this.client.list();
      
      // Filter for image files (PNG, JPG, JPEG, GIF, etc.)
      const imageObjects = objects.filter(obj => {
        const name = obj.key.toLowerCase();
        return name.endsWith('.png') || 
               name.endsWith('.jpg') || 
               name.endsWith('.jpeg') || 
               name.endsWith('.gif') || 
               name.endsWith('.webp');
      });

      return imageObjects.map(obj => ({
        key: obj.key,
        name: obj.key.split('/').pop(), // Get filename without path
        size: obj.size,
        lastModified: obj.lastModified,
        url: this.getPublicUrl(obj.key)
      }));
    } catch (error) {
      console.error('[replit-storage] Error listing images:', error);
      throw error;
    }
  }

  getPublicUrl(key) {
    // Replit Object Storage public URL format
    return `https://storage.googleapis.com/replit/${process.env.REPL_SLUG}/${key}`;
  }

  async getImageBuffer(key) {
    if (!this.isConnected || !this.client) {
      throw new Error('Replit Object Storage not connected');
    }

    try {
      const buffer = await this.client.downloadAsBytes(key);
      return buffer;
    } catch (error) {
      console.error('[replit-storage] Error downloading image:', error);
      throw error;
    }
  }

  isInitialized() {
    return this.isConnected && this.client !== null;
  }
}

const replitStorageService = new ReplitStorageService();

module.exports = {
  replitStorageService
};