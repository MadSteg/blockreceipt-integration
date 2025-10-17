import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  users,
  merchants, 
  userReceipts,
  ocrResultCache,
  insertUserSchema,
  insertReceiptSchema,
  insertOcrCacheSchema,
  type InsertUser,
  type InsertReceipt,
  type InsertOcrCache,
  type ExtractedReceiptData,
  type ReceiptItem
} from "@shared/schema";

export class DatabaseStorage {
  
  async createUser(userData: InsertUser) {
    if (!db) throw new Error("Database not available");
    
    const [user] = await db.insert(users)
      .values(userData)
      .returning();
    
    return user;
  }

  async getUserByEmail(email: string) {
    if (!db) throw new Error("Database not available");
    
    const [user] = await db.select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
      
    return user;
  }

  async getUserById(id: number) {
    if (!db) throw new Error("Database not available");
    
    const [user] = await db.select()
      .from(users) 
      .where(eq(users.id, id))
      .limit(1);
      
    return user;
  }

  async createReceipt(receiptData: InsertReceipt) {
    if (!db) throw new Error("Database not available");
    
    const [receipt] = await db.insert(userReceipts)
      .values(receiptData)
      .returning();
      
    return receipt;
  }

  async getReceiptsByUserId(userId: number) {
    if (!db) throw new Error("Database not available");
    
    const receipts = await db.select()
      .from(userReceipts)
      .where(eq(userReceipts.userId, userId))
      .orderBy(desc(userReceipts.createdAt));
      
    return receipts;
  }

  async getReceiptById(id: number) {
    if (!db) throw new Error("Database not available");
    
    const [receipt] = await db.select()
      .from(userReceipts)
      .where(eq(userReceipts.id, id))
      .limit(1);
      
    return receipt;
  }

  async updateReceipt(id: number, updates: Partial<InsertReceipt>) {
    if (!db) throw new Error("Database not available");
    
    const [receipt] = await db.update(userReceipts)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(userReceipts.id, id))
      .returning();
      
    return receipt;
  }

  // Alias for backward compatibility with blockchain routes
  async getFullReceipt(id: number) {
    const receipt = await this.getReceiptById(id);
    if (!receipt) return null;
    
    // Return in the format expected by blockchain routes
    return {
      ...receipt,
      merchant: {
        name: receipt.merchantName
      },
      items: receipt.items || [],
      date: receipt.date,
      total: receipt.total / 100 // Convert from cents for blockchain
    };
  }

  async createMerchant(merchantData: { name: string; logoUrl?: string; website?: string; category?: string; walletAddress?: string }) {
    if (!db) throw new Error("Database not available");
    
    const [merchant] = await db.insert(merchants)
      .values(merchantData)
      .returning();
      
    return merchant;
  }

  async getMerchantByName(name: string) {
    if (!db) throw new Error("Database not available");
    
    const [merchant] = await db.select()
      .from(merchants)
      .where(eq(merchants.name, name))
      .limit(1);
      
    return merchant;
  }

  async cacheOcrResult(ocrData: InsertOcrCache) {
    if (!db) throw new Error("Database not available");
    
    const [cached] = await db.insert(ocrResultCache)
      .values(ocrData)
      .returning();
      
    return cached;
  }

  async getCachedOcrResult(imageHash: string) {
    if (!db) throw new Error("Database not available");
    
    const [cached] = await db.select()
      .from(ocrResultCache)
      .where(and(
        eq(ocrResultCache.imageHash, imageHash),
        sql`expires_at IS NULL OR expires_at > NOW()`
      ))
      .limit(1);
      
    return cached;
  }

  async getAllMerchants() {
    if (!db) throw new Error("Database not available");
    
    const merchantList = await db.select()
      .from(merchants)
      .orderBy(merchants.name);
      
    return merchantList;
  }

  async updateUser(id: number, updates: Partial<InsertUser>) {
    if (!db) throw new Error("Database not available");
    
    const [user] = await db.update(users)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
      
    return user;
  }

  async deleteReceipt(id: number) {
    if (!db) throw new Error("Database not available");
    
    const [deleted] = await db.delete(userReceipts)
      .where(eq(userReceipts.id, id))
      .returning();
      
    return deleted;
  }

  async getRecentReceipts(userId: number, limit: number = 10) {
    if (!db) throw new Error("Database not available");
    
    const receipts = await db.select()
      .from(userReceipts)
      .where(eq(userReceipts.userId, userId))
      .orderBy(desc(userReceipts.createdAt))
      .limit(limit);
      
    return receipts;
  }

  async getUserCount() {
    if (!db) throw new Error("Database not available");
    
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(users);
      
    return result.count;
  }

  async getReceiptCount() {
    if (!db) throw new Error("Database not available");
    
    const [result] = await db.select({ count: sql<number>`count(*)` })
      .from(userReceipts);
      
    return result.count;
  }
}

// Create singleton instance
export const storage = new DatabaseStorage();