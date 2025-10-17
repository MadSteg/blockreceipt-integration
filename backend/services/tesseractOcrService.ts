/**
 * Tesseract OCR Service
 * 
 * This service provides local OCR capabilities using Tesseract.js and node-tesseract-ocr
 * as a backup/fallback when OpenAI's GPT-4o Vision API is unavailable or fails.
 */

import { createWorker } from 'tesseract.js';
import * as nodeTesseract from 'node-tesseract-ocr';
import fs from 'fs';
import path from 'path';
import { ExtractedReceiptData } from '../../shared/schema';

// Temporary directory for image processing
const TEMP_DIR = path.join(process.cwd(), 'tmp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Configuration for node-tesseract-ocr
const nodeTesseractConfig = {
  lang: 'eng',
  oem: 1,
  psm: 3,
};

// Regular expressions for receipt data extraction
const MERCHANT_REGEX = /^([A-Z][A-Za-z\s'&,.]+)(?:\n|$)/;
const DATE_REGEX = /(?:\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})|(?:\d{2,4}[-\/]\d{1,2}[-\/]\d{1,2})/;
const TOTAL_REGEX = /(?:total|amount|sum|due)(?:[^0-9]*)([$]?\s*\d+\.\d{2})/i;
const TAX_REGEX = /(?:tax|vat|gst|sales\s+tax)(?:[^0-9]*)([$]?\s*\d+\.\d{2})/i;
const SUBTOTAL_REGEX = /(?:subtotal|sub-total|sub total)(?:[^0-9]*)([$]?\s*\d+\.\d{2})/i;

// Multiple item detection patterns
const ITEM_LINE_REGEX_1 = /([A-Za-z0-9\s-'&,.]+)(?:\s+)(\d+)(?:\s+)([$]?\s*\d+\.\d{2})/i;  // Item name, quantity, price
const ITEM_LINE_REGEX_2 = /([A-Za-z0-9\s-'&,.]+)(?:\s+)([$]?\s*\d+\.\d{2})/i;  // Item name, price only
const ITEM_LINE_REGEX_3 = /(\d+)\s+x\s+([$]?\s*\d+\.\d{2})\s+([A-Za-z0-9\s-'&,.]+)/i;  // Quantity x price item name

/**
 * Extract receipt data using Tesseract.js
 * @param imageBase64 Base64 encoded image
 * @returns Extracted receipt data or null if extraction failed
 */
export async function extractWithTesseractJs(imageBase64: string): Promise<ExtractedReceiptData | null> {
  try {
    // Save base64 image to temp file
    const imagePath = path.join(TEMP_DIR, `temp_${Date.now()}.png`);
    const imageBuffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    fs.writeFileSync(imagePath, imageBuffer);

    // Create Tesseract worker
    const worker = await createWorker('eng');
    
    // Recognize text
    const { data } = await worker.recognize(imagePath);
    
    // Terminate worker
    await worker.terminate();
    
    // Delete temp file
    try {
      fs.unlinkSync(imagePath);
    } catch (error) {
      console.warn('Failed to delete temp file:', error);
    }
    
    // Extract data from OCR text
    return extractDataFromOcrText(data.text, data.confidence / 100);
  } catch (error) {
    console.error('Tesseract.js OCR error:', error);
    return null;
  }
}

/**
 * Extract receipt data using node-tesseract-ocr as a second fallback
 * This is used if Tesseract.js fails or is unavailable
 * @param imageBase64 Base64 encoded image
 * @returns Extracted receipt data or null if extraction failed
 */
export async function extractWithNodeTesseract(imageBase64: string): Promise<ExtractedReceiptData | null> {
  try {
    // Save base64 image to temp file
    const imagePath = path.join(TEMP_DIR, `temp_${Date.now()}.png`);
    const imageBuffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
    fs.writeFileSync(imagePath, imageBuffer);

    // Recognize text using node-tesseract-ocr
    const text = await nodeTesseract.recognize(imagePath, nodeTesseractConfig);
    
    // Delete temp file
    try {
      fs.unlinkSync(imagePath);
    } catch (error) {
      console.warn('Failed to delete temp file:', error);
    }
    
    // Extract data from OCR text (using a lower confidence value since node-tesseract doesn't provide one)
    return extractDataFromOcrText(text, 0.6);
  } catch (error) {
    console.error('node-tesseract-ocr error:', error);
    return null;
  }
}

/**
 * Extract structured receipt data from OCR text
 * @param text OCR extracted text
 * @param confidence Confidence level of the OCR extraction
 * @returns Structured receipt data
 */
function extractDataFromOcrText(text: string, confidence: number): ExtractedReceiptData {
  // Default values
  const result: ExtractedReceiptData = {
    merchantName: "Unknown Merchant",
    date: new Date().toISOString().split('T')[0],
    items: [],
    subtotal: 0,
    tax: 0,
    total: 0,
    confidence: confidence,
    rawText: text
  };
  
  // Extract merchant name (usually first line)
  const merchantMatch = text.match(MERCHANT_REGEX);
  if (merchantMatch && merchantMatch[1]) {
    result.merchantName = merchantMatch[1].trim();
  }
  
  // Extract date
  const dateMatch = text.match(DATE_REGEX);
  if (dateMatch && dateMatch[0]) {
    // Format the date consistently
    const dateStr = dateMatch[0].trim();
    try {
      const dateParts = dateStr.split(/[-\/]/);
      if (dateParts.length === 3) {
        // Handle different date formats based on length of components
        let year, month, day;
        
        if (dateParts[2].length === 4) {
          // Format: MM/DD/YYYY
          month = dateParts[0].padStart(2, '0');
          day = dateParts[1].padStart(2, '0');
          year = dateParts[2];
        } else if (dateParts[0].length === 4) {
          // Format: YYYY/MM/DD
          year = dateParts[0];
          month = dateParts[1].padStart(2, '0');
          day = dateParts[2].padStart(2, '0');
        } else {
          // Default format: MM/DD/YY
          month = dateParts[0].padStart(2, '0');
          day = dateParts[1].padStart(2, '0');
          year = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
        }
        
        result.date = `${year}-${month}-${day}`;
      }
    } catch (e) {
      console.warn('Error parsing date, using default:', e);
    }
  }
  
  // Extract total amount
  const totalMatch = text.match(TOTAL_REGEX);
  if (totalMatch && totalMatch[1]) {
    const totalStr = totalMatch[1].replace(/[$\s]/g, '');
    result.total = parseFloat(totalStr) * 100; // Convert to cents
  }
  
  // Extract tax amount
  const taxMatch = text.match(TAX_REGEX);
  if (taxMatch && taxMatch[1]) {
    const taxStr = taxMatch[1].replace(/[$\s]/g, '');
    result.tax = parseFloat(taxStr) * 100; // Convert to cents
  }
  
  // Extract subtotal
  const subtotalMatch = text.match(SUBTOTAL_REGEX);
  if (subtotalMatch && subtotalMatch[1]) {
    const subtotalStr = subtotalMatch[1].replace(/[$\s]/g, '');
    result.subtotal = parseFloat(subtotalStr) * 100; // Convert to cents
  } else if (result.total > 0 && result.tax >= 0) {
    // Calculate subtotal if not found directly
    result.subtotal = result.total - result.tax;
  }
  
  // Extract items with multiple regex patterns
  const lines = text.split('\n');
  const items: Array<{name: string, price: number, quantity: number}> = [];
  
  for (const line of lines) {
    // Skip likely header or summary lines
    if (line.match(/total|subtotal|tax|amount|receipt|date|time|thank|welcome/i)) {
      continue;
    }

    // First pattern: Item name, quantity, price
    let match = line.match(ITEM_LINE_REGEX_1);
    if (match && match.length >= 4) {
      const name = match[1].trim();
      const quantity = parseInt(match[2].trim(), 10) || 1;
      const priceStr = match[3].replace(/[$\s]/g, '');
      const price = parseFloat(priceStr) * 100; // Convert to cents
      
      if (name && price > 0) { // Validate item has a name and price
        items.push({ name, quantity, price });
        continue;
      }
    }
    
    // Second pattern: Item name, price (assume quantity 1)
    match = line.match(ITEM_LINE_REGEX_2);
    if (match && match.length >= 3) {
      const name = match[1].trim();
      const priceStr = match[2].replace(/[$\s]/g, '');
      const price = parseFloat(priceStr) * 100; // Convert to cents
      
      if (name && price > 0 && name.length > 1) { // Validate item has a name and price
        items.push({ name, quantity: 1, price });
        continue;
      }
    }
    
    // Third pattern: Quantity x price item name
    match = line.match(ITEM_LINE_REGEX_3);
    if (match && match.length >= 4) {
      const quantity = parseInt(match[1].trim(), 10) || 1;
      const priceStr = match[2].replace(/[$\s]/g, '');
      const price = parseFloat(priceStr) * 100; // Convert to cents
      const name = match[3].trim();
      
      if (name && price > 0) { // Validate item has a name and price
        items.push({ name, quantity, price });
      }
    }
  }
  
  // Additional validation to filter out non-item lines
  const validItems = items.filter(item => {
    // Filter out items with very short names or unrealistic prices
    return item.name.length > 1 && 
           item.price > 0 && 
           item.price < 1000000 && // $10,000 max for single item
           !item.name.match(/^[0-9.]+$/); // Name shouldn't be just numbers
  });
  
  // Only use extracted items if we found some, otherwise leave as empty array
  if (validItems.length > 0) {
    result.items = validItems;
  }
  
  // Ensure total is calculated if missing
  if (result.total === 0 && result.subtotal > 0) {
    result.total = result.subtotal + result.tax;
  }
  
  return result;
}

/**
 * Infer receipt category based on merchant name and items
 * This is a simple rule-based categorization system as fallback
 * 
 * @param merchantName The name of the merchant
 * @param items Array of item objects with names
 * @returns The inferred category
 */
export function inferCategoryFromText(
  merchantName: string, 
  items: Array<{name: string, price?: number}>
): string {
  const merchant = merchantName.toLowerCase();
  const itemText = items.map(item => item.name.toLowerCase()).join(' ');
  const fullText = `${merchant} ${itemText}`;
  
  // Define category keywords
  const categories = {
    'groceries': ['grocery', 'supermarket', 'food', 'market', 'produce', 'organic', 'farm', 'fruit', 'vegetable', 'meat', 'dairy', 'bakery'],
    'dining': ['restaurant', 'cafe', 'diner', 'bistro', 'grill', 'eatery', 'pizzeria', 'steakhouse', 'sushi', 'coffee', 'bar', 'pub'],
    'shopping': ['mall', 'store', 'retail', 'outlet', 'boutique', 'shop', 'clothing', 'fashion', 'apparel', 'shoes', 'accessories'],
    'electronics': ['electronics', 'computer', 'digital', 'tech', 'technology', 'device', 'hardware', 'software', 'phone', 'laptop', 'tablet'],
    'entertainment': ['cinema', 'movie', 'theater', 'concert', 'event', 'show', 'ticket', 'game', 'play', 'admission', 'recreation'],
    'health': ['pharmacy', 'drug', 'medicine', 'prescription', 'health', 'medical', 'clinic', 'hospital', 'doctor', 'dental', 'vitamin'],
    'beauty': ['salon', 'spa', 'beauty', 'cosmetic', 'hair', 'nail', 'makeup', 'skincare', 'barber', 'grooming'],
    'transport': ['gas', 'fuel', 'petrol', 'parking', 'transport', 'transit', 'travel', 'taxi', 'uber', 'lyft', 'ride', 'toll'],
    'utilities': ['utility', 'electric', 'water', 'gas', 'power', 'energy', 'bill', 'phone', 'internet', 'cable', 'subscription'],
    'home': ['furniture', 'home', 'decor', 'house', 'garden', 'kitchen', 'bath', 'bed', 'appliance', 'improvement', 'hardware', 'tool']
  };
  
  // Check merchant name first (weighted more heavily)
  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      // Check if merchant name contains the keyword
      if (merchant.includes(keyword)) {
        return category;
      }
    }
  }
  
  // Check full text for matches and count occurrences
  const matchCounts: Record<string, number> = {};
  
  for (const [category, keywords] of Object.entries(categories)) {
    matchCounts[category] = 0;
    
    for (const keyword of keywords) {
      // Count occurrences of each keyword in the full text
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = fullText.match(regex);
      
      if (matches) {
        matchCounts[category] += matches.length;
      }
    }
  }
  
  // Find category with most matches
  let bestCategory = 'other';
  let maxMatches = 0;
  
  for (const [category, count] of Object.entries(matchCounts)) {
    if (count > maxMatches) {
      maxMatches = count;
      bestCategory = category;
    }
  }
  
  // Only return non-other if we have at least one match
  return maxMatches > 0 ? bestCategory : 'other';
}