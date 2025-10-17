/**
 * OCR Routes for Receipt Processing
 * 
 * These routes handle receipt image uploads and OCR processing
 */

import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { ocrService } from '../services/ocrService';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for disk storage
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = path.join(process.cwd(), 'uploads');
      
      // Create uploads directory if it doesn't exist
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}-${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files and PDFs
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP, and PDF files are allowed'));
    }
  },
});

// Schema for base64 image upload
const base64UploadSchema = z.object({
  image: z.string().min(50), // Minimum length to ensure it's a valid base64 image
  fileName: z.string().optional(),
});

/**
 * Process a receipt image uploaded as multipart form data
 * POST /api/ocr/upload
 */
router.post('/upload', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No receipt image provided' });
    }
    
    // Process with our enhanced OCR pipeline
    logger.info('Starting enhanced receipt OCR processing...');
    logger.info(`Processing receipt image: ${req.file.path}`);
    
    // Process the image with our OCR service
    const receiptData = await ocrService.processReceipt(req.file.path);
    
    if (!receiptData) {
      logger.error('All OCR methods failed. Unable to process receipt image.');
      return res.status(422).json({ 
        success: false,
        error: 'Failed to process receipt image. Please try again with a clearer image.'
      });
    }
    
    // Response with extracted data
    res.json({
      success: true,
      data: receiptData,
      source: receiptData.confidence && receiptData.confidence > 0.8 ? 'openai' : 'tesseract'
    });
  } catch (error) {
    logger.error('Receipt upload error:', error);
    res.status(500).json({ 
      error: 'Failed to process receipt image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Process a receipt image uploaded as base64
 * POST /api/ocr/process
 */
router.post('/process', async (req, res) => {
  try {
    // Validate the request body
    const validated = base64UploadSchema.safeParse(req.body);
    
    if (!validated.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: validated.error.format()
      });
    }
    
    const { image, fileName = 'receipt.jpg' } = validated.data;
    
    // Remove any data URL prefix if present
    const base64Image = image.includes('base64,') 
      ? image.split('base64,')[1] 
      : image;
    
    // Create a temporary file from the base64 image
    const tempFilePath = path.join(process.cwd(), 'uploads', `${Date.now()}-${uuidv4()}-${fileName}`);
    const imageBuffer = Buffer.from(base64Image, 'base64');
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, imageBuffer);
    
    logger.info('Starting receipt OCR processing...');
    logger.info(`Processing base64 receipt image, saved to: ${tempFilePath}`);
    
    try {
      // Process the image with our OCR service
      const receiptData = await ocrService.processReceipt(tempFilePath);
      
      if (!receiptData) {
        logger.error('All OCR methods failed. Unable to process receipt image.');
        return res.status(422).json({ 
          success: false,
          error: 'Failed to process receipt image. Please try again with a clearer image.'
        });
      }
      
      // Response with extracted data
      res.json({
        success: true,
        data: receiptData,
        source: receiptData.confidence && receiptData.confidence > 0.8 ? 'openai' : 'tesseract'
      });
    } finally {
      // Clean up the temporary file
      try {
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
          logger.info(`Removed temporary file: ${tempFilePath}`);
        }
      } catch (cleanupError) {
        logger.warn(`Failed to remove temporary file: ${cleanupError}`);
      }
    }
  } catch (error) {
    logger.error('Receipt processing error:', error);
    res.status(500).json({ 
      error: 'Failed to process receipt image',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;