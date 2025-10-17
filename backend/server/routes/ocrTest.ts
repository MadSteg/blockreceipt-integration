import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { ocrService } from '../services/ocrService';
import { logger } from '../utils/logger';

const router = express.Router();

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const extension = path.extname(file.originalname) || '.jpg';
    cb(null, `ocr-test-${uniqueSuffix}${extension}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max size
  fileFilter: (req, file, cb) => {
    logger.info(`Received file upload for OCR testing: ${file.originalname}, mimetype: ${file.mimetype}`);
    // Accept images only for OCR testing
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase() || '.jpg');
    const mimetype = filetypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for OCR testing'));
    }
  }
}).single('receiptImage');

// OCR test route to test different OCR engines
router.post('/', (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      logger.error(`OCR test upload error: ${err.message}`);
      return res.status(400).json({ success: false, message: err.message });
    }

    try {
      // Check for file
      const file = req.file;
      if (!file) {
        return res.status(400).json({ 
          success: false, 
          message: 'No file uploaded'
        });
      }

      logger.info(`Processing OCR test image at ${file.path}`);
      const filePath = file.path;
      const fileBuffer = fs.readFileSync(filePath);
      
      // Test all OCR engines
      const results: any = {};

      // Test Google Vision
      try {
        logger.info('Testing Google Vision OCR engine...');
        const visionResult = await ocrService.extractWithGoogleVision(fileBuffer);
        if (visionResult.confidence > 0) {
          const parsedData = ocrService.parseReceipt(visionResult.text);
          results.googleVision = {
            ...parsedData,
            confidence: visionResult.confidence,
            ocrEngine: 'google-vision'
          };
          logger.info(`Google Vision OCR completed with confidence: ${visionResult.confidence}`);
        } else {
          logger.warn('Google Vision OCR failed to extract meaningful text');
          results.googleVision = null;
        }
      } catch (visionError) {
        logger.error(`Error in Google Vision OCR: ${visionError}`);
        results.googleVision = null;
      }

      // Test Tesseract
      try {
        logger.info('Testing Tesseract OCR engine...');
        const tesseractResult = await ocrService.extractWithTesseract(fileBuffer);
        if (tesseractResult.confidence > 0) {
          const parsedData = ocrService.parseReceipt(tesseractResult.text);
          results.tesseract = {
            ...parsedData,
            confidence: tesseractResult.confidence,
            ocrEngine: 'tesseract'
          };
          logger.info(`Tesseract OCR completed with confidence: ${tesseractResult.confidence}`);
        } else {
          logger.warn('Tesseract OCR failed to extract meaningful text');
          results.tesseract = null;
        }
      } catch (tesseractError) {
        logger.error(`Error in Tesseract OCR: ${tesseractError}`);
        results.tesseract = null;
      }

      // Test combined approach (the actual production implementation)
      try {
        logger.info('Testing combined OCR approach with fallback mechanisms...');
        const combinedResult = await ocrService.processReceipt(fileBuffer);
        results.combined = combinedResult;
        logger.info(`Combined OCR approach completed using engine: ${combinedResult.ocrEngine}`);
      } catch (combinedError) {
        logger.error(`Error in combined OCR approach: ${combinedError}`);
        results.combined = null;
      }

      // Get OCR statistics
      const ocrStats = ocrService.getOcrStats();
      results.stats = ocrStats;

      // Return all results
      return res.status(200).json({
        success: true,
        message: 'OCR testing completed',
        ...results
      });
    } catch (error) {
      logger.error(`Error in OCR testing: ${error}`);
      return res.status(500).json({
        success: false,
        message: 'An error occurred during OCR testing',
        error: (error as Error).message
      });
    }
  });
});

export default router;