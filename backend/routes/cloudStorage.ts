import { Router } from 'express';
import { googleStorageService } from '../services/googleStorageService';
import multer from 'multer';
import { logger } from '../utils/logger';

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

const router = Router();

/**
 * GET /api/storage/status
 * Check if Google Cloud Storage is properly configured
 */
router.get('/status', (req, res) => {
  const isInitialized = googleStorageService.isInitialized();
  
  res.json({
    status: isInitialized ? 'connected' : 'disconnected',
    bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME || 'not configured',
    message: isInitialized 
      ? 'Google Cloud Storage is properly configured' 
      : 'Google Cloud Storage is not configured. Please check your credentials.'
  });
});

/**
 * GET /api/storage/file
 * Get a signed URL for a file in Google Cloud Storage
 */
router.get('/file', async (req, res) => {
  try {
    const fileName = req.query.fileName as string;
    
    if (!fileName) {
      return res.status(400).json({ error: 'Missing fileName parameter' });
    }
    
    if (!googleStorageService.isInitialized()) {
      return res.status(503).json({ error: 'Google Cloud Storage not initialized' });
    }
    
    // Check if file exists
    const exists = await googleStorageService.fileExists(fileName);
    
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Generate a signed URL (valid for 15 minutes)
    const url = await googleStorageService.getSignedUrl(fileName);
    
    res.json({
      fileName,
      url,
      expiresIn: '15 minutes'
    });
  } catch (error) {
    logger.error('[cloud-storage-route] Error getting file URL:', error);
    res.status(500).json({ 
      error: 'Failed to get file URL',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * GET /api/storage/nft-images
 * Get a list of NFT images from the Google Cloud Storage bucket
 */
router.get('/nft-images', async (req, res) => {
  try {
    const folderPath = (req.query.folder as string) || 'bulldogs/';
    
    if (!googleStorageService.isInitialized()) {
      return res.status(503).json({ error: 'Google Cloud Storage not initialized' });
    }
    
    // Get list of NFT images
    const images = await googleStorageService.listNftImages(folderPath === undefined ? 'bulldogs/' : folderPath);
    
    res.json({
      count: images.length,
      folderPath,
      images
    });
  } catch (error) {
    logger.error('[cloud-storage-route] Error listing NFT images:', error);
    res.status(500).json({ 
      error: 'Failed to list NFT images',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * POST /api/storage/upload
 * Upload a file to Google Cloud Storage
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    if (!googleStorageService.isInitialized()) {
      return res.status(503).json({ error: 'Google Cloud Storage not initialized' });
    }
    
    const folderPath = req.body.folderPath || '';
    
    // Upload file to Google Cloud Storage
    const result = await googleStorageService.uploadFile(
      req.file.buffer,
      req.file.originalname,
      folderPath
    );
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      fileName: result.fileName,
      publicUrl: result.publicUrl
    });
  } catch (error) {
    logger.error('[cloud-storage-route] Error uploading file:', error);
    res.status(500).json({ 
      error: 'Failed to upload file',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

/**
 * DELETE /api/storage/file
 * Delete a file from Google Cloud Storage
 */
router.delete('/file', async (req, res) => {
  try {
    const fileName = req.query.fileName as string;
    
    if (!fileName) {
      return res.status(400).json({ error: 'Missing fileName parameter' });
    }
    
    if (!googleStorageService.isInitialized()) {
      return res.status(503).json({ error: 'Google Cloud Storage not initialized' });
    }
    
    // Check if file exists
    const exists = await googleStorageService.fileExists(fileName);
    
    if (!exists) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Delete the file
    await googleStorageService.deleteFile(fileName);
    
    res.json({
      success: true,
      message: 'File deleted successfully',
      fileName
    });
  } catch (error) {
    logger.error('[cloud-storage-route] Error deleting file:', error);
    res.status(500).json({ 
      error: 'Failed to delete file',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});

export default router;