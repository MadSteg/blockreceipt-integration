import { createLogger } from '../logger';

const logger = createLogger('receipt-rewards');

export interface SpecialItem {
  itemName: string;
  category: string;
  rewardPoints: number;
  bonusMultiplier?: number;
  isActive: boolean;
  description: string;
}

export interface MerchantRewards {
  merchantId: string;
  merchantName: string;
  specialItems: SpecialItem[];
  basePointsPerDollar: number;
  welcomeBonus: number;
}

export interface ReceiptReward {
  receiptId: string;
  merchantId: string;
  totalAmount: number;
  basePoints: number;
  bonusPoints: number;
  totalPoints: number;
  qualifyingItems: Array<{
    itemName: string;
    points: number;
    reason: string;
  }>;
}

class ReceiptRewardsService {
  private merchantRewards = new Map<string, MerchantRewards>();

  constructor() {
    this.initializeMerchantRewards();
  }

  private initializeMerchantRewards() {
    // Coffee Shop Rewards
    this.merchantRewards.set('coffee-shop-1', {
      merchantId: 'coffee-shop-1',
      merchantName: 'Downtown Coffee Co.',
      basePointsPerDollar: 10,
      welcomeBonus: 100,
      specialItems: [
        {
          itemName: 'Specialty Latte',
          category: 'beverages',
          rewardPoints: 50,
          bonusMultiplier: 2,
          isActive: true,
          description: 'Double points on all specialty lattes'
        },
        {
          itemName: 'Breakfast Sandwich',
          category: 'food',
          rewardPoints: 75,
          isActive: true,
          description: 'Bonus points for breakfast items'
        },
        {
          itemName: 'Loyalty Card Refill',
          category: 'loyalty',
          rewardPoints: 200,
          isActive: true,
          description: 'Big bonus for loyalty card purchases'
        }
      ]
    });

    // Grocery Store Rewards
    this.merchantRewards.set('grocery-1', {
      merchantId: 'grocery-1',
      merchantName: 'Fresh Market',
      basePointsPerDollar: 5,
      welcomeBonus: 250,
      specialItems: [
        {
          itemName: 'Organic Produce',
          category: 'produce',
          rewardPoints: 25,
          bonusMultiplier: 3,
          isActive: true,
          description: 'Triple points on organic items'
        },
        {
          itemName: 'Store Brand Items',
          category: 'store-brand',
          rewardPoints: 15,
          isActive: true,
          description: 'Bonus for choosing store brands'
        },
        {
          itemName: 'Weekly Special',
          category: 'specials',
          rewardPoints: 100,
          isActive: true,
          description: 'Featured weekly promotion items'
        }
      ]
    });

    // Fashion Retailer Rewards
    this.merchantRewards.set('retail-1', {
      merchantId: 'retail-1',
      merchantName: 'Fashion Forward',
      basePointsPerDollar: 8,
      welcomeBonus: 500,
      specialItems: [
        {
          itemName: 'Sustainable Fashion',
          category: 'eco-friendly',
          rewardPoints: 150,
          bonusMultiplier: 4,
          isActive: true,
          description: 'Huge bonus for eco-conscious choices'
        },
        {
          itemName: 'New Arrivals',
          category: 'new',
          rewardPoints: 50,
          isActive: true,
          description: 'Extra points for trying new items'
        },
        {
          itemName: 'Clearance Items',
          category: 'clearance',
          rewardPoints: 30,
          isActive: true,
          description: 'Bonus points on clearance finds'
        }
      ]
    });
  }

  /**
   * Calculate rewards for a receipt based on items purchased
   */
  calculateRewards(
    merchantId: string, 
    totalAmount: number, 
    items: Array<{name: string, price: number, category?: string}>
  ): ReceiptReward {
    const merchant = this.merchantRewards.get(merchantId);
    if (!merchant) {
      // Default rewards for unknown merchants
      return {
        receiptId: `receipt_${Date.now()}`,
        merchantId,
        totalAmount,
        basePoints: Math.floor(totalAmount * 5), // 5 points per dollar default
        bonusPoints: 0,
        totalPoints: Math.floor(totalAmount * 5),
        qualifyingItems: []
      };
    }

    const basePoints = Math.floor(totalAmount * merchant.basePointsPerDollar);
    let bonusPoints = 0;
    const qualifyingItems: Array<{itemName: string, points: number, reason: string}> = [];

    // Check each item against special rewards
    items.forEach(item => {
      merchant.specialItems.forEach(special => {
        if (this.itemMatches(item.name, special.itemName, special.category) && special.isActive) {
          let itemPoints = special.rewardPoints;
          
          // Apply multiplier if present
          if (special.bonusMultiplier) {
            itemPoints = Math.floor(item.price * merchant.basePointsPerDollar * special.bonusMultiplier);
          }
          
          bonusPoints += itemPoints;
          qualifyingItems.push({
            itemName: item.name,
            points: itemPoints,
            reason: special.description
          });

          logger.info(`[rewards] ${item.name} qualified for ${itemPoints} bonus points: ${special.description}`);
        }
      });
    });

    const totalPoints = basePoints + bonusPoints;

    logger.info(`[rewards] Receipt rewards calculated: ${basePoints} base + ${bonusPoints} bonus = ${totalPoints} total points`);

    return {
      receiptId: `receipt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      merchantId,
      totalAmount,
      basePoints,
      bonusPoints,
      totalPoints,
      qualifyingItems
    };
  }

  /**
   * Check if an item matches a special reward criteria
   */
  private itemMatches(itemName: string, specialItemName: string, category?: string): boolean {
    const normalizedItem = itemName.toLowerCase();
    const normalizedSpecial = specialItemName.toLowerCase();

    // Direct name match
    if (normalizedItem.includes(normalizedSpecial) || normalizedSpecial.includes(normalizedItem)) {
      return true;
    }

    // Category-based matching (simplified)
    if (category) {
      switch (category) {
        case 'beverages':
          return normalizedItem.includes('coffee') || normalizedItem.includes('latte') || 
                 normalizedItem.includes('drink') || normalizedItem.includes('tea');
        case 'food':
          return normalizedItem.includes('sandwich') || normalizedItem.includes('pastry') || 
                 normalizedItem.includes('muffin') || normalizedItem.includes('bagel');
        case 'produce':
          return normalizedItem.includes('organic') || normalizedItem.includes('fresh') || 
                 normalizedItem.includes('apple') || normalizedItem.includes('banana');
        case 'eco-friendly':
          return normalizedItem.includes('organic') || normalizedItem.includes('sustainable') || 
                 normalizedItem.includes('eco') || normalizedItem.includes('recycled');
        case 'new':
          return normalizedItem.includes('new') || normalizedItem.includes('latest') || 
                 normalizedItem.includes('arrival');
        default:
          return false;
      }
    }

    return false;
  }

  /**
   * Get merchant reward configuration
   */
  getMerchantRewards(merchantId: string): MerchantRewards | undefined {
    return this.merchantRewards.get(merchantId);
  }

  /**
   * Update merchant special items
   */
  updateMerchantSpecials(merchantId: string, specialItems: SpecialItem[]): void {
    const merchant = this.merchantRewards.get(merchantId);
    if (merchant) {
      merchant.specialItems = specialItems;
      logger.info(`[rewards] Updated special items for ${merchant.merchantName}`);
    }
  }

  /**
   * Get all active merchants with their current specials
   */
  getAllMerchantSpecials(): Array<{merchantId: string, merchantName: string, specials: SpecialItem[]}> {
    return Array.from(this.merchantRewards.values()).map(merchant => ({
      merchantId: merchant.merchantId,
      merchantName: merchant.merchantName,
      specials: merchant.specialItems.filter(item => item.isActive)
    }));
  }

  /**
   * Simulate Fetch-like behavior - find qualifying purchases across receipt
   */
  findFetchLikeOffers(items: Array<{name: string, price: number}>): Array<{
    itemName: string;
    pointsEarned: number;
    offerDescription: string;
    category: string;
  }> {
    const offers: Array<{itemName: string, pointsEarned: number, offerDescription: string, category: string}> = [];

    // Simulate popular offers like Fetch
    const fetchOffers = [
      { keywords: ['coffee', 'latte', 'espresso'], points: 75, description: 'Coffee Shop Bonus', category: 'beverages' },
      { keywords: ['organic', 'natural'], points: 50, description: 'Healthy Choice Bonus', category: 'health' },
      { keywords: ['sandwich', 'wrap', 'salad'], points: 40, description: 'Fresh Food Bonus', category: 'food' },
      { keywords: ['chocolate', 'candy', 'snack'], points: 25, description: 'Treat Yourself Bonus', category: 'snacks' },
      { keywords: ['bread', 'bakery', 'fresh'], points: 30, description: 'Bakery Fresh Bonus', category: 'bakery' }
    ];

    items.forEach(item => {
      fetchOffers.forEach(offer => {
        if (offer.keywords.some(keyword => item.name.toLowerCase().includes(keyword))) {
          offers.push({
            itemName: item.name,
            pointsEarned: offer.points,
            offerDescription: offer.description,
            category: offer.category
          });
        }
      });
    });

    return offers;
  }
}

export const receiptRewardsService = new ReceiptRewardsService();