/**
 * Enhanced OCR Service for BlockReceipt.ai
 * 
 * This module provides multi-layered OCR functionality using:
 * 1. Google Cloud Vision API (primary)
 * 2. Tesseract.js (fallback)
 * 3. Manual parsing (emergency fallback)
 * 
 * for extracting and processing receipt data with high reliability.
 */

import vision from '@google-cloud/vision';
import Tesseract from 'tesseract.js';
import fs from 'fs';
import { logger } from '../utils/logger';

// Initialize Google Cloud Vision client
const visionClient = new vision.ImageAnnotatorClient();

// Track OCR performance metrics
let ocrStats = {
  totalAttempts: 0,
  googleVisionSuccess: 0,
  tesseractSuccess: 0,
  manualParseSuccess: 0,
  failures: 0
};

// Define OCR result interface
interface OCRResult {
  text: string;
  confidence: number;
  source: 'google-vision' | 'tesseract' | 'manual-parse' | 'failed';
}

/**
 * Categorize an item based on its name
 * @param itemName Name of the item
 * @returns Category string
 */
function categorizeItem(itemName: string): string {
  // Convert to lowercase for matching
  const name = itemName.toLowerCase();
  
  // Define category matchers
  const categories: Record<string, RegExp> = {
    'food': /burger|pizza|sandwich|salad|chicken|beef|fish|vegetable|fruit|bread|cheese|milk|egg|yogurt|coffee|tea|water|soda|juice|beer|wine/i,
    'electronics': /phone|tablet|laptop|computer|tv|television|monitor|keyboard|mouse|charger|cable|adapter|headphone|speaker|camera/i,
    'clothing': /shirt|pant|trouser|jean|dress|skirt|jacket|coat|sweater|hoodie|sock|underwear|shoe|boot|hat|cap|glove|scarf/i,
    'household': /towel|sheet|blanket|pillow|furniture|chair|table|desk|lamp|light|rug|carpet|curtain|cleaner|soap|detergent|dish|pan|pot/i,
    'personal_care': /shampoo|conditioner|soap|toothpaste|toothbrush|deodorant|perfume|cologne|lotion|cream|makeup|razor|tissue|toilet/i,
    'health': /medicine|vitamin|supplement|bandage|first aid|pain|relief|prescription|pill|capsule|tablet/i,
    'office': /paper|notebook|binder|folder|pen|pencil|marker|highlighter|stapler|tape|paperclip|envelope|ink|toner/i,
    'pet': /dog|cat|pet|food|treat|toy|leash|collar|bed|cage|aquarium/i
  };
  
  // Check each category
  for (const [category, pattern] of Object.entries(categories)) {
    if (pattern.test(name)) {
      return category;
    }
  }
  
  // Default category if no match
  return 'other';
}

/**
 * Clean and normalize merchant name
 * @param name Raw merchant name
 * @returns Cleaned and normalized merchant name
 */
function cleanMerchantName(name: string): string {
  // Convert to uppercase
  let cleanName = name.toUpperCase();
  
  // Remove common suffixes
  const suffixes = [
    'INC', 'LLC', 'LTD', 'CORP', 'CORPORATION', 'CO', 'COMPANY',
    'INCORPORATED', 'LIMITED', 'INTERNATIONAL', 'INTL', 'ENTERPRISES',
    'HOLDINGS', 'GROUP', 'WORLDWIDE'
  ];
  
  suffixes.forEach(suffix => {
    const regex = new RegExp(`\\s+${suffix}(\\.)?\\s*$`, 'i');
    cleanName = cleanName.replace(regex, '');
  });
  
  // Replace multiple spaces with a single space
  cleanName = cleanName.replace(/\s+/g, ' ').trim();
  
  // Convert back to title case
  cleanName = cleanName
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return cleanName;
}

/**
 * Categorize merchant based on name and items
 * @param merchantName Merchant name
 * @param items Optional item list
 * @returns Category string
 */
function categorizeMerchant(merchantName: string, items: any[] = []): string {
  // Convert merchant name to lowercase for matching
  const name = merchantName.toLowerCase();
  
  // Define category matchers
  const categories: Record<string, RegExp[]> = {
    'food_and_dining': [
      /restaurant|cafe|coffee|bakery|diner|grill|pizza|sushi|thai|burger|sandwich|taco|food|dining/i,
      /starbucks|dunkin|mcdonalds|subway|chipotle|panera|wendy|domino/i
    ],
    'grocery': [
      /grocery|market|supermarket|food|produce/i,
      /kroger|safeway|publix|trader|whole foods|wegmans|aldi|costco/i
    ],
    'retail': [
      /store|shop|mall|retail|boutique|outlet/i,
      /target|walmart|amazon|bestbuy|ikea|home depot|lowes|macys|nordstrom/i
    ],
    'entertainment': [
      /cinema|movie|theater|concert|event|ticket|entertainment/i,
      /netflix|hulu|disney|spotify|apple|amc|regal/i
    ],
    'travel': [
      /hotel|motel|inn|resort|airbnb|airline|flight|travel|vacation/i,
      /marriott|hilton|hyatt|delta|united|southwest|expedia|booking/i
    ],
    'transportation': [
      /gas|fuel|station|car|auto|service|repair|oil|tire|uber|lyft|taxi|cab/i,
      /shell|exxon|chevron|bp|speedway|valero|marathon|uber|lyft/i
    ],
    'healthcare': [
      /pharmacy|drug|doctor|clinic|hospital|medical|dental|vision|health/i,
      /cvs|walgreens|rite aid|express scripts|optum|cigna|aetna/i
    ],
    'utilities': [
      /utility|electric|water|gas|power|energy|internet|cable|phone|bill/i,
      /comcast|xfinity|att|verizon|sprint|t-mobile|spectrum/i
    ]
  };
  
  // Check each category
  for (const [category, patterns] of Object.entries(categories)) {
    for (const pattern of patterns) {
      if (pattern.test(name)) {
        return category;
      }
    }
  }
  
  // Default category if no match
  return 'other';
}

/**
 * Extract line items from receipt text lines
 * @param lines Lines of text from receipt
 * @returns Array of items with name, price, and quantity
 */
function extractItems(lines: string[]) {
  const items: { name: string; price: number; quantity: number; category?: string }[] = [];
  
  // Set of regex patterns to match different item formats
  const itemPatterns = [
    // Standard format: Item name 2 x $9.99
    /(.+?)\s+(\d+(\.\d+)?)\s+[x@]\s+\$?(\d+(\.\d+)?)/i,
    
    // Alternative format: Item name $9.99
    /(.+?)\s+\$?(\d+\.\d{2})\s*$/i,
    
    // Format with quantity first: 2 x Item name $9.99
    /(\d+)\s*[x@]\s*(.+?)\s+\$?(\d+\.\d{2})\s*$/i
  ];
  
  for (const line of lines) {
    let matched = false;
    
    // Try each pattern until one matches
    for (const pattern of itemPatterns) {
      const match = line.match(pattern);
      
      if (match) {
        matched = true;
        
        // Extract data based on which pattern matched
        if (pattern === itemPatterns[0]) {
          // First pattern: Item name 2 x $9.99
          items.push({
            name: match[1].trim(),
            quantity: parseFloat(match[2]),
            price: parseFloat(match[4]),
            category: categorizeItem(match[1].trim())
          });
        } else if (pattern === itemPatterns[1]) {
          // Second pattern: Item name $9.99
          items.push({
            name: match[1].trim(),
            quantity: 1,
            price: parseFloat(match[2]),
            category: categorizeItem(match[1].trim())
          });
        } else if (pattern === itemPatterns[2]) {
          // Third pattern: 2 x Item name $9.99
          items.push({
            name: match[2].trim(),
            quantity: parseFloat(match[1]),
            price: parseFloat(match[3]),
            category: categorizeItem(match[2].trim())
          });
        }
        
        break; // Stop after first match
      }
    }
    
    // If none of the patterns matched but line contains a price, try simple extraction
    if (!matched && /\$?\d+\.\d{2}/.test(line)) {
      const priceMatch = line.match(/\$?(\d+\.\d{2})/);
      if (priceMatch) {
        const price = parseFloat(priceMatch[1]);
        
        // Remove the price from the line to get the item name
        const name = line.replace(/\$?\d+\.\d{2}/, '').trim();
        
        if (name && price > 0) {
          items.push({
            name,
            quantity: 1,
            price,
            category: categorizeItem(name)
          });
        }
      }
    }
  }
  
  return items;
}

/**
 * Parse raw receipt text into structured data
 * @param text Raw text from receipt
 * @returns Structured receipt data
 */
function parseReceipt(text: string) {
  // Split text into lines for processing
  const lines = text.split('\n').filter(line => line.trim() !== '');
  
  // Extract merchant name (usually first line or two)
  const merchantName = lines[0]?.trim() || 'Unknown Merchant';
  
  // Look for date
  const dateRegex = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/;
  const dateMatch = text.match(dateRegex);
  const date = dateMatch ? new Date(dateMatch[0]) : new Date();
  
  // Look for totals
  const totalRegex = /(?:total|amount|sum)[:\s]*[$]?(\d+\.\d{2})/i;
  const totalMatch = text.match(totalRegex);
  const total = totalMatch ? parseFloat(totalMatch[1]) : 0;
  
  // Look for tax
  const taxRegex = /(?:tax|vat|gst)[:\s]*[$]?(\d+\.\d{2})/i;
  const taxMatch = text.match(taxRegex);
  const tax = taxMatch ? parseFloat(taxMatch[1]) : 0;
  
  // Calculate subtotal
  const subtotal = total - tax;
  
  // Extract potential items
  const items = extractItems(lines);
  
  // Categorize merchant
  const category = categorizeMerchant(merchantName);
  
  return {
    merchantName: cleanMerchantName(merchantName),
    date: date.toISOString().split('T')[0],
    total,
    subtotal,
    tax,
    items,
    category,
    rawText: text
  };
}

/**
 * Extract text using Google Cloud Vision API
 * @param buffer Image buffer
 * @returns OCR result with text and confidence
 */
async function extractWithGoogleVision(buffer: Buffer): Promise<OCRResult> {
  try {
    // Call Google Cloud Vision API for document text detection
    const [result] = await visionClient.documentTextDetection({ 
      image: { content: buffer } 
    });
    
    // Extract the full text from the response
    const text = result.fullTextAnnotation?.text || '';
    
    // Calculate confidence from detected text blocks
    let confidence = 0;
    if (result.textAnnotations && result.textAnnotations.length > 0) {
      // Average confidence of all detected blocks
      const confidenceSum = result.textAnnotations.reduce((sum, annotation) => {
        return sum + (annotation.confidence || 0);
      }, 0);
      confidence = confidenceSum / result.textAnnotations.length;
    }
    
    logger.info(`Google Vision extracted ${text.length} characters with ${confidence.toFixed(2)} confidence`);
    
    return {
      text,
      confidence,
      source: 'google-vision'
    };
  } catch (error) {
    logger.error('Error in Google Vision OCR:', error);
    return {
      text: '',
      confidence: 0,
      source: 'failed'
    };
  }
}

/**
 * Extract text using Tesseract.js as fallback
 * @param buffer Image buffer
 * @returns OCR result with text and confidence
 */
async function extractWithTesseract(buffer: Buffer): Promise<OCRResult> {
  try {
    const result = await Tesseract.recognize(buffer, 'eng', {
      logger: message => {
        if (message.status === 'recognizing text') {
          logger.debug(`Tesseract progress: ${(message.progress * 100).toFixed(0)}%`);
        }
      }
    });
    
    logger.info(`Tesseract extracted ${result.data.text.length} characters with ${result.data.confidence / 100} confidence`);
    
    return {
      text: result.data.text,
      confidence: result.data.confidence / 100, // Convert to 0-1 scale
      source: 'tesseract'
    };
  } catch (error) {
    logger.error('Error in Tesseract OCR:', error);
    return {
      text: '',
      confidence: 0,
      source: 'failed'
    };
  }
}

/**
 * Master processReceipt method that combines extraction and parsing
 * with multi-layer fallback mechanisms
 * 
 * @param input Buffer or file path to process
 * @returns Structured receipt data with confidence score
 */
async function processReceipt(input: Buffer | string) {
  let imageBuffer: Buffer;
  
  // If input is a file path, read the file into a buffer
  if (typeof input === 'string') {
    try {
      imageBuffer = fs.readFileSync(input);
    } catch (error) {
      logger.error(`Error reading file at ${input}: ${error}`);
      throw new Error('Failed to read image file');
    }
  } else {
    imageBuffer = input;
  }
  
  // Increment total attempts counter
  ocrStats.totalAttempts++;
  
  try {
    // Try Google Cloud Vision first (primary method)
    const visionResult = await extractWithGoogleVision(imageBuffer);
    
    if (visionResult.confidence > 0.7 && visionResult.text.length > 50) {
      // Google Vision worked well
      ocrStats.googleVisionSuccess++;
      logger.info('Successfully processed receipt with Google Vision');
      
      // Parse the text into structured data
      const receiptData = parseReceipt(visionResult.text);
      return {
        ...receiptData,
        confidence: visionResult.confidence,
        ocrEngine: 'google-vision'
      };
    }
    
    // If Google Vision failed or had low confidence, try Tesseract
    logger.info('Google Vision results low quality, falling back to Tesseract');
    const tesseractResult = await extractWithTesseract(imageBuffer);
    
    if (tesseractResult.confidence > 0.5 && tesseractResult.text.length > 30) {
      // Tesseract worked well
      ocrStats.tesseractSuccess++;
      logger.info('Successfully processed receipt with Tesseract fallback');
      
      // Parse the text into structured data
      const receiptData = parseReceipt(tesseractResult.text);
      return {
        ...receiptData, 
        confidence: tesseractResult.confidence,
        ocrEngine: 'tesseract'
      };
    }
    
    // If both OCR engines failed, try manual parsing
    logger.warn('Both OCR engines failed, attempting emergency manual parsing');
    
    // Use basic receipt structure as fallback with empty/default values
    const manualParseData = {
      merchantName: 'Unknown Merchant',
      date: new Date().toISOString().split('T')[0],
      total: 0,
      subtotal: 0,
      tax: 0,
      items: [],
      confidence: 0.2,
      ocrEngine: 'manual-parse',
      rawText: visionResult.text || tesseractResult.text,
      needsReview: true,
      category: 'uncategorized'
    };
    
    ocrStats.manualParseSuccess++;
    logger.info('Using emergency manual parse fallback');
    
    return manualParseData;
    
  } catch (error) {
    // Log the complete OCR failure
    ocrStats.failures++;
    logger.error(`Complete OCR failure: ${error}`);
    
    // Return a basic structure with error information
    return {
      merchantName: 'Unknown Merchant',
      date: new Date().toISOString().split('T')[0],
      total: 0,
      subtotal: 0,
      tax: 0,
      items: [],
      confidence: 0,
      ocrEngine: 'failed',
      error: (error as Error).message,
      needsReview: true,
      category: 'error'
    };
  }
}

/**
 * Format currency amount
 * @param amount Amount to format
 * @param currency Currency code (default: USD)
 * @returns Formatted currency string
 */
export function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
}

/**
 * Format date
 * @param date Date to format
 * @param format Format type (default: 'short')
 * @returns Formatted date string
 */
export function formatDate(date: Date | string, format: 'short' | 'long' = 'short'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (format === 'long') {
    return dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  return dateObj.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Calculate tax amount from subtotal and tax rate
 * @param subtotal Subtotal amount
 * @param taxRate Tax rate as decimal (e.g., 0.0825 for 8.25%)
 * @returns Calculated tax amount
 */
export function calculateTax(subtotal: number, taxRate: number): number {
  return subtotal * taxRate;
}

/**
 * Validate receipt data
 * @param receipt Receipt data to validate
 * @returns Validation result
 */
export function validateReceipt(receipt: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for required fields
  if (!receipt.merchantName) {
    errors.push('Merchant name is required');
  }
  
  if (!receipt.date) {
    errors.push('Date is required');
  } else {
    // Validate date format
    const dateObj = new Date(receipt.date);
    if (isNaN(dateObj.getTime())) {
      errors.push('Invalid date format');
    }
  }
  
  if (typeof receipt.total !== 'number' || isNaN(receipt.total)) {
    errors.push('Total amount is required and must be a number');
  }
  
  // Validate items array if present
  if (receipt.items && Array.isArray(receipt.items)) {
    receipt.items.forEach((item: any, index: number) => {
      if (!item.name) {
        errors.push(`Item #${index + 1}: Name is required`);
      }
      
      if (typeof item.price !== 'number' || isNaN(item.price)) {
        errors.push(`Item #${index + 1}: Price must be a number`);
      }
      
      if (typeof item.quantity !== 'number' || isNaN(item.quantity)) {
        errors.push(`Item #${index + 1}: Quantity must be a number`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Determine receipt tier based on total amount spent
 * @param total Total receipt amount
 * @returns Tier object with ID, name, and benefits
 */
export function determineReceiptTier(total: number): {
  id: string;
  name: string;
  benefits: string[];
} {
  // Default to bronze tier
  let tier = {
    id: 'bronze',
    name: 'Bronze',
    benefits: ['Basic receipt storage', 'PDF exports']
  };
  
  // Determine tier based on total amount
  if (total >= 100) {
    tier = {
      id: 'platinum',
      name: 'Platinum',
      benefits: ['Premium receipt storage', 'Priority support', 'Analytics dashboard', 'API access', 'Warranty tracking']
    };
  } else if (total >= 50) {
    tier = {
      id: 'gold',
      name: 'Gold',
      benefits: ['Enhanced receipt storage', 'Priority support', 'Analytics dashboard', 'API access']
    };
  } else if (total >= 20) {
    tier = {
      id: 'silver',
      name: 'Silver',
      benefits: ['Enhanced receipt storage', 'Priority support', 'Analytics dashboard']
    };
  }
  
  return tier;
}

// Export OCR service object with all methods
export const ocrService = {
  processReceipt,
  extractWithGoogleVision,
  extractWithTesseract,
  parseReceipt,
  cleanMerchantName,
  formatCurrency,
  formatDate,
  calculateTax,
  validateReceipt,
  categorizeItem,
  categorizeMerchant,
  getOcrStats: () => ocrStats
};