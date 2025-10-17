import { Router } from 'express';
import { Client } from '@replit/object-storage';

const router = Router();

// Initialize Replit Object Storage client
let replitClient: Client | null = null;
let isConnected = false;

try {
  replitClient = new Client();
  isConnected = true;
  console.log('[replit-storage] Connected to Replit Object Storage successfully');
} catch (error) {
  console.error('[replit-storage] Failed to connect:', error);
}

/**
 * GET /api/replit-storage/images
 * Get all images from Replit Object Storage
 */
router.get('/images', async (req, res) => {
  try {
    if (!isConnected || !replitClient) {
      return res.status(503).json({ 
        error: 'Replit Object Storage not initialized',
        message: 'Unable to connect to object storage'
      });
    }

    const objects = await replitClient.list();
    
    // Filter for image files
    const imageObjects = objects.filter(obj => {
      const name = obj.key.toLowerCase();
      return name.endsWith('.png') || 
             name.endsWith('.jpg') || 
             name.endsWith('.jpeg') || 
             name.endsWith('.gif') || 
             name.endsWith('.webp');
    });

    const images = imageObjects.map(obj => ({
      key: obj.key,
      name: obj.key.split('/').pop() || obj.key,
      size: obj.size,
      lastModified: obj.lastModified,
      url: `https://storage.googleapis.com/replit/${process.env.REPL_SLUG}/${obj.key}`
    }));
    
    res.json({
      success: true,
      count: images.length,
      images: images
    });
  } catch (error: any) {
    console.error('[replit-storage-route] Error listing images:', error);
    res.status(500).json({ 
      error: 'Failed to list images from storage',
      message: error.message
    });
  }
});

/**
 * GET /api/replit-storage/generate-nfts
 * Generate 54 NFT metadata entries using Object Storage pattern
 */
router.get('/generate-nfts', async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const merchants = ['dunkin', 'cvs', null];
    
    const characterNames = [
      'Digital Pioneer', 'Cyber Guardian', 'Blockchain Warrior', 'NFT Master', 'Crypto Knight',
      'Data Sentinel', 'Code Phantom', 'Pixel Hero', 'Network Defender', 'Token Keeper',
      'Digital Samurai', 'Cyber Ninja', 'Blockchain Sage', 'NFT Collector', 'Crypto Wizard',
      'Data Oracle', 'Code Breaker', 'Pixel Artist', 'Network Guardian', 'Token Master',
      'Digital Explorer', 'Cyber Mage', 'Blockchain Prophet', 'NFT Creator', 'Crypto Champion',
      'Data Architect', 'Code Weaver', 'Pixel Warrior', 'Network Shaman', 'Token Sage',
      'Digital Alchemist', 'Cyber Paladin', 'Blockchain Monk', 'NFT Innovator', 'Crypto Mystic',
      'Data Forger', 'Code Dancer', 'Pixel Shaman', 'Network Monk', 'Token Warrior',
      'Digital Merchant', 'Cyber Scholar', 'Blockchain Artist', 'NFT Pioneer', 'Crypto Sage',
      'Data Weaver', 'Code Master', 'Pixel Guardian', 'Network Oracle', 'Token Explorer',
      'Digital Voyager', 'Cyber Bard', 'Blockchain Scribe', 'NFT Visionary'
    ];

    // Get actual PNG files from your uploaded images
    const imagesDir = path.join(process.cwd(), 'public', 'nft-images');
    const imageFiles = fs.readdirSync(imagesDir)
      .filter((file: string) => file.toLowerCase().endsWith('.png'))
      .sort();

    console.log(`[replit-storage] Found ${imageFiles.length} PNG files`);

    // Generate NFTs using your actual uploaded images
    const nfts = imageFiles.map((filename: string, i: number) => {
      const rarity = rarities[i % rarities.length];
      const merchant = merchants[i % merchants.length];
      const name = characterNames[i] || `Character #${i + 1}`;
      
      return {
        id: `storage-nft-${i + 1}`,
        name: name,
        description: `An exclusive digital character NFT with ${rarity} rarity from your uploaded collection.`,
        image: `/api/replit-storage/image/${i + 1}`,
        rarity: rarity,
        merchant: merchant,
        attributes: [
          {
            trait_type: "Source",
            value: "Uploaded Images"
          },
          {
            trait_type: "Rarity",
            value: rarity.charAt(0).toUpperCase() + rarity.slice(1)
          },
          {
            trait_type: "Type",
            value: "Character"
          },
          {
            trait_type: "Generation",
            value: `Gen ${Math.floor(i / 10) + 1}`
          },
          ...(merchant ? [{
            trait_type: "Merchant",
            value: merchant === 'dunkin' ? 'Dunkin\'' : 'CVS'
          }] : [])
        ]
      };
    });

    res.json({
      success: true,
      count: nfts.length,
      nfts: nfts
    });
  } catch (error: any) {
    console.error('[replit-storage-route] Error generating NFTs:', error);
    res.status(500).json({ 
      error: 'Failed to generate NFTs',
      message: error.message
    });
  }
});

/**
 * GET /api/replit-storage/image/:id
 * Serve an image from Object Storage by ID
 */
router.get('/image/:id', async (req, res) => {
  const imageId = req.params.id;
  console.log(`[replit-storage] Request for image ${imageId}`);
  
  if (!isConnected || !replitClient) {
    console.log('[replit-storage] Not connected to Object Storage');
    return res.status(503).send('Object Storage not available');
  }

  try {
    // List all files in your Object Storage
    const listResult = await replitClient.list();
    console.log('[replit-storage] Got list result, checking structure...');
    
    // Extract files array from the result
    let allFiles: any[] = [];
    if (listResult?.ok && Array.isArray(listResult.value)) {
      allFiles = listResult.value;
    } else if (Array.isArray(listResult)) {
      allFiles = listResult;
    } else {
      console.log('[replit-storage] Unexpected list result format');
      return res.status(500).send('Unable to list storage files');
    }
    
    console.log(`[replit-storage] Total files found: ${allFiles.length}`);
    
    // Get only PNG files from your storage
    const pngFiles = allFiles.filter(file => 
      file?.key && file.key.toLowerCase().endsWith('.png')
    );
    
    console.log(`[replit-storage] PNG files found: ${pngFiles.length}`);
    
    if (pngFiles.length === 0) {
      console.log('[replit-storage] No PNG files in storage');
      return res.status(404).send('No PNG files found in storage');
    }
    
    // Get the specific image by index
    const index = parseInt(imageId) - 1;
    if (index < 0 || index >= pngFiles.length) {
      console.log(`[replit-storage] Index ${index} out of range`);
      return res.status(404).send('Image index out of range');
    }
    
    const file = pngFiles[index];
    console.log(`[replit-storage] Downloading: ${file.key}`);
    
    // Download your actual PNG file
    const downloadResult = await replitClient.downloadAsBytes(file.key);
    
    // Handle the download result properly
    let imageBuffer: Buffer;
    if (downloadResult?.ok && downloadResult.value) {
      // Result wrapper format
      imageBuffer = Buffer.from(downloadResult.value);
    } else if (Buffer.isBuffer(downloadResult)) {
      // Direct buffer format
      imageBuffer = downloadResult;
    } else if (downloadResult && typeof downloadResult === 'object' && downloadResult.length) {
      // Array-like format
      imageBuffer = Buffer.from(downloadResult);
    } else {
      console.log('[replit-storage] Invalid download result');
      return res.status(500).send('Failed to download image');
    }
    
    console.log(`[replit-storage] Image loaded successfully: ${imageBuffer.length} bytes`);
    
    // Send your actual PNG file
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Length', imageBuffer.length);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(imageBuffer);
    
  } catch (error: any) {
    console.error('[replit-storage] Error:', error.message);
    res.status(500).send(`Error loading image: ${error.message}`);
  }
});

/**
 * GET /api/replit-storage/status
 * Check Replit Object Storage connection status
 */
router.get('/status', (req, res) => {
  res.json({
    connected: isConnected,
    message: isConnected 
      ? 'Connected to Replit Object Storage'
      : 'Not connected to Replit Object Storage'
  });
});

export default router;