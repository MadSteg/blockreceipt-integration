import { createLogger } from '../logger';

const logger = createLogger('gift-card-redemption');

export interface GiftCardBrand {
  id: string;
  name: string;
  denominations: number[];
  minPoints: number;
  imageUrl: string;
  description: string;
}

export interface RedemptionRequest {
  userId: string;
  merchantId: string;
  points: number;
  giftCardBrand: string;
  denomination: number;
  requestId: string;
}

export interface GiftCardCode {
  code: string;
  pin?: string;
  redemptionUrl?: string;
  expirationDate?: string;
  brand: string;
  value: number;
  issuedAt: string;
}

export interface RedemptionResult {
  success: boolean;
  giftCard?: GiftCardCode;
  error?: string;
  transactionId: string;
}

class GiftCardRedemptionService {
  private pointsToValueRate = 100; // 100 points = $1
  private supportedBrands: GiftCardBrand[] = [];
  private issuedCodes = new Map<string, GiftCardCode>();
  private userPointsBalance = new Map<string, number>();

  constructor() {
    this.initializeSupportedBrands();
    this.initializeUserBalances();
  }

  private initializeSupportedBrands() {
    this.supportedBrands = [
      {
        id: 'amazon',
        name: 'Amazon',
        denominations: [5, 10, 25, 50, 100],
        minPoints: 500, // $5 minimum
        imageUrl: '/api/gift-cards/amazon-logo.png',
        description: 'Shop millions of products on Amazon'
      },
      {
        id: 'starbucks',
        name: 'Starbucks',
        denominations: [5, 10, 15, 25],
        minPoints: 500,
        imageUrl: '/api/gift-cards/starbucks-logo.png',
        description: 'Enjoy your favorite coffee and treats'
      },
      {
        id: 'target',
        name: 'Target',
        denominations: [10, 25, 50, 100],
        minPoints: 1000, // $10 minimum
        imageUrl: '/api/gift-cards/target-logo.png',
        description: 'Everything you need for home and life'
      },
      {
        id: 'walmart',
        name: 'Walmart',
        denominations: [10, 25, 50, 100],
        minPoints: 1000,
        imageUrl: '/api/gift-cards/walmart-logo.png',
        description: 'Save money. Live better.'
      },
      {
        id: 'uber',
        name: 'Uber',
        denominations: [15, 25, 50],
        minPoints: 1500, // $15 minimum
        imageUrl: '/api/gift-cards/uber-logo.png',
        description: 'Rides and food delivery'
      }
    ];
  }

  private initializeUserBalances() {
    // Simulate some user point balances
    this.userPointsBalance.set('customer_user123', 2500); // $25 worth
    this.userPointsBalance.set('customer_user456', 1800); // $18 worth
    this.userPointsBalance.set('customer_user789', 5000); // $50 worth
  }

  /**
   * Get available gift card brands for redemption
   */
  getSupportedBrands(): GiftCardBrand[] {
    return this.supportedBrands;
  }

  /**
   * Get user's current points balance
   */
  getUserPointsBalance(userId: string): number {
    return this.userPointsBalance.get(userId) || 0;
  }

  /**
   * Convert points to dollar value
   */
  pointsToValue(points: number): number {
    return points / this.pointsToValueRate;
  }

  /**
   * Convert dollar value to points
   */
  valueToPoints(value: number): number {
    return value * this.pointsToValueRate;
  }

  /**
   * Add points to user balance (from receipt purchases)
   */
  addPoints(userId: string, points: number, source: string): void {
    const currentBalance = this.getUserPointsBalance(userId);
    this.userPointsBalance.set(userId, currentBalance + points);
    logger.info(`[redemption] Added ${points} points to ${userId} from ${source}. New balance: ${currentBalance + points}`);
  }

  /**
   * Validate redemption request
   */
  private validateRedemption(request: RedemptionRequest): { valid: boolean; error?: string } {
    const { userId, points, giftCardBrand, denomination } = request;

    // Check user balance
    const userBalance = this.getUserPointsBalance(userId);
    const requiredPoints = this.valueToPoints(denomination);

    if (userBalance < requiredPoints) {
      return { 
        valid: false, 
        error: `Insufficient points. Need ${requiredPoints}, have ${userBalance}` 
      };
    }

    // Check if brand is supported
    const brand = this.supportedBrands.find(b => b.id === giftCardBrand);
    if (!brand) {
      return { 
        valid: false, 
        error: `Unsupported gift card brand: ${giftCardBrand}` 
      };
    }

    // Check if denomination is supported
    if (!brand.denominations.includes(denomination)) {
      return { 
        valid: false, 
        error: `Unsupported denomination $${denomination} for ${brand.name}` 
      };
    }

    // Check minimum points requirement
    if (requiredPoints < brand.minPoints) {
      return { 
        valid: false, 
        error: `Minimum redemption for ${brand.name} is ${brand.minPoints} points` 
      };
    }

    return { valid: true };
  }

  /**
   * Simulate gift card vendor API call
   */
  private async callGiftCardVendorAPI(brand: string, denomination: number): Promise<GiftCardCode> {
    // In production, this would call Tango Card, Giftbit, or similar API
    logger.info(`[redemption] Calling gift card vendor API for ${brand} $${denomination}`);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Generate mock gift card code
    const code = this.generateMockGiftCardCode(brand, denomination);
    
    return code;
  }

  /**
   * Generate mock gift card code for demo purposes
   */
  private generateMockGiftCardCode(brand: string, denomination: number): GiftCardCode {
    const brandCode = brand.toUpperCase().substring(0, 3);
    const randomCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const randomPin = Math.floor(1000 + Math.random() * 9000).toString();

    return {
      code: `${brandCode}-${randomCode}-${denomination}`,
      pin: brand === 'target' ? randomPin : undefined,
      redemptionUrl: `https://giftcards.${brand}.com/redeem`,
      expirationDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      brand: brand,
      value: denomination,
      issuedAt: new Date().toISOString()
    };
  }

  /**
   * Process gift card redemption
   */
  async redeemGiftCard(request: RedemptionRequest): Promise<RedemptionResult> {
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    
    try {
      // Validate redemption
      const validation = this.validateRedemption(request);
      if (!validation.valid) {
        return {
          success: false,
          error: validation.error,
          transactionId
        };
      }

      // Check for duplicate request
      if (this.issuedCodes.has(request.requestId)) {
        logger.warn(`[redemption] Duplicate redemption request: ${request.requestId}`);
        return {
          success: false,
          error: 'Duplicate redemption request',
          transactionId
        };
      }

      const requiredPoints = this.valueToPoints(request.denomination);

      // Deduct points from user balance
      const currentBalance = this.getUserPointsBalance(request.userId);
      this.userPointsBalance.set(request.userId, currentBalance - requiredPoints);

      // Call gift card vendor API
      const giftCard = await this.callGiftCardVendorAPI(request.giftCardBrand, request.denomination);

      // Store issued code
      this.issuedCodes.set(request.requestId, giftCard);

      logger.info(`[redemption] Successfully redeemed ${requiredPoints} points for ${request.giftCardBrand} $${request.denomination} gift card`);

      return {
        success: true,
        giftCard,
        transactionId
      };

    } catch (error) {
      logger.error(`[redemption] Failed to redeem gift card:`, error);
      
      // Refund points on failure
      const requiredPoints = this.valueToPoints(request.denomination);
      const currentBalance = this.getUserPointsBalance(request.userId);
      this.userPointsBalance.set(request.userId, currentBalance + requiredPoints);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        transactionId
      };
    }
  }

  /**
   * Get redemption history for user
   */
  getRedemptionHistory(userId: string): Array<{
    date: string;
    brand: string;
    value: number;
    pointsUsed: number;
    transactionId: string;
  }> {
    // In production, this would query from database
    return [
      {
        date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        brand: 'Starbucks',
        value: 10,
        pointsUsed: 1000,
        transactionId: 'txn_sample_001'
      },
      {
        date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        brand: 'Amazon',
        value: 25,
        pointsUsed: 2500,
        transactionId: 'txn_sample_002'
      }
    ];
  }
}

export const giftCardRedemptionService = new GiftCardRedemptionService();