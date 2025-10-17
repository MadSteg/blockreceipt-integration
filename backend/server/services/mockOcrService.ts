/**
 * Mock OCR Service for Receipt Scanning
 * 
 * This service provides mock data for receipt scanning when OpenAI API is unavailable
 */

import { createHash } from 'crypto';
import { ExtractedReceiptData } from './ocrService';

// Sample receipt data for demo purposes
const MOCK_RECEIPTS: ExtractedReceiptData[] = [
  {
    merchantName: "CVS Pharmacy",
    date: "2025-05-14",
    items: [
      { name: "Shampoo", price: 799, quantity: 1 },
      { name: "Twix", price: 159, quantity: 2 },
      { name: "Hand Sanitizer", price: 399, quantity: 1 }
    ],
    subtotal: 1316,
    tax: 104,
    total: 1420,
    category: "retail",
    confidence: 0.9,
    rawText: "CVS Pharmacy\n123 Main St\nYour Town, ST 12345\n\nShampoo $7.99\nTwix $1.59 x 2\nHand Sanitizer $3.99\n\nSubtotal $13.16\nTax $1.04\nTotal $14.20"
  },
  {
    merchantName: "Whole Foods Market",
    date: "2025-05-12",
    items: [
      { name: "Organic Bananas", price: 249, quantity: 1 },
      { name: "Almond Milk", price: 399, quantity: 1 },
      { name: "Avocado", price: 199, quantity: 3 },
      { name: "Granola", price: 549, quantity: 1 }
    ],
    subtotal: 1794,
    tax: 107,
    total: 1901,
    category: "groceries",
    confidence: 0.92,
    rawText: "Whole Foods Market\n456 Green St\nYour Town, ST 12345\n\nOrganic Bananas $2.49\nAlmond Milk $3.99\nAvocado $1.99 x 3\nGranola $5.49\n\nSubtotal $17.94\nTax $1.07\nTotal $19.01"
  },
  {
    merchantName: "Apple Store",
    date: "2025-05-10",
    items: [
      { name: "Lightning Cable", price: 1999, quantity: 1 },
      { name: "AirTag", price: 2999, quantity: 1 },
      { name: "AppleCare+ Extension", price: 7999, quantity: 1 }
    ],
    subtotal: 12997,
    tax: 1040,
    total: 14037,
    category: "electronics",
    confidence: 0.95,
    rawText: "Apple Store\n789 Tech Blvd\nYour Town, ST 12345\n\nLightning Cable $19.99\nAirTag $29.99\nAppleCare+ Extension $79.99\n\nSubtotal $129.97\nTax $10.40\nTotal $140.37"
  },
  {
    merchantName: "Starbucks",
    date: "2025-05-14",
    items: [
      { name: "Venti Latte", price: 599, quantity: 1 },
      { name: "Blueberry Muffin", price: 349, quantity: 1 }
    ],
    subtotal: 948,
    tax: 76,
    total: 1024,
    category: "dining",
    confidence: 0.89,
    rawText: "Starbucks\n321 Coffee Lane\nYour Town, ST 12345\n\nVenti Latte $5.99\nBlueberry Muffin $3.49\n\nSubtotal $9.48\nTax $0.76\nTotal $10.24"
  },
  {
    merchantName: "Best Buy",
    date: "2025-05-08",
    items: [
      { name: "Wireless Earbuds", price: 12999, quantity: 1 },
      { name: "HDMI Cable", price: 1999, quantity: 1 },
      { name: "Smartphone Case", price: 3999, quantity: 1 }
    ],
    subtotal: 18997,
    tax: 1520,
    total: 20517,
    category: "electronics",
    confidence: 0.93,
    rawText: "Best Buy\n555 Electronics Way\nYour Town, ST 12345\n\nWireless Earbuds $129.99\nHDMI Cable $19.99\nSmartphone Case $39.99\n\nSubtotal $189.97\nTax $15.20\nTotal $205.17"
  },
  {
    merchantName: "Amazon",
    date: "2025-05-05",
    items: [
      { name: "Kindle Paperwhite", price: 13999, quantity: 1 },
      { name: "Book: Blockchain Future", price: 1499, quantity: 1 },
      { name: "USB-C Hub", price: 2499, quantity: 1 }
    ],
    subtotal: 17997,
    tax: 1440,
    total: 19437,
    category: "retail",
    confidence: 0.91,
    rawText: "Amazon\nOrder #123-4567-89\nDIGITAL RECEIPT\n\nKindle Paperwhite $139.99\nBook: Blockchain Future $14.99\nUSB-C Hub $24.99\n\nSubtotal $179.97\nTax $14.40\nTotal $194.37"
  },
  {
    merchantName: "Trader Joe's",
    date: "2025-05-13",
    items: [
      { name: "Frozen Dumplings", price: 399, quantity: 1 },
      { name: "Greek Yogurt", price: 499, quantity: 2 },
      { name: "Everything Bagel Seasoning", price: 299, quantity: 1 },
      { name: "Organic Raspberries", price: 499, quantity: 1 }
    ],
    subtotal: 1795,
    tax: 90,
    total: 1885,
    category: "groceries",
    confidence: 0.88,
    rawText: "Trader Joe's\n444 Grocery Ave\nYour Town, ST 12345\n\nFrozen Dumplings $3.99\nGreek Yogurt $4.99 x 2\nEverything Bagel Seasoning $2.99\nOrganic Raspberries $4.99\n\nSubtotal $17.95\nTax $0.90\nTotal $18.85"
  }
];

/**
 * Get a random mock receipt or generate one based on image hash
 * 
 * @param imageBase64 Base64 encoded image data
 * @returns Extracted receipt data
 */
export async function getMockReceiptData(imageBase64: string): Promise<ExtractedReceiptData> {
  // Generate a deterministic hash from the image data
  const imageHash = createHash('sha256')
    .update(imageBase64.substring(0, 1000)) // Using first 1000 chars
    .digest('hex');
  
  // Use the hash to pick a receipt (pseudo-random but deterministic)
  const hashNum = parseInt(imageHash.substring(0, 8), 16);
  const index = hashNum % MOCK_RECEIPTS.length;
  
  // Return a copy of the mock receipt to avoid mutations
  return JSON.parse(JSON.stringify(MOCK_RECEIPTS[index]));
}

/**
 * Mock category inference
 * 
 * @param merchantName Name of the merchant
 * @param items List of purchased items
 * @returns Inferred category
 */
export async function mockInferCategory(
  merchantName: string, 
  items: Array<{name: string; price: number}>
): Promise<string> {
  // Simple merchant-based category mapping
  const merchantCategories: Record<string, string> = {
    'cvs': 'retail',
    'pharmacy': 'health',
    'target': 'retail',
    'walmart': 'retail',
    'whole': 'groceries',
    'trader': 'groceries',
    'kroger': 'groceries',
    'safeway': 'groceries',
    'amazon': 'retail',
    'best buy': 'electronics',
    'apple': 'electronics',
    'starbucks': 'dining',
    'mcdonalds': 'dining',
    'restaurant': 'dining',
    'cafe': 'dining',
    'gas': 'travel',
    'shell': 'travel',
    'hotel': 'travel',
    'airline': 'travel',
    'uber': 'travel',
    'lyft': 'travel'
  };
  
  // Check if merchant name contains any of our category keywords
  const lowercaseMerchant = merchantName.toLowerCase();
  for (const [keyword, category] of Object.entries(merchantCategories)) {
    if (lowercaseMerchant.includes(keyword)) {
      return category;
    }
  }
  
  // Default category
  return 'other';
}

export default {
  getMockReceiptData,
  mockInferCategory
};