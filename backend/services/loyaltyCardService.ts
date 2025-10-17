import { ethers } from "ethers";
import { createLogger } from "../logger";

const logger = createLogger('loyalty-card');

// Loyalty Card ABI (essential functions only)
const LOYALTY_CARD_ABI = [
  "function mintCard(address to, string memory uri) external returns (uint256)",
  "function incrementStamps(address userAddress, address merchant, uint256 amount) external",
  "function redeemReward(address userAddress, address merchant) external", 
  "function authorizeMerchant(address merchant, string memory name, uint256 redemptionThreshold) external",
  "function getUserCard(address user) external view returns (uint256)",
  "function getCardStamps(uint256 cardId) external view returns (uint256)",
  "function canUserRedeem(address userAddress, address merchant) external view returns (bool, uint256, uint256)",
  "event CardMinted(address indexed user, uint256 cardId, string uri)",
  "event StampIncremented(uint256 indexed cardId, address indexed merchant, uint256 amount, uint256 newTotal)",
  "event RewardRedeemed(uint256 indexed cardId, address indexed merchant, uint256 stampsUsed)"
];

export class LoyaltyCardService {
  private contract: ethers.Contract;
  private wallet: ethers.Wallet;
  private provider: ethers.providers.JsonRpcProvider;
  
  constructor() {
    const rpcUrl = process.env.RPC_URL;
    const privateKey = process.env.PRIVATE_KEY;
    const contractAddress = process.env.LOYALTY_CONTRACT_ADDRESS;
    
    if (!rpcUrl || !privateKey || !contractAddress) {
      throw new Error('Missing loyalty card configuration. Check RPC_URL, PRIVATE_KEY, and LOYALTY_CONTRACT_ADDRESS');
    }
    
    this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(contractAddress, LOYALTY_CARD_ABI, this.wallet);
    
    logger.info('Loyalty card service initialized', { contractAddress });
  }
  
  /**
   * Mint a new loyalty card for a user
   */
  async mintLoyaltyCard(userAddress: string): Promise<{ cardId: number; txHash: string }> {
    try {
      // Generate basic metadata URI for the loyalty card
      const metadata = {
        name: "BlockReceipt Loyalty Card",
        description: "Universal loyalty card that works across all BlockReceipt merchants",
        image: "https://your-app.replit.app/loyalty-card-base.png",
        attributes: [
          { trait_type: "Card Type", value: "Universal" },
          { trait_type: "Network", value: "Polygon" },
          { trait_type: "Status", value: "Active" }
        ]
      };
      
      const metadataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(metadata)).toString('base64')}`;
      
      const tx = await this.contract.mintCard(userAddress, metadataUri);
      const receipt = await tx.wait();
      
      // Extract card ID from the event
      const event = receipt.events?.find((e: any) => e.event === 'CardMinted');
      const cardId = event?.args?.cardId?.toNumber() || 0;
      
      logger.info('Loyalty card minted', { userAddress, cardId, txHash: tx.hash });
      
      return { cardId, txHash: tx.hash };
    } catch (error) {
      logger.error('Failed to mint loyalty card', { userAddress, error });
      throw error;
    }
  }
  
  /**
   * Add stamps to a user's loyalty card
   */
  async addStamps(userAddress: string, merchantAddress: string, stampCount: number): Promise<string> {
    try {
      const tx = await this.contract.incrementStamps(userAddress, merchantAddress, stampCount);
      await tx.wait();
      
      logger.info('Stamps added to loyalty card', { userAddress, merchantAddress, stampCount, txHash: tx.hash });
      
      return tx.hash;
    } catch (error) {
      logger.error('Failed to add stamps', { userAddress, merchantAddress, stampCount, error });
      throw error;
    }
  }
  
  /**
   * Redeem a reward for a user
   */
  async redeemReward(userAddress: string, merchantAddress: string): Promise<string> {
    try {
      const tx = await this.contract.redeemReward(userAddress, merchantAddress);
      await tx.wait();
      
      logger.info('Reward redeemed', { userAddress, merchantAddress, txHash: tx.hash });
      
      return tx.hash;
    } catch (error) {
      logger.error('Failed to redeem reward', { userAddress, merchantAddress, error });
      throw error;
    }
  }
  
  /**
   * Get a user's loyalty card information
   */
  async getUserLoyaltyInfo(userAddress: string): Promise<{
    hasCard: boolean;
    cardId: number;
    totalStamps: number;
  }> {
    try {
      const cardId = await this.contract.getUserCard(userAddress);
      const hasCard = cardId.gt(0);
      
      let totalStamps = 0;
      if (hasCard) {
        totalStamps = (await this.contract.getCardStamps(cardId)).toNumber();
      }
      
      return {
        hasCard,
        cardId: cardId.toNumber(),
        totalStamps
      };
    } catch (error) {
      logger.error('Failed to get user loyalty info', { userAddress, error });
      throw error;
    }
  }
  
  /**
   * Check if user can redeem from a specific merchant
   */
  async canUserRedeem(userAddress: string, merchantAddress: string): Promise<{
    canRedeem: boolean;
    currentStamps: number;
    requiredStamps: number;
  }> {
    try {
      const [canRedeem, currentStamps, requiredStamps] = await this.contract.canUserRedeem(userAddress, merchantAddress);
      
      return {
        canRedeem,
        currentStamps: currentStamps.toNumber(),
        requiredStamps: requiredStamps.toNumber()
      };
    } catch (error) {
      logger.error('Failed to check redemption eligibility', { userAddress, merchantAddress, error });
      throw error;
    }
  }
  
  /**
   * Authorize a new merchant in the loyalty program
   */
  async authorizeMerchant(merchantAddress: string, merchantName: string, redemptionThreshold: number): Promise<string> {
    try {
      const tx = await this.contract.authorizeMerchant(merchantAddress, merchantName, redemptionThreshold);
      await tx.wait();
      
      logger.info('Merchant authorized', { merchantAddress, merchantName, redemptionThreshold, txHash: tx.hash });
      
      return tx.hash;
    } catch (error) {
      logger.error('Failed to authorize merchant', { merchantAddress, merchantName, error });
      throw error;
    }
  }
  
  /**
   * Process a purchase and award loyalty stamps
   * This is the main function called from POS webhooks
   */
  async processPurchaseForLoyalty(
    userAddress: string, 
    merchantAddress: string, 
    purchaseAmount: number,
    receiptId: string
  ): Promise<{ txHash?: string; cardId?: number; stampsAwarded: number }> {
    try {
      // Calculate stamps based on purchase amount (1 stamp per $10 spent)
      const stampsAwarded = Math.floor(purchaseAmount / 10);
      
      if (stampsAwarded === 0) {
        logger.info('No stamps awarded - purchase too small', { userAddress, purchaseAmount, receiptId });
        return { stampsAwarded: 0 };
      }
      
      // Check if user has a loyalty card
      const loyaltyInfo = await this.getUserLoyaltyInfo(userAddress);
      
      let cardId = loyaltyInfo.cardId;
      let mintTxHash;
      
      // Mint card if user doesn't have one
      if (!loyaltyInfo.hasCard) {
        const mintResult = await this.mintLoyaltyCard(userAddress);
        cardId = mintResult.cardId;
        mintTxHash = mintResult.txHash;
        logger.info('New loyalty card minted for purchase', { userAddress, cardId, receiptId });
      }
      
      // Add stamps for this purchase
      const stampTxHash = await this.addStamps(userAddress, merchantAddress, stampsAwarded);
      
      logger.info('Purchase processed for loyalty program', {
        userAddress,
        merchantAddress,
        purchaseAmount,
        stampsAwarded,
        cardId,
        receiptId,
        txHash: stampTxHash
      });
      
      return {
        txHash: stampTxHash,
        cardId,
        stampsAwarded
      };
    } catch (error) {
      logger.error('Failed to process purchase for loyalty', { userAddress, merchantAddress, purchaseAmount, receiptId, error });
      throw error;
    }
  }
}

// Export singleton instance
export const loyaltyCardService = new LoyaltyCardService();