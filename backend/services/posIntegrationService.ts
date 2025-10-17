/**
 * POS Integration Service for BlockReceipt
 * 
 * Handles integration with various Point of Sale systems
 * to automatically trigger NFT generation from receipt data
 */

export interface POSReceiptData {
  merchantName: string;
  merchantId: string;
  receiptNumber: string;
  totalCents: number;
  subtotalCents: number;
  taxCents: number;
  timestamp: number;
  location: {
    address: string;
    city: string;
    state: string;
    zipCode: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  items: Array<{
    sku: string;
    name: string;
    description: string;
    qty: number;
    unitPrice: number;
    totalPrice: number;
    category: string;
    department: string;
  }>;
  payment: {
    method: 'cash' | 'card' | 'mobile' | 'crypto';
    last4?: string;
    cardType?: string;
  };
  customer: {
    loyaltyId?: string;
    email?: string;
    phone?: string;
  };
  posSystem: {
    vendor: string;
    version: string;
    terminalId: string;
  };
}

export interface NFTGenerationRequest {
  receiptData: POSReceiptData;
  userWallet: string;
  privacyLevel: 'high' | 'medium' | 'low';
  customPrompt?: string;
  generateImage: boolean;
  generateMetadata: boolean;
}

export class POSIntegrationService {
  private static readonly SUPPORTED_POS_SYSTEMS = [
    'square',
    'shopify',
    'stripe',
    'clover',
    'lightspeed',
    'vend',
    'touchbistro',
    'revel',
    'ncr',
    'micros'
  ];

  /**
   * Process receipt data from POS system
   */
  static async processPOSReceipt(
    posData: any,
    posSystem: string,
    userWallet: string
  ): Promise<NFTGenerationRequest> {
    // Validate POS system
    if (!this.SUPPORTED_POS_SYSTEMS.includes(posSystem.toLowerCase())) {
      throw new Error(`Unsupported POS system: ${posSystem}`);
    }

    // Transform POS data to standardized format
    const receiptData = this.transformPOSData(posData, posSystem);
    
    // Determine privacy level based on items
    const privacyLevel = this.determinePrivacyLevel(receiptData.items);
    
    return {
      receiptData,
      userWallet,
      privacyLevel,
      generateImage: true,
      generateMetadata: true
    };
  }

  /**
   * Transform POS-specific data to standardized format
   */
  private static transformPOSData(posData: any, posSystem: string): POSReceiptData {
    switch (posSystem.toLowerCase()) {
      case 'square':
        return this.transformSquareData(posData);
      case 'shopify':
        return this.transformShopifyData(posData);
      case 'stripe':
        return this.transformStripeData(posData);
      case 'clover':
        return this.transformCloverData(posData);
      default:
        return this.transformGenericData(posData);
    }
  }

  /**
   * Transform Square POS data
   */
  private static transformSquareData(data: any): POSReceiptData {
    return {
      merchantName: data.merchant_name || 'Unknown Merchant',
      merchantId: data.merchant_id || '',
      receiptNumber: data.receipt_number || '',
      totalCents: Math.round(data.total_money?.amount || 0),
      subtotalCents: Math.round(data.subtotal_money?.amount || 0),
      taxCents: Math.round(data.tax_money?.amount || 0),
      timestamp: Math.floor(Date.now() / 1000),
      location: {
        address: data.location?.address?.address_line_1 || '',
        city: data.location?.address?.locality || '',
        state: data.location?.address?.administrative_district_level_1 || '',
        zipCode: data.location?.address?.postal_code || '',
        coordinates: data.location?.coordinates ? {
          lat: data.location.coordinates.latitude,
          lng: data.location.coordinates.longitude
        } : undefined
      },
      items: data.line_items?.map((item: any) => ({
        sku: item.catalog_object_id || '',
        name: item.name || '',
        description: item.description || '',
        qty: item.quantity || 1,
        unitPrice: Math.round((item.base_price_money?.amount || 0) / (item.quantity || 1)),
        totalPrice: Math.round(item.total_money?.amount || 0),
        category: item.category_name || 'General',
        department: item.department_name || 'General'
      })) || [],
      payment: {
        method: this.mapPaymentMethod(data.payment?.card_brand),
        last4: data.payment?.last_4,
        cardType: data.payment?.card_brand
      },
      customer: {
        loyaltyId: data.customer_id,
        email: data.customer_email,
        phone: data.customer_phone
      },
      posSystem: {
        vendor: 'Square',
        version: data.pos_system_version || 'Unknown',
        terminalId: data.terminal_id || ''
      }
    };
  }

  /**
   * Transform Shopify POS data
   */
  private static transformShopifyData(data: any): POSReceiptData {
    return {
      merchantName: data.shop?.name || 'Unknown Merchant',
      merchantId: data.shop?.id?.toString() || '',
      receiptNumber: data.order_number || '',
      totalCents: Math.round((data.total_price || 0) * 100),
      subtotalCents: Math.round((data.subtotal_price || 0) * 100),
      taxCents: Math.round((data.total_tax || 0) * 100),
      timestamp: Math.floor(Date.now() / 1000),
      location: {
        address: data.shipping_address?.address1 || '',
        city: data.shipping_address?.city || '',
        state: data.shipping_address?.province || '',
        zipCode: data.shipping_address?.zip || ''
      },
      items: data.line_items?.map((item: any) => ({
        sku: item.variant_id?.toString() || '',
        name: item.title || '',
        description: item.variant_title || '',
        qty: item.quantity || 1,
        unitPrice: Math.round((item.price || 0) * 100),
        totalPrice: Math.round((item.price || 0) * (item.quantity || 1) * 100),
        category: item.product_type || 'General',
        department: item.vendor || 'General'
      })) || [],
      payment: {
        method: this.mapPaymentMethod(data.payment_gateway_names?.[0]),
        last4: data.payment_details?.credit_card_last4,
        cardType: data.payment_details?.credit_card_company
      },
      customer: {
        loyaltyId: data.customer?.id?.toString(),
        email: data.customer?.email,
        phone: data.customer?.phone
      },
      posSystem: {
        vendor: 'Shopify',
        version: data.shop?.shopify_plan || 'Unknown',
        terminalId: data.location_id?.toString() || ''
      }
    };
  }

  /**
   * Transform Stripe POS data
   */
  private static transformStripeData(data: any): POSReceiptData {
    return {
      merchantName: data.merchant_name || 'Unknown Merchant',
      merchantId: data.merchant_id || '',
      receiptNumber: data.receipt_number || '',
      totalCents: Math.round(data.amount || 0),
      subtotalCents: Math.round(data.amount * 0.9), // Estimate
      taxCents: Math.round(data.amount * 0.1), // Estimate
      timestamp: Math.floor(Date.now() / 1000),
      location: {
        address: data.location?.address || '',
        city: data.location?.city || '',
        state: data.location?.state || '',
        zipCode: data.location?.postal_code || ''
      },
      items: data.line_items?.map((item: any) => ({
        sku: item.id || '',
        name: item.description || '',
        description: item.description || '',
        qty: item.quantity || 1,
        unitPrice: Math.round(item.amount / (item.quantity || 1)),
        totalPrice: Math.round(item.amount),
        category: item.category || 'General',
        department: item.department || 'General'
      })) || [],
      payment: {
        method: 'card',
        last4: data.payment_method?.card?.last4,
        cardType: data.payment_method?.card?.brand
      },
      customer: {
        loyaltyId: data.customer_id,
        email: data.customer_email,
        phone: data.customer_phone
      },
      posSystem: {
        vendor: 'Stripe',
        version: data.stripe_version || 'Unknown',
        terminalId: data.terminal_id || ''
      }
    };
  }

  /**
   * Transform Clover POS data
   */
  private static transformCloverData(data: any): POSReceiptData {
    return {
      merchantName: data.merchant?.name || 'Unknown Merchant',
      merchantId: data.merchant?.id || '',
      receiptNumber: data.receipt_number || '',
      totalCents: Math.round(data.total || 0),
      subtotalCents: Math.round(data.subtotal || 0),
      taxCents: Math.round(data.tax || 0),
      timestamp: Math.floor(Date.now() / 1000),
      location: {
        address: data.merchant?.address || '',
        city: data.merchant?.city || '',
        state: data.merchant?.state || '',
        zipCode: data.merchant?.zip || ''
      },
      items: data.line_items?.map((item: any) => ({
        sku: item.id || '',
        name: item.name || '',
        description: item.description || '',
        qty: item.quantity || 1,
        unitPrice: Math.round(item.price / (item.quantity || 1)),
        totalPrice: Math.round(item.price),
        category: item.category?.name || 'General',
        department: item.department?.name || 'General'
      })) || [],
      payment: {
        method: this.mapPaymentMethod(data.payment?.method),
        last4: data.payment?.last4,
        cardType: data.payment?.card_type
      },
      customer: {
        loyaltyId: data.customer?.id,
        email: data.customer?.email,
        phone: data.customer?.phone
      },
      posSystem: {
        vendor: 'Clover',
        version: data.clover_version || 'Unknown',
        terminalId: data.terminal_id || ''
      }
    };
  }

  /**
   * Transform generic POS data
   */
  private static transformGenericData(data: any): POSReceiptData {
    return {
      merchantName: data.merchant_name || data.store_name || 'Unknown Merchant',
      merchantId: data.merchant_id || data.store_id || '',
      receiptNumber: data.receipt_number || data.transaction_id || '',
      totalCents: Math.round((data.total || data.amount || 0) * 100),
      subtotalCents: Math.round((data.subtotal || data.amount * 0.9 || 0) * 100),
      taxCents: Math.round((data.tax || data.amount * 0.1 || 0) * 100),
      timestamp: Math.floor(Date.now() / 1000),
      location: {
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        zipCode: data.zip_code || data.postal_code || ''
      },
      items: data.items?.map((item: any) => ({
        sku: item.sku || item.id || '',
        name: item.name || item.title || '',
        description: item.description || '',
        qty: item.quantity || item.qty || 1,
        unitPrice: Math.round((item.unit_price || item.price || 0) * 100),
        totalPrice: Math.round((item.total_price || item.price * item.quantity || 0) * 100),
        category: item.category || 'General',
        department: item.department || 'General'
      })) || [],
      payment: {
        method: this.mapPaymentMethod(data.payment_method),
        last4: data.last4,
        cardType: data.card_type
      },
      customer: {
        loyaltyId: data.customer_id,
        email: data.customer_email,
        phone: data.customer_phone
      },
      posSystem: {
        vendor: data.pos_vendor || 'Unknown',
        version: data.pos_version || 'Unknown',
        terminalId: data.terminal_id || ''
      }
    };
  }

  /**
   * Map payment method to standardized format
   */
  private static mapPaymentMethod(paymentMethod: string): 'cash' | 'card' | 'mobile' | 'crypto' {
    if (!paymentMethod) return 'card';
    
    const method = paymentMethod.toLowerCase();
    if (method.includes('cash')) return 'cash';
    if (method.includes('mobile') || method.includes('apple') || method.includes('google')) return 'mobile';
    if (method.includes('crypto') || method.includes('bitcoin')) return 'crypto';
    return 'card';
  }

  /**
   * Determine privacy level based on items
   */
  private static determinePrivacyLevel(items: any[]): 'high' | 'medium' | 'low' {
    const sensitiveKeywords = [
      'underwear', 'lingerie', 'personal', 'medical', 'pharmacy',
      'alcohol', 'tobacco', 'adult', 'intimate'
    ];
    
    const sensitiveCount = items.filter(item => 
      sensitiveKeywords.some(keyword => 
        item.name?.toLowerCase().includes(keyword) ||
        item.description?.toLowerCase().includes(keyword) ||
        item.category?.toLowerCase().includes(keyword)
      )
    ).length;
    
    const ratio = sensitiveCount / items.length;
    if (ratio > 0.5) return 'high';
    if (ratio > 0.2) return 'medium';
    return 'low';
  }
}