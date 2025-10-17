import { createLogger } from '../logger';

const logger = createLogger('merchant-settlement');

export interface MerchantBalance {
  merchantId: string;
  merchantName: string;
  stampsEarned: number;      // Stamps customers earned at this merchant
  stampsRedeemed: number;    // Stamps redeemed at this merchant (from all merchants)
  netBalance: number;        // stampsEarned - stampsRedeemed
  poolContribution: number;  // $ contributed to loyalty pool
  settlementOwed: number;    // $ owed to this merchant
  settlementDue: number;     // $ this merchant owes
}

export interface SettlementTransaction {
  id: string;
  fromMerchant: string;
  toMerchant: string;
  stampValue: number;
  dollarAmount: number;
  timestamp: string;
  transactionHash?: string;
  settlementType?: 'direct_merchant' | 'pool_based';
}

class MerchantSettlementService {
  private merchantBalances = new Map<string, MerchantBalance>();
  private settlementHistory: SettlementTransaction[] = [];
  private readonly STAMP_VALUE = 0.10; // Each stamp worth $0.10
  private readonly POOL_CONTRIBUTION_RATE = 0.005; // 0.5% of revenue goes to pool
  private readonly NETWORK_FEE_RATE = 0.001; // 0.1% network operation fee
  private readonly DIRECT_SETTLEMENT_ENABLED = true; // Enable direct merchant-to-merchant settlement

  constructor() {
    this.initializeMockMerchants();
  }

  private initializeMockMerchants() {
    const merchants = [
      { id: 'coffee-shop-1', name: 'Downtown Coffee Co.' },
      { id: 'restaurant-1', name: 'Italian Bistro' },
      { id: 'retail-1', name: 'Fashion Forward' },
      { id: 'grocery-1', name: 'Fresh Market' },
      { id: 'gas-station-1', name: 'QuickStop Gas' }
    ];

    merchants.forEach(merchant => {
      this.merchantBalances.set(merchant.id, {
        merchantId: merchant.id,
        merchantName: merchant.name,
        stampsEarned: 0,
        stampsRedeemed: 0,
        netBalance: 0,
        poolContribution: 0,
        settlementOwed: 0,
        settlementDue: 0
      });
    });

    // Add some sample transaction history
    this.addSampleTransactions();
  }

  private addSampleTransactions() {
    // Customer earns stamps at Coffee Shop, redeems at Restaurant
    this.recordStampEarning('coffee-shop-1', 'customer1', 50, 500); // $500 purchase = 50 stamps
    this.recordStampRedemption('restaurant-1', 'customer1', 20); // Redeems 20 stamps

    // Customer earns at multiple places, redeems at one
    this.recordStampEarning('retail-1', 'customer2', 30, 300);
    this.recordStampEarning('grocery-1', 'customer2', 15, 150);
    this.recordStampRedemption('coffee-shop-1', 'customer2', 25);

    // More realistic scenarios
    this.recordStampEarning('gas-station-1', 'customer3', 40, 400);
    this.recordStampRedemption('grocery-1', 'customer3', 15);

    this.calculateSettlements();
  }

  /**
   * Record stamps earned at a merchant
   */
  recordStampEarning(merchantId: string, customerId: string, stamps: number, purchaseAmount: number) {
    const merchant = this.merchantBalances.get(merchantId);
    if (!merchant) return;

    merchant.stampsEarned += stamps;
    merchant.poolContribution += purchaseAmount * this.POOL_CONTRIBUTION_RATE;
    merchant.netBalance = merchant.stampsEarned - merchant.stampsRedeemed;

    logger.info(`[settlement] ${merchant.merchantName} earned ${stamps} stamps from $${purchaseAmount} purchase`);
  }

  /**
   * Record stamps redeemed at a merchant
   */
  recordStampRedemption(merchantId: string, customerId: string, stamps: number) {
    const merchant = this.merchantBalances.get(merchantId);
    if (!merchant) return;

    merchant.stampsRedeemed += stamps;
    merchant.settlementOwed += stamps * this.STAMP_VALUE;
    merchant.netBalance = merchant.stampsEarned - merchant.stampsRedeemed;

    logger.info(`[settlement] ${stamps} stamps redeemed at ${merchant.merchantName}, value: $${stamps * this.STAMP_VALUE}`);

    // Create settlement transaction
    this.createSettlementTransaction(merchantId, stamps);
  }

  /**
   * Create a settlement transaction when stamps are redeemed
   * Uses direct merchant-to-merchant settlement via smart contract
   */
  private createSettlementTransaction(redeemingMerchantId: string, stamps: number) {
    // NEW: Direct settlement - find which merchants should pay
    const earningMerchants = this.findStampEarningMerchants(stamps);
    
    earningMerchants.forEach(({ merchantId, stampsPortion, dollarAmount }) => {
      const transaction: SettlementTransaction = {
        id: `settlement_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        fromMerchant: merchantId, // Direct merchant-to-merchant
        toMerchant: redeemingMerchantId,
        stampValue: stampsPortion,
        dollarAmount: dollarAmount,
        timestamp: new Date().toISOString(),
        transactionHash: `0x${Math.random().toString(16).substr(2, 64)}`, // Would be real blockchain tx
        settlementType: 'direct_merchant'
      };

      this.settlementHistory.push(transaction);
      
      // Update merchant balances for direct settlement
      this.updateDirectSettlement(merchantId, redeemingMerchantId, dollarAmount);
    });
  }

  /**
   * INNOVATION: Find which specific merchants should pay for redeemed stamps
   * Based on proportional earnings rather than pool contribution
   */
  private findStampEarningMerchants(stampsToRedeem: number): Array<{merchantId: string, stampsPortion: number, dollarAmount: number}> {
    const allMerchants = Array.from(this.merchantBalances.values());
    const totalStampsEarned = allMerchants.reduce((sum, m) => sum + m.stampsEarned, 0);
    
    if (totalStampsEarned === 0) return [];

    const settlements: Array<{merchantId: string, stampsPortion: number, dollarAmount: number}> = [];
    let remainingStamps = stampsToRedeem;

    // Proportionally distribute cost based on stamps earned by each merchant
    allMerchants.forEach((merchant) => {
      if (merchant.stampsEarned > 0 && remainingStamps > 0) {
        const proportion = merchant.stampsEarned / totalStampsEarned;
        const stampsPortion = Math.min(Math.ceil(stampsToRedeem * proportion), remainingStamps);
        const dollarAmount = stampsPortion * this.STAMP_VALUE;

        if (stampsPortion > 0) {
          settlements.push({
            merchantId: merchant.merchantId,
            stampsPortion,
            dollarAmount
          });
          remainingStamps -= stampsPortion;
        }
      }
    });

    return settlements;
  }

  /**
   * Update balances for direct merchant-to-merchant settlement
   */
  private updateDirectSettlement(fromMerchantId: string, toMerchantId: string, amount: number) {
    const fromMerchant = this.merchantBalances.get(fromMerchantId);
    const toMerchant = this.merchantBalances.get(toMerchantId);

    if (fromMerchant && toMerchant) {
      fromMerchant.settlementDue += amount;
      toMerchant.settlementOwed += amount;
    }
  }

  /**
   * Calculate settlement amounts for all merchants
   */
  calculateSettlements() {
    const totalPoolFunds = Array.from(this.merchantBalances.values())
      .reduce((sum, merchant) => sum + merchant.poolContribution, 0);

    const totalStampsRedeemed = Array.from(this.merchantBalances.values())
      .reduce((sum, merchant) => sum + merchant.stampsRedeemed, 0);

    const totalRedemptionValue = totalStampsRedeemed * this.STAMP_VALUE;

    logger.info(`[settlement] Total pool funds: $${totalPoolFunds.toFixed(2)}`);
    logger.info(`[settlement] Total redemption value: $${totalRedemptionValue.toFixed(2)}`);

    // Distribute settlement based on pool contributions vs redemptions
    this.merchantBalances.forEach(merchant => {
      const redemptionCost = merchant.stampsRedeemed * this.STAMP_VALUE;
      const poolShare = merchant.poolContribution;
      
      if (redemptionCost > poolShare) {
        merchant.settlementDue = redemptionCost - poolShare;
        merchant.settlementOwed = 0;
      } else {
        merchant.settlementOwed = poolShare - redemptionCost;
        merchant.settlementDue = 0;
      }
    });
  }

  /**
   * Get all merchant balances
   */
  getAllMerchantBalances(): MerchantBalance[] {
    return Array.from(this.merchantBalances.values());
  }

  /**
   * Get settlement history
   */
  getSettlementHistory(): SettlementTransaction[] {
    return this.settlementHistory.slice().reverse(); // Most recent first
  }

  /**
   * Get merchant balance by ID
   */
  getMerchantBalance(merchantId: string): MerchantBalance | undefined {
    return this.merchantBalances.get(merchantId);
  }

  /**
   * Get total pool statistics
   */
  getPoolStatistics() {
    const balances = Array.from(this.merchantBalances.values());
    
    return {
      totalPoolFunds: balances.reduce((sum, m) => sum + m.poolContribution, 0),
      totalStampsEarned: balances.reduce((sum, m) => sum + m.stampsEarned, 0),
      totalStampsRedeemed: balances.reduce((sum, m) => sum + m.stampsRedeemed, 0),
      totalSettlementOwed: balances.reduce((sum, m) => sum + m.settlementOwed, 0),
      totalSettlementDue: balances.reduce((sum, m) => sum + m.settlementDue, 0),
      stampValue: this.STAMP_VALUE,
      poolContributionRate: this.POOL_CONTRIBUTION_RATE
    };
  }

  /**
   * Process a new transaction and update balances
   */
  processTransaction(merchantId: string, customerId: string, amount: number, action: 'earn' | 'redeem', stamps: number) {
    if (action === 'earn') {
      this.recordStampEarning(merchantId, customerId, stamps, amount);
    } else {
      this.recordStampRedemption(merchantId, customerId, stamps);
    }
    
    this.calculateSettlements();
  }
}

export const merchantSettlementService = new MerchantSettlementService();