export interface Receipt {
  id: string;
  tokenId: number;
  merchantName: string;
  totalAmount: number;
  timestamp: number;
  imageUrl?: string;
  metadataUrl: string;
  transactionHash: string;
  items: ReceiptItem[];
  loyaltyPoints: number;
  rewards: Reward[];
}

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Reward {
  id: string;
  type: 'points' | 'nft' | 'discount';
  value: number;
  description: string;
  merchant: string;
  category: string;
  isRedeemed: boolean;
  expiresAt?: number;
}

export interface LoyaltyProfile {
  userId: number;
  phoneNumber: string;
  totalPoints: number;
  availablePoints: number;
  redeemedPoints: number;
  totalReceipts: number;
  totalSpent: number;
  averageOrderValue: number;
  favoriteMerchants: FavoriteMerchant[];
  recentRewards: Reward[];
  upcomingExpirations: Reward[];
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  nextTierProgress: number;
}

export interface FavoriteMerchant {
  merchantId: number;
  merchantName: string;
  receipts: number;
  spent: number;
  points: number;
}

export interface Wallet {
  address: string;
  isNew: boolean;
  totalReceipts: number;
  loyaltyPoints: number;
}

export interface User {
  phoneNumber: string;
  wallet: Wallet;
  loyaltyProfile: LoyaltyProfile;
}
