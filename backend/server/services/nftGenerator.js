const fs = require('fs-extra');
const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const { logger } = require('../utils/logger');
const { googleStorageService } = require('./googleStorageService');

/**
 * NFT Generator Service (Based on HashLips principles)
 * 
 * This service handles the generation of NFT collections with different
 * traits and layers, similar to HashLips NFT generator.
 */
class NFTGeneratorService {
  constructor() {
    this.initialized = false;
    this.tempDir = path.join(process.cwd(), 'temp');
    this.outputDir = path.join(process.cwd(), 'output');
    
    // Ensure temp and output directories exist
    this.initialize();
  }
  
  async initialize() {
    try {
      await fs.ensureDir(this.tempDir);
      await fs.ensureDir(this.outputDir);
      this.initialized = true;
      logger.info('[nft-generator] NFT Generator service initialized');
    } catch (error) {
      logger.error('[nft-generator] Failed to initialize NFT Generator service:', error);
    }
  }
  
  isInitialized() {
    return this.initialized;
  }
  
  /**
   * Generate a single NFT based on selected layers
   * @param {Object} options - Generation options
   * @param {string} options.name - Name of the NFT
   * @param {number} options.width - Canvas width
   * @param {number} options.height - Canvas height
   * @param {Array<Object>} options.layers - Array of layer objects with trait files
   * @param {Object} options.metadata - Additional metadata for the NFT
   * @returns {Promise<Object>} Generated NFT info including image and metadata
   */
  async generateSingleNFT(options) {
    if (!this.initialized) {
      throw new Error('NFT Generator service not initialized');
    }
    
    const { name, width = 1000, height = 1000, layers, metadata = {} } = options;
    
    if (!name) {
      throw new Error('NFT name is required');
    }
    
    if (!layers || !Array.isArray(layers) || layers.length === 0) {
      throw new Error('Layers are required for NFT generation');
    }
    
    try {
      // Create a canvas with the specified dimensions
      const canvas = createCanvas(width, height);
      const ctx = canvas.getContext('2d');
      
      // Clear the canvas
      ctx.clearRect(0, 0, width, height);
      
      // Sort layers by z-index (if provided)
      const sortedLayers = [...layers].sort((a, b) => {
        const zIndexA = a.zIndex || 0;
        const zIndexB = b.zIndex || 0;
        return zIndexA - zIndexB;
      });
      
      // Draw each layer onto the canvas
      for (const layer of sortedLayers) {
        if (layer.trait && layer.traitContent) {
          // If we have the image content directly (e.g., base64 or URL)
          if (layer.traitContent.startsWith('data:') || layer.traitContent.startsWith('http')) {
            const image = await loadImage(layer.traitContent);
            ctx.drawImage(image, 0, 0, width, height);
          } else {
            // Assume it's a file path
            const imagePath = layer.traitContent;
            try {
              const image = await loadImage(imagePath);
              ctx.drawImage(image, 0, 0, width, height);
            } catch (err) {
              logger.error(`[nft-generator] Error loading trait image: ${layer.trait}`, err);
            }
          }
        }
      }
      
      // Save the final image to temp directory
      const timestamp = Date.now();
      const fileName = `${name.replace(/\\s+/g, '-')}-${timestamp}.png`;
      const filePath = path.join(this.tempDir, fileName);
      
      // Convert canvas to buffer and save to file
      const buffer = canvas.toBuffer('image/png');
      await fs.writeFile(filePath, buffer);
      
      // Create metadata
      const nftMetadata = {
        name,
        description: metadata.description || `${name} NFT`,
        image: fileName, // Will be updated with cloud URL later
        attributes: [],
        ...metadata
      };
      
      // Add trait attributes to metadata
      layers.forEach(layer => {
        if (layer.trait) {
          nftMetadata.attributes.push({
            trait_type: layer.traitType || layer.trait,
            value: layer.traitName || layer.trait
          });
        }
      });
      
      // Save metadata to temp directory
      const metadataFileName = `${name.replace(/\\s+/g, '-')}-${timestamp}.json`;
      const metadataFilePath = path.join(this.tempDir, metadataFileName);
      await fs.writeJson(metadataFilePath, nftMetadata, { spaces: 2 });
      
      // Return the generated NFT info
      return {
        name,
        fileName,
        filePath,
        metadataFileName,
        metadataFilePath,
        metadata: nftMetadata
      };
    } catch (error) {
      logger.error('[nft-generator] Error generating NFT:', error);
      throw new Error(`Failed to generate NFT: ${error.message}`);
    }
  }
  
  /**
   * Generate a collection of NFTs
   * @param {Object} options - Collection generation options
   * @param {string} options.collectionName - Name of the collection
   * @param {number} options.width - Canvas width
   * @param {number} options.height - Canvas height
   * @param {number} options.count - Number of NFTs to generate
   * @param {Array<Object>} options.layerConfigurations - Configuration for different layers and traits
   * @param {Object} options.baseMetadata - Base metadata for all NFTs in the collection
   * @returns {Promise<Array<Object>>} Generated NFT collection info
   */
  async generateCollection(options) {
    if (!this.initialized) {
      throw new Error('NFT Generator service not initialized');
    }
    
    const { 
      collectionName, 
      width = 1000, 
      height = 1000, 
      count = 10,
      layerConfigurations = [],
      baseMetadata = {}
    } = options;
    
    if (!collectionName) {
      throw new Error('Collection name is required');
    }
    
    if (!layerConfigurations || layerConfigurations.length === 0) {
      throw new Error('Layer configurations are required for collection generation');
    }
    
    try {
      // Create collection directory
      const collectionDir = path.join(this.outputDir, collectionName);
      await fs.ensureDir(collectionDir);
      
      // Generate NFTs for the collection
      const collection = [];
      
      for (let i = 1; i <= count; i++) {
        // Select random traits from layer configurations
        const selectedLayers = [];
        
        for (const layerConfig of layerConfigurations) {
          if (layerConfig.options && layerConfig.options.length > 0) {
            // Randomly select a trait from the options
            const randomIndex = Math.floor(Math.random() * layerConfig.options.length);
            const selectedTrait = layerConfig.options[randomIndex];
            
            selectedLayers.push({
              trait: layerConfig.name,
              traitType: layerConfig.name,
              traitName: selectedTrait.name,
              traitContent: selectedTrait.content,
              zIndex: layerConfig.zIndex || 0
            });
          }
        }
        
        // Generate a single NFT with the selected traits
        const nftName = `${collectionName} #${i.toString().padStart(count.toString().length, '0')}`;
        const nft = await this.generateSingleNFT({
          name: nftName,
          width,
          height,
          layers: selectedLayers,
          metadata: {
            ...baseMetadata,
            edition: i,
            collection: collectionName
          }
        });
        
        // Move files to collection directory
        const collectionImagePath = path.join(collectionDir, nft.fileName);
        const collectionMetadataPath = path.join(collectionDir, nft.metadataFileName);
        
        await fs.copy(nft.filePath, collectionImagePath);
        await fs.copy(nft.metadataFilePath, collectionMetadataPath);
        
        // Add collection paths to NFT info
        nft.collectionImagePath = collectionImagePath;
        nft.collectionMetadataPath = collectionMetadataPath;
        
        collection.push(nft);
      }
      
      // Return the generated collection
      return collection;
    } catch (error) {
      logger.error('[nft-generator] Error generating collection:', error);
      throw new Error(`Failed to generate collection: ${error.message}`);
    }
  }
  
  /**
   * Upload a generated NFT to Google Cloud Storage
   * @param {Object} nft - Generated NFT information
   * @param {string} folderPath - Folder path in the bucket
   * @returns {Promise<Object>} Upload information
   */
  async uploadNFTToCloud(nft, folderPath = 'nfts/') {
    if (!googleStorageService.isInitialized()) {
      throw new Error('Google Storage service not initialized');
    }
    
    try {
      // Upload image
      const imageBuffer = await fs.readFile(nft.filePath);
      const imageUpload = await googleStorageService.uploadFile(
        imageBuffer,
        nft.fileName,
        folderPath
      );
      
      // Update metadata with cloud URL
      nft.metadata.image = imageUpload.publicUrl;
      
      // Write updated metadata to file
      await fs.writeJson(nft.metadataFilePath, nft.metadata, { spaces: 2 });
      
      // Upload updated metadata
      const metadataBuffer = await fs.readFile(nft.metadataFilePath);
      const metadataUpload = await googleStorageService.uploadFile(
        metadataBuffer,
        nft.metadataFileName,
        folderPath
      );
      
      return {
        name: nft.name,
        imageUrl: imageUpload.publicUrl,
        metadataUrl: metadataUpload.publicUrl,
        metadata: nft.metadata
      };
    } catch (error) {
      logger.error('[nft-generator] Error uploading NFT to cloud:', error);
      throw new Error(`Failed to upload NFT: ${error.message}`);
    }
  }
  
  /**
   * Upload a collection of NFTs to Google Cloud Storage
   * @param {Array<Object>} collection - Generated collection information
   * @param {string} folderPath - Folder path in the bucket
   * @returns {Promise<Object>} Upload information
   */
  async uploadCollectionToCloud(collection, folderPath = 'collections/') {
    if (!googleStorageService.isInitialized()) {
      throw new Error('Google Storage service not initialized');
    }
    
    try {
      const uploadedCollection = [];
      
      for (const nft of collection) {
        const uploaded = await this.uploadNFTToCloud(nft, folderPath);
        uploadedCollection.push(uploaded);
      }
      
      return {
        count: uploadedCollection.length,
        nfts: uploadedCollection
      };
    } catch (error) {
      logger.error('[nft-generator] Error uploading collection to cloud:', error);
      throw new Error(`Failed to upload collection: ${error.message}`);
    }
  }
  
  /**
   * Clean up temporary files
   */
  async cleanup() {
    try {
      await fs.emptyDir(this.tempDir);
      logger.info('[nft-generator] Temporary files cleaned up');
    } catch (error) {
      logger.error('[nft-generator] Error cleaning up temporary files:', error);
    }
  }
}

// Export a singleton instance
const nftGeneratorService = new NFTGeneratorService();

module.exports = { nftGeneratorService };