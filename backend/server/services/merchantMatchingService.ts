import fs from 'fs';
import path from 'path';

export interface Merchant {
  merchantId: string;
  regex: string;
  cityCode: string;
  defaultPromoTemplate: string;
}

export interface PromoTemplate {
  merchantId: string;
  title: string;
  code: string;
  rules: {
    category: string;
    minSpend: number;
  };
  percentOff?: number;
  amountOff?: number;
  bonusRewards?: string;
  freeItem?: string;
  description?: string;
  expiresDays: number;
  isActive: boolean;
}

export interface ReceiptFingerprint {
  merchantName: string;
  storeNumber?: string;
  subtotal: number;
  total: number;
  timestamp: number;
  items?: Array<{
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }>;
}

class MerchantMatchingService {
  private merchants: Merchant[] = [];
  private promoTemplates: PromoTemplate[] = [];
  private initialized = false;

  constructor() {
    this.loadData();
  }

  private loadData() {
    try {
      // Load merchant directory
      const merchantsPath = path.join(process.cwd(), 'data', 'merchantDirectory.json');
      if (fs.existsSync(merchantsPath)) {
        const merchantData = fs.readFileSync(merchantsPath, 'utf-8');
        this.merchants = JSON.parse(merchantData);
      } else {
        console.warn('[MerchantMatching] Merchant directory file not found:', merchantsPath);
      }

      // Load promo templates
      const promosPath = path.join(process.cwd(), 'data', 'promoTemplates.json');
      if (fs.existsSync(promosPath)) {
        const promoData = fs.readFileSync(promosPath, 'utf-8');
        this.promoTemplates = JSON.parse(promoData);
      } else {
        console.warn('[MerchantMatching] Promo templates file not found:', promosPath);
      }

      this.initialized = true;
      console.log(`[MerchantMatching] Service initialized with ${this.merchants.length} merchants and ${this.promoTemplates.length} promo templates`);
    } catch (error) {
      console.error('[MerchantMatching] Error loading merchant data:', error);
    }
  }

  /**
   * Match a merchant name from a receipt to a merchant in the directory
   * @param merchantName The merchant name from the receipt
   * @returns The matched merchant or null if no match found
   */
  public matchMerchant(merchantName: string): Merchant | null {
    if (!this.initialized || !merchantName) {
      return null;
    }

    // Normalize the merchant name for better matching
    const normalizedName = merchantName.trim().toUpperCase();

    // Try to find a match using regex patterns
    for (const merchant of this.merchants) {
      try {
        const regex = new RegExp(merchant.regex, 'i');
        if (regex.test(normalizedName)) {
          return merchant;
        }
      } catch (error) {
        console.error(`[MerchantMatching] Invalid regex pattern for ${merchant.merchantId}:`, error);
      }
    }

    return null;
  }

  /**
   * Find an applicable promo template for a given merchant and receipt data
   * @param merchantId The merchant ID
   * @param receiptData Optional receipt data for rule-based matching
   * @returns The matched promo template or null if no match found
   */
  public findApplicablePromo(merchantId: string, receiptData?: ReceiptFingerprint): PromoTemplate | null {
    if (!this.initialized || !merchantId) {
      return null;
    }

    // Filter promos by merchant and active status
    const merchantPromos = this.promoTemplates.filter(
      promo => promo.merchantId === merchantId && promo.isActive
    );

    if (merchantPromos.length === 0) {
      return null;
    }

    // If receipt data is provided, try to match based on rules
    if (receiptData) {
      // First try to match rules (category & min spend)
      const matchingPromos = merchantPromos.filter(promo => {
        // Check for minimum spend requirement
        if (receiptData.total < promo.rules.minSpend) {
          return false;
        }

        // If category is "Any" or receipt items match category
        if (promo.rules.category.toLowerCase() === 'any') {
          return true;
        }

        // If we have receipt items with categories, try to match them
        if (receiptData.items && receiptData.items.length > 0) {
          return receiptData.items.some(item => 
            item.category && 
            item.category.toLowerCase().includes(promo.rules.category.toLowerCase())
          );
        }

        return false;
      });

      if (matchingPromos.length > 0) {
        // Return the first matching promo, or we could add logic to return the "best" one
        return matchingPromos[0];
      }
    }

    // If no specific matching promo found or no receipt data provided, 
    // return the merchant's default promo template
    const merchant = this.merchants.find(m => m.merchantId === merchantId);
    if (merchant) {
      const defaultPromo = this.promoTemplates.find(
        p => p.code === merchant.defaultPromoTemplate && p.isActive
      );
      return defaultPromo || null;
    }

    // As a last resort, return the first active promo for this merchant
    return merchantPromos[0] || null;
  }

  /**
   * Create a coupon from a promo template with an expiration date
   * @param promoTemplate The promo template
   * @returns A coupon with expiration date
   */
  public createCouponFromTemplate(promoTemplate: PromoTemplate): any {
    if (!promoTemplate) {
      return null;
    }

    const now = Date.now();
    const expiration = now + (promoTemplate.expiresDays * 24 * 60 * 60 * 1000); // Convert days to ms

    return {
      merchantId: promoTemplate.merchantId,
      title: promoTemplate.title,
      code: promoTemplate.code,
      percentOff: promoTemplate.percentOff,
      amountOff: promoTemplate.amountOff,
      bonusRewards: promoTemplate.bonusRewards,
      freeItem: promoTemplate.freeItem,
      description: promoTemplate.description,
      issuedAt: now,
      expiresAt: expiration,
      used: false
    };
  }

  /**
   * Generate a receipt fingerprint from OCR data
   * @param ocrData The OCR data from receipt recognition
   * @returns A receipt fingerprint for merchant matching
   */
  public createReceiptFingerprint(ocrData: any): ReceiptFingerprint {
    // Extract basic info
    const merchantName = ocrData.merchantName || '';
    const subtotal = ocrData.subtotal || 0;
    const total = ocrData.total || 0;
    const timestamp = ocrData.timestamp || Date.now();

    // Extract store number if available
    let storeNumber = undefined;
    if (ocrData.storeNumber) {
      storeNumber = ocrData.storeNumber;
    } else if (ocrData.storeId) {
      storeNumber = ocrData.storeId;
    }

    // Extract item info if available
    let items = undefined;
    if (ocrData.items && Array.isArray(ocrData.items)) {
      items = ocrData.items.map((item: any) => ({
        name: item.name || 'Unknown Item',
        price: item.price || 0,
        quantity: item.quantity || 1,
        category: item.category || undefined
      }));
    }

    return {
      merchantName,
      storeNumber,
      subtotal,
      total,
      timestamp,
      items
    };
  }

  /**
   * Process a receipt and generate applicable coupons
   * @param receiptData Receipt data from OCR
   * @returns Applicable coupons for this receipt
   */
  public processReceiptForCoupons(receiptData: any): any[] {
    if (!receiptData || !receiptData.merchantName) {
      return [];
    }

    const fingerprint = this.createReceiptFingerprint(receiptData);
    const merchant = this.matchMerchant(fingerprint.merchantName);

    if (!merchant) {
      return [];
    }

    const promoTemplate = this.findApplicablePromo(merchant.merchantId, fingerprint);
    
    if (!promoTemplate) {
      return [];
    }

    const coupon = this.createCouponFromTemplate(promoTemplate);
    return coupon ? [coupon] : [];
  }

  /**
   * Get all merchants in the directory
   * @returns Array of all merchants
   */
  public getAllMerchants(): Merchant[] {
    return [...this.merchants];
  }

  /**
   * Get all promo templates
   * @returns Array of all promo templates
   */
  public getAllPromoTemplates(): PromoTemplate[] {
    return [...this.promoTemplates];
  }

  /**
   * Get promo templates for a specific merchant
   * @param merchantId The merchant ID
   * @returns Array of promo templates for the merchant
   */
  public getMerchantPromoTemplates(merchantId: string): PromoTemplate[] {
    return this.promoTemplates.filter(promo => promo.merchantId === merchantId);
  }
}

export const merchantMatchingService = new MerchantMatchingService();