import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://sxhderkbcdyvpvrumlko.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN4aGRlcmtiY2R5dnB2cnVtbGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA2NzA3MjgsImV4cCI6MjA3NjI0NjcyOH0.OtjOcuYptb2AflZoFt8EAJprYGZqTqrllpZTvCxo9W0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database Types
export interface User {
  id: string;
  email: string;
  wallet_address?: string;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  merchant_name: string;
  total_amount: number;
  subtotal?: number;
  tax?: number;
  items: string[];
  category: string;
  confidence: number;
  image_url?: string;
  nft_created: boolean;
  nft_token_id?: string;
  nft_contract_address?: string;
  created_at: string;
  updated_at: string;
}

export interface NFT {
  id: string;
  user_id: string;
  receipt_id: string;
  token_id: string;
  contract_address: string;
  marketplace: string;
  price: number;
  name: string;
  description?: string;
  image_url: string;
  metadata_uri?: string;
  created_at: string;
  updated_at: string;
}

export interface LoyaltyPoints {
  id: string;
  user_id: string;
  points: number;
  tier: 'basic' | 'standard' | 'premium' | 'luxury';
  total_spent: number;
  total_receipts: number;
  average_order_value: number;
  created_at: string;
  updated_at: string;
}

// Supabase Service Functions
export class SupabaseService {
  // User Management
  static async createUser(userData: Partial<User>) {
    const { data, error } = await supabase
      .from('users')
      .insert([userData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getUser(userId: string) {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Receipt Management
  static async createReceipt(receiptData: Partial<Receipt>) {
    const { data, error } = await supabase
      .from('receipts')
      .insert([receiptData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getUserReceipts(userId: string) {
    const { data, error } = await supabase
      .from('receipts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  static async updateReceipt(receiptId: string, updates: Partial<Receipt>) {
    const { data, error } = await supabase
      .from('receipts')
      .update(updates)
      .eq('id', receiptId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  // NFT Management
  static async createNFT(nftData: Partial<NFT>) {
    const { data, error } = await supabase
      .from('nfts')
      .insert([nftData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getUserNFTs(userId: string) {
    const { data, error } = await supabase
      .from('nfts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data;
  }

  // Loyalty Points Management
  static async createLoyaltyPoints(userId: string, points: number, tier: string) {
    const { data, error } = await supabase
      .from('loyalty_points')
      .insert([{
        user_id: userId,
        points,
        tier,
        total_spent: 0,
        total_receipts: 0,
        average_order_value: 0
      }])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async updateLoyaltyPoints(userId: string, updates: Partial<LoyaltyPoints>) {
    const { data, error } = await supabase
      .from('loyalty_points')
      .update(updates)
      .eq('user_id', userId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  }

  static async getUserLoyaltyPoints(userId: string) {
    const { data, error } = await supabase
      .from('loyalty_points')
      .select('*')
      .eq('user_id', userId)
      .single();
    
    if (error) throw error;
    return data;
  }

  // Real-time subscriptions
  static subscribeToReceipts(userId: string, callback: (receipt: Receipt) => void) {
    return supabase
      .channel('receipts')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'receipts',
          filter: `user_id=eq.${userId}`
        }, 
        callback
      )
      .subscribe();
  }

  static subscribeToNFTs(userId: string, callback: (nft: NFT) => void) {
    return supabase
      .channel('nfts')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'nfts',
          filter: `user_id=eq.${userId}`
        }, 
        callback
      )
      .subscribe();
  }
}
