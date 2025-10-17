import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { logger } from '../utils/logger';

const router = express.Router();

// Configure storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E8);
    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure upload limits
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif|heic|heif)$/i)) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

/**
 * @route POST /api/upload
 * @desc Upload receipt image
 * @access Private
 */
router.post('/', (req, res, next) => {
  // Check if wallet address is provided
  if (!req.body.walletAddress) {
    return res.status(400).json({
      success: false,
      message: 'Connect wallet first'
    });
  }

  // If wallet address exists, continue with upload
  upload.single('receipt')(req, res, (err) => {
    if (err) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // File uploaded successfully
    logger.info(`Receipt uploaded by wallet ${req.body.walletAddress}`, {
      filename: req.file.filename,
      size: req.file.size
    });

    return res.status(200).json({
      success: true,
      message: 'Receipt uploaded successfully',
      data: {
        filename: req.file.filename,
        path: req.file.path
      }
    });
  });
});

export default router;