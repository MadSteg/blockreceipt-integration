/**
 * OCR Testing Routes
 * 
 * This file provides endpoints to test the OCR system directly
 * without going through the full receipt scanning flow.
 */

import { Router } from "express";
import multer from "multer";
import { ocrService } from "../services/ocrService";
import fs from "fs";
import path from "path";
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

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

// Create the router
const router = Router();

/**
 * Test the OCR system with an image upload
 * POST /api/ocr-test/upload
 */
router.post("/upload", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }

    logger.info(`Processing receipt in test route: ${req.file.path}`);
    
    // Process the image with our OCR service
    const receiptData = await ocrService.processReceipt(req.file.path);
    
    if (!receiptData) {
      logger.error('All OCR methods failed. Unable to process receipt image.');
      return res.status(422).json({ 
        success: false,
        error: 'Failed to process receipt image. Please try again with a clearer image.'
      });
    }
    
    // Return the OCR results
    return res.json({
      success: true,
      data: receiptData,
      source: receiptData.confidence && receiptData.confidence > 0.8 ? 'openai' : 'tesseract'
    });
  } catch (error) {
    logger.error("OCR test error:", error);
    return res.status(500).json({ 
      error: "Failed to process image",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Test the OCR system with a base64 image
 * POST /api/ocr-test/process
 */
router.post("/process", async (req, res) => {
  try {
    const { imageBase64 } = req.body;
    
    if (!imageBase64) {
      return res.status(400).json({ error: "No image provided" });
    }
    
    // Create a temporary file from the base64 image
    const tempFilePath = path.join(process.cwd(), 'uploads', `${Date.now()}-${uuidv4()}-receipt.jpg`);
    const imageBuffer = Buffer.from(
      imageBase64.includes('base64,') ? imageBase64.split('base64,')[1] : imageBase64, 
      'base64'
    );
    
    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Write the buffer to a temporary file
    fs.writeFileSync(tempFilePath, imageBuffer);
    
    logger.info('Starting OCR test processing...');
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
      
      // Return the OCR results
      return res.json({
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
    logger.error("OCR test error:", error);
    return res.status(500).json({ 
      error: "Failed to process image",
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Simple HTML form to test the OCR upload
 * GET /api/ocr-test
 */
router.get("/", (req, res) => {
  const htmlForm = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>BlockReceipt OCR Test</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          line-height: 1.6;
        }
        h1 {
          color: #2563eb;
          margin-bottom: 24px;
        }
        .form-container {
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          background-color: #f9fafb;
        }
        .form-field {
          margin-bottom: 16px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
        }
        button {
          background-color: #2563eb;
          color: white;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
        }
        button:hover {
          background-color: #1d4ed8;
        }
        #result {
          margin-top: 24px;
          white-space: pre-wrap;
        }
        #image-preview {
          margin-top: 16px;
          max-width: 100%;
          max-height: 300px;
          display: none;
        }
      </style>
    </head>
    <body>
      <h1>BlockReceipt OCR Test Tool</h1>
      <div class="form-container">
        <h2>Upload Receipt Image</h2>
        <form id="upload-form" enctype="multipart/form-data">
          <div class="form-field">
            <label for="image">Select a receipt image:</label>
            <input type="file" id="image" name="image" accept="image/*" required>
          </div>
          <img id="image-preview" src="" alt="Image preview">
          <div class="form-field">
            <button type="submit">Process Receipt</button>
          </div>
        </form>
      </div>
      
      <div id="result-container">
        <h2>OCR Result</h2>
        <div id="result">Upload an image to see results</div>
      </div>
      
      <script>
        // Preview the image when selected
        document.getElementById('image').addEventListener('change', function(event) {
          const file = event.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
              const preview = document.getElementById('image-preview');
              preview.src = e.target.result;
              preview.style.display = 'block';
            }
            reader.readAsDataURL(file);
          }
        });
        
        // Handle form submission
        document.getElementById('upload-form').addEventListener('submit', async function(e) {
          e.preventDefault();
          
          const resultDiv = document.getElementById('result');
          resultDiv.textContent = 'Processing...';
          
          const formData = new FormData(this);
          
          try {
            const response = await fetch('/api/ocr-test/upload', {
              method: 'POST',
              body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
              resultDiv.innerHTML = '<h3>Extracted Data:</h3>' + 
                '<pre>' + JSON.stringify(result.data, null, 2) + '</pre>';
            } else {
              resultDiv.textContent = 'Error: ' + (result.error || 'Unknown error');
            }
          } catch (error) {
            resultDiv.textContent = 'Error: ' + error.message;
          }
        });
      </script>
    </body>
    </html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(htmlForm);
});

export default router;