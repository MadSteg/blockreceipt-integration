/**
 * Unified Upload and Mint Route
 * 
 * This unified route handles the complete flow from receipt upload to NFT minting:
 * 1. Upload receipt image
 * 2. Process image with OCR
 * 3. Store data on IPFS
 * 4. Encrypt metadata (if requested)
 * 5. Mint NFT
 */

import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

import { ocrService } from '../../services/ocrService';
import { ipfsService } from '../../services/ipfsService';
import { thresholdClient } from '../../services/thresholdClient';
import { nftMintService } from '../../services/nftMintService';
import { couponService } from '../../services/couponService';
import { taskQueueService, TaskStatus } from '../../services/taskQueueService';
import { nftPurchaseHandler } from '../../task-handlers/nftPurchaseHandler';
import { logger, createLogger } from '../../utils/logger';
const routeLogger = createLogger('upload-mint');
import { validateReceipt } from '../../services/ocrService';
import { requireAuth } from '../../middleware/requireAuth';

// Setup multer for image uploads
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
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    
    if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and PDF files are allowed.'));
      return;
    }
    
    cb(null, true);
  }
});

const router = Router();

// Initialize task handler
taskQueueService.registerHandler('nft-purchase', nftPurchaseHandler);

/**
 * Route for uploading a receipt and minting an NFT
 * Flow: Upload → OCR → IPFS → Encrypt → Mint
 */
router.post(
  '/',
  upload.single('receiptImage'),
  async (req, res) => {
    try {
      // Log request details to debug upload issues
      console.log('Upload request received:');
      console.log('- Body fields:', Object.keys(req.body || {}));
      console.log('- File:', req.file ? req.file.fieldname : 'No file received');
      console.log('- Files:', req.files ? Object.keys(req.files) : 'No files');
      
      let { walletAddress, encryptMetadata } = req.body;
      
      if (!walletAddress) {
        // In development, provide a default wallet address if not provided
        if (process.env.NODE_ENV === 'development') {
          walletAddress = '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'; // Development wallet
          routeLogger.info(`Using default development wallet: ${walletAddress}`);
        } else {
          return res.status(400).json({
            success: false,
            message: 'Wallet address is required'
          });
        }
      }
      
      const file = req.file;
      if (!file) {
        logger.error('No file received in request');
        return res.status(400).json({
          success: false,
          message: 'Receipt image is required'
        });
      }
      
      // Step 1: Extract receipt data using OCR
      logger.info(`Processing receipt image: ${file.filename}`);
      
      let receiptData;
      try {
        receiptData = await ocrService.processReceipt(file.path);
      } catch (ocrError) {
        logger.error(`OCR processing failed: ${ocrError}`);
        return res.status(500).json({
          error: 'Failed to process receipt image',
          details: ocrError instanceof Error ? ocrError.message : String(ocrError)
        });
      }
      
      if (!receiptData) {
        return res.status(422).json({
          error: 'Unable to extract data from receipt image'
        });
      }
      
      // Step 2: Validate receipt data
      const validation = validateReceipt(receiptData);
      if (!validation.valid) {
        return res.status(422).json({
          error: 'Invalid receipt data',
          details: validation.errors
        });
      }
      
      // Step 3: Upload receipt image to IPFS
      let imageCid = '';
      try {
        imageCid = await ipfsService.uploadFile(file.path);
      } catch (ipfsError) {
        logger.error(`IPFS upload failed: ${ipfsError}`);
        return res.status(500).json({
          error: 'Failed to upload receipt image to IPFS',
          details: ipfsError instanceof Error ? ipfsError.message : String(ipfsError)
        });
      }
      
      // Step 4: Add image CID to receipt data
      const receiptWithImage = {
        ...receiptData,
        imageCid,
        imageUrl: `ipfs://${imageCid}`
      };
      
      // Step 5: Encrypt metadata if requested
      let encryptedData = null;
      if (encryptMetadata === 'true' || encryptMetadata === true) {
        try {
          // For development mode, use a default public key if not provided
          let publicKey = req.body.publicKey;
          
          if (!publicKey && process.env.NODE_ENV === 'development') {
            publicKey = 'devPublicKey123'; // Default development public key
            routeLogger.info('Using default development public key for encryption');
          } else if (!publicKey) {
            return res.status(400).json({
              error: 'Public key is required for metadata encryption'
            });
          }
          
          // For development mode, we'll use the entire receipt for encryption
          // In a production environment, we would format this according to TaCo requirements
          
          // Modified approach for development to ensure proper handling
          if (process.env.NODE_ENV === 'development') {
            // Use a simplified mock encryption in development mode
            encryptedData = {
              available: true,
              encryptedData: Buffer.from(JSON.stringify(receiptWithImage)).toString('base64'),
              capsule: `capsule_${Date.now()}`,
              publicKey: publicKey
            };
            routeLogger.info('Using development mode mock encryption');
          } else {
            // Use the ThresholdClient for encryption with dual metadata structure
            const serializedData = JSON.stringify([receiptWithImage]);
            
            // Use our new thresholdClient encryption interface
            const encryptResult = await thresholdClient.encrypt({
              recipientPublicKey: walletAddress,
              data: Buffer.from(serializedData)
            });
            
            encryptedData = {
              available: true,
              encryptedData: encryptResult.ciphertext,
              capsule: encryptResult.capsule,
              publicKey: publicKey
            };
          }
        } catch (encryptionError) {
          routeLogger.error(`Metadata encryption failed: ${encryptionError}`);
          return res.status(500).json({
            error: 'Failed to encrypt receipt metadata',
            details: encryptionError instanceof Error ? encryptionError.message : String(encryptionError)
          });
        }
      }
      
      // Step 6: Generate a time-limited coupon using our coupon service if receipt has merchant info
      let couponData = null;
      if (receiptData && receiptData.merchantName) {
        try {
          // Generate a coupon based on the merchant name (default 14-day expiration)
          routeLogger.info(`Generating coupon for merchant: ${receiptData.merchantName}`);
          
          // Use our coupon service to create an encrypted coupon
          couponData = await couponService.generateCoupon(
            receiptData.merchantName,
            14 // 14-day expiration
          );
          
          routeLogger.info(`Coupon generated successfully, valid until: ${new Date(couponData.validUntil).toISOString()}`);
        } catch (couponError) {
          routeLogger.error(`Failed to generate coupon: ${couponError}`);
          // Continue with receipt processing even if coupon generation fails
        }
      }
      
      // Step 7: Create task for asynchronous NFT minting
      const uniqueId = uuidv4();
      const receipt = {
        id: uniqueId,
        ...receiptWithImage,
        // Store the image data for the task handler to use
        imageData: fs.readFileSync(file.path).toString('base64'),
        // Add coupon data if available
        coupon: couponData || undefined
      };
      
      // Create task in queue for async processing
      const task = taskQueueService.createTask('nft-purchase', {
        receipt,
        wallet: walletAddress,
        publicKey: req.body.publicKey,
        encryptMetadata: encryptMetadata === 'true' || encryptMetadata === true,
        hasCoupon: !!couponData
      });
      
      // Return success response with data in the expected format for the client
      return res.status(200).json({
        success: true,
        message: 'Receipt processing initiated',
        data: {
          ...receiptWithImage,
          isEncrypted: encryptMetadata === 'true' || encryptMetadata === true,
          nftGift: {
            taskId: task.id
          }
        },
        taskId: task.id,
        receiptId: uniqueId,
        status: task.status
      });
    } catch (error) {
      logger.error('Upload and mint error:', error);
      
      if (error instanceof multer.MulterError) {
        return res.status(400).json({
          error: 'File upload error',
          details: error.message
        });
      } else if (error instanceof Error) {
        return res.status(500).json({
          error: 'Server error',
          details: error.message
        });
      } else {
        return res.status(500).json({
          error: 'Unknown error occurred'
        });
      }
    }
  }
);

/**
 * Route for checking the status of an NFT minting task
 */
router.get('/task/:taskId', requireAuth, async (req, res) => {
  const { taskId } = req.params;
  
  if (!taskId) {
    return res.status(400).json({
      error: 'Task ID is required'
    });
  }
  
  const task = taskQueueService.getTask(taskId);
  
  if (!task) {
    return res.status(404).json({
      error: 'Task not found'
    });
  }
  
  // Return task status and result if available
  return res.status(200).json({
    taskId: task.id,
    status: task.status,
    completed: task.status === TaskStatus.COMPLETED,
    failed: task.status === TaskStatus.FAILED,
    error: task.error,
    result: task.result,
    createdAt: task.createdAt,
    completedAt: task.completedAt
  });
});

export default router;