/**
 * Test upload route to diagnose file upload issues
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

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
  }
});

// Test endpoint to check file uploads
router.post('/test-upload', upload.single('receiptImage'), (req, res) => {
  console.log('Test upload received:');
  console.log('- Headers:', req.headers);
  console.log('- Body fields:', req.body);
  console.log('- File exists:', !!req.file);
  
  if (req.file) {
    console.log('- File details:', {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
    
    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        path: req.file.path
      }
    });
  } else {
    console.log('No file was uploaded');
    return res.status(400).json({
      success: false,
      message: 'No file was uploaded'
    });
  }
});

export default router;