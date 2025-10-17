const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { extractReceiptData, determineReceiptTier } = require('../../shared/utils/receiptLogic');

const router = express.Router();

// Set up multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, 'receipt-' + uniqueSuffix + extension);
  }
});

// Initialize multer with storage configuration
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    // Accept only images and PDFs
    const allowedTypes = /jpeg|jpg|png|gif|pdf/;
    const mimeTypeValid = allowedTypes.test(file.mimetype);
    const extValid = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimeTypeValid && extValid) {
      return cb(null, true);
    }
    cb(new Error('Only .jpeg, .jpg, .png, .gif and .pdf files are allowed!'));
  }
});

// Route for uploading a receipt
router.post('/upload-receipt', upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Extract data from the uploaded receipt using OCR
    const receiptData = await extractReceiptData(req.file.path);
    
    // Determine receipt tier based on the total amount
    const tier = determineReceiptTier(receiptData.total);
    
    // Return the parsed receipt data and assigned tier
    return res.status(200).json({ 
      success: true,
      data: {
        ...receiptData,
        tier,
        filePath: req.file.path,
        fileId: path.basename(req.file.path)
      }
    });
  } catch (error) {
    console.error('Error processing receipt:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to process receipt', 
      error: error.message
    });
  }
});

// Route for getting receipt data by ID
router.get('/receipt/:fileId', (req, res) => {
  try {
    const fileId = req.params.fileId;
    const filePath = path.join(__dirname, '../../uploads', fileId);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: 'Receipt not found' });
    }
    
    // Serve the file
    return res.sendFile(filePath);
  } catch (error) {
    console.error('Error retrieving receipt:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve receipt', 
      error: error.message
    });
  }
});

// For CommonJS export
module.exports = router;
// For ESM default export compatibility
export default router;