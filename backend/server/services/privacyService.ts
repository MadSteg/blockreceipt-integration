/**
 * Privacy Service for BlockReceipt
 * 
 * Handles sanitization of receipt data to protect user privacy
 * while maintaining useful context for NFT generation
 */

export interface ReceiptData {
  merchantName: string;
  totalCents: number;
  timestamp: number;
  location?: string;
  items: Array<{
    qty: number;
    desc: string;
    price: number;
  }>;
  paymentLast4?: string;
}

export interface SanitizedReceiptData {
  merchantName: string;
  totalCents: number;
  timestamp: number;
  location?: string;
  items: Array<{
    qty: number;
    desc: string;
    price: number;
    category: string;
    isSensitive: boolean;
  }>;
  paymentLast4?: string;
  safePrompt: string;
  privacyLevel: 'high' | 'medium' | 'low';
}

export class PrivacyService {
  private static readonly SENSITIVE_KEYWORDS = [
    // Personal items
    'underwear', 'lingerie', 'bra', 'panties', 'thong', 'briefs', 'boxers',
    'condom', 'lubricant', 'personal care', 'intimate',
    
    // Medical/Health
    'pharmacy', 'medication', 'prescription', 'medical', 'health',
    'pregnancy test', 'contraceptive', 'viagra', 'cialis',
    
    // Adult content
    'adult', 'sex', 'porn', 'adult entertainment', 'adult store',
    
    // Sensitive purchases
    'alcohol', 'beer', 'wine', 'liquor', 'tobacco', 'cigarettes', 'cigar',
    'gambling', 'lottery', 'casino', 'betting',
    
    // Financial
    'cash advance', 'money order', 'check cashing', 'pawn',
    
    // Location sensitive
    'therapy', 'counseling', 'psychiatrist', 'psychologist',
    'lawyer', 'attorney', 'legal', 'court'
  ];

  private static readonly CATEGORY_MAPPINGS = {
    // Food categories
    'food': ['food', 'grocery', 'produce', 'meat', 'dairy', 'bakery', 'deli'],
    'beverages': ['drink', 'beverage', 'soda', 'juice', 'water', 'coffee', 'tea'],
    'snacks': ['snack', 'chips', 'candy', 'chocolate', 'cookies', 'crackers'],
    
    // Fashion categories
    'clothing': ['clothing', 'shirt', 'pants', 'dress', 'jacket', 'sweater', 'jeans'],
    'accessories': ['accessories', 'jewelry', 'watch', 'bag', 'purse', 'belt', 'hat'],
    'shoes': ['shoes', 'sneakers', 'boots', 'sandals', 'heels', 'flats'],
    
    // Tech categories
    'electronics': ['electronics', 'phone', 'computer', 'laptop', 'tablet', 'camera'],
    'gadgets': ['gadgets', 'headphones', 'speaker', 'charger', 'cable', 'adapter'],
    
    // Home categories
    'home': ['home', 'furniture', 'decor', 'kitchen', 'bathroom', 'bedroom'],
    'cleaning': ['cleaning', 'detergent', 'soap', 'shampoo', 'toilet paper'],
    
    // General categories
    'general': ['general', 'miscellaneous', 'other', 'unknown']
  };

  /**
   * Sanitize receipt data to protect user privacy
   */
  static sanitizeReceiptData(receipt: ReceiptData): SanitizedReceiptData {
    const sanitizedItems = receipt.items.map(item => {
      const isSensitive = this.isSensitiveItem(item.desc);
      const category = this.categorizeItem(item.desc);
      
      return {
        qty: item.qty,
        desc: isSensitive ? this.getGenericDescription(category) : item.desc,
        price: isSensitive ? Math.floor(item.price / 10) * 10 : item.price, // Round to nearest $0.10
        category,
        isSensitive
      };
    });

    const privacyLevel = this.determinePrivacyLevel(sanitizedItems);
    const safePrompt = this.generateSafePrompt(receipt.merchantName, sanitizedItems, privacyLevel);

    return {
      ...receipt,
      items: sanitizedItems,
      safePrompt,
      privacyLevel
    };
  }

  /**
   * Check if an item description contains sensitive keywords
   */
  private static isSensitiveItem(description: string): boolean {
    const lowerDesc = description.toLowerCase();
    return this.SENSITIVE_KEYWORDS.some(keyword => 
      lowerDesc.includes(keyword)
    );
  }

  /**
   * Categorize an item based on its description
   */
  private static categorizeItem(description: string): string {
    const lowerDesc = description.toLowerCase();
    
    for (const [category, keywords] of Object.entries(this.CATEGORY_MAPPINGS)) {
      if (keywords.some(keyword => lowerDesc.includes(keyword))) {
        return category;
      }
    }
    
    return 'general';
  }

  /**
   * Get a generic description for sensitive items
   */
  private static getGenericDescription(category: string): string {
    const genericDescriptions = {
      'clothing': 'Clothing Item',
      'accessories': 'Fashion Accessory',
      'shoes': 'Footwear',
      'electronics': 'Electronic Device',
      'gadgets': 'Tech Accessory',
      'home': 'Home Item',
      'cleaning': 'Personal Care Item',
      'general': 'Personal Item'
    };
    
    return genericDescriptions[category] || 'Personal Item';
  }

  /**
   * Determine privacy level based on sensitive items
   */
  private static determinePrivacyLevel(items: any[]): 'high' | 'medium' | 'low' {
    const sensitiveCount = items.filter(item => item.isSensitive).length;
    const totalItems = items.length;
    const sensitiveRatio = sensitiveCount / totalItems;
    
    if (sensitiveRatio > 0.5) return 'high';
    if (sensitiveRatio > 0.2) return 'medium';
    return 'low';
  }

  /**
   * Generate a safe prompt for DALL-E 3 that protects privacy
   */
  private static generateSafePrompt(
    merchantName: string, 
    items: any[], 
    privacyLevel: 'high' | 'medium' | 'low'
  ): string {
    const basePrompt = `A cute receipt-themed NFT character for ${merchantName}. ` +
      `Cartoon style, high quality, professional art similar to Hypurr collection. ` +
      `Clean, modern design with vibrant colors, consistent with popular NFT collections. ` +
      `No text, just the character artwork.`;

    if (privacyLevel === 'high') {
      return basePrompt + ` Character should be surrounded by general merchandise and shopping items.`;
    }

    if (privacyLevel === 'medium') {
      const categories = [...new Set(items.map(item => item.category))];
      const categoryText = categories.join(', ');
      return basePrompt + ` Character should be surrounded by: ${categoryText}.`;
    }

    // Low privacy level - can include more specific items
    const safeItems = items
      .filter(item => !item.isSensitive)
      .slice(0, 3)
      .map(item => `${item.qty}x ${item.desc}`)
      .join(', ');
    
    if (safeItems) {
      return basePrompt + ` Character should be holding or surrounded by: ${safeItems}.`;
    }
    
    return basePrompt + ` Character should be surrounded by shopping items and merchandise.`;
  }

  /**
   * Get privacy summary for user
   */
  static getPrivacySummary(sanitizedReceipt: SanitizedReceiptData): string {
    const sensitiveCount = sanitizedReceipt.items.filter(item => item.isSensitive).length;
    const totalItems = sanitizedReceipt.items.length;
    
    if (sensitiveCount === 0) {
      return `✅ All items are safe to include in your NFT prompt.`;
    }
    
    return `🔒 ${sensitiveCount} of ${totalItems} items were sanitized for privacy. ` +
      `Your NFT will use generic categories instead of specific items.`;
  }
}
