/**
 * Authentication Service
 * 
 * This service provides authentication and user management functions
 * including email/password auth and wallet-based Web3 authentication
 */
import { db } from "../db";
import { users, type User, type InsertUser } from "@shared/schema";
import { eq } from "drizzle-orm";
import { ethers } from "ethers";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { TacoService } from "./tacoService";
import { WalletService } from "./walletService";

export class AuthService {
  private tacoService: TacoService | null;
  private walletService: WalletService | null;
  private nonceMap: Map<string, string> = new Map();
  
  constructor(tacoService?: TacoService, walletService?: WalletService) {
    this.tacoService = tacoService || null;
    this.walletService = walletService || null;
  }
  
  /**
   * Create a new user with email/password authentication
   */
  async createUser(userData: InsertUser, wantsWallet: boolean = false, tacoPublicKey?: string): Promise<User> {
    try {
      // Hash the password
      const hashedPassword = await this.hashPassword(userData.password);
      
      // Create the user data - note we need to map to the correct column names
      const userToInsert = {
        email: userData.email,
        username: userData.username,
        full_name: userData.fullName,
        password_hash: hashedPassword,
        wallet_address: null, // Will be updated if a wallet is created
      };
      
      // Insert the user
      const [user] = await db
        .insert(users)
        .values(userToInsert)
        .returning();
      
      if (!user) {
        throw new Error("Failed to create user");
      }
      
      // Generate a wallet if needed
      if (wantsWallet && this.walletService) {
        const wallet = await this.walletService.generateWallet();
        
        // Update the user with the wallet address
        const [updatedUser] = await db
          .update(users)
          .set({ walletAddress: wallet.address })
          .where(eq(users.id, user.id))
          .returning();
        
        if (!updatedUser) {
          throw new Error("Failed to update user with wallet address");
        }
        
        // Encrypt and store the wallet private key if a TACo public key is provided
        if (tacoPublicKey && this.tacoService) {
          await this.tacoService.encryptPrivateKey(
            wallet.privateKey,
            tacoPublicKey,
            user.id
          );
        }
        
        return updatedUser;
      }
      
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw new Error("Failed to create user account");
    }
  }
  
  /**
   * Verify user credentials
   */
  async verifyCredentials(email: string, password: string): Promise<User | null> {
    try {
      // Find the user by email
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      
      if (!user) {
        return null;
      }
      
      // Compare passwords - use password_hash column
      const passwordMatch = await bcrypt.compare(password, user.password_hash || "");
      
      if (!passwordMatch) {
        return null;
      }
      
      return user;
    } catch (error) {
      console.error("Error verifying credentials:", error);
      throw new Error("Authentication error");
    }
  }
  
  /**
   * Generate a new nonce for Web3 authentication
   */
  async generateNonce(walletAddress: string): Promise<string> {
    try {
      // Generate a random nonce
      const nonce = crypto.randomBytes(32).toString('hex');
      
      // Store the nonce in the map
      this.nonceMap.set(walletAddress.toLowerCase(), nonce);
      
      return nonce;
    } catch (error) {
      console.error("Error generating nonce:", error);
      throw new Error("Failed to generate nonce");
    }
  }
  
  /**
   * Verify a Web3 signature
   */
  async verifySignature(walletAddress: string, signature: string, nonce: string): Promise<User | null> {
    try {
      const storedNonce = this.nonceMap.get(walletAddress.toLowerCase());
      
      if (!storedNonce || storedNonce !== nonce) {
        return null;
      }
      
      // Construct the message that was signed
      const message = `Sign this message to verify your ownership of wallet address ${walletAddress}. Nonce: ${nonce}`;
      
      // Verify the signature
      const signerAddress = ethers.utils.verifyMessage(message, signature);
      
      // Check if the signer matches the expected wallet address
      if (signerAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        return null;
      }
      
      // Clear the nonce
      this.nonceMap.delete(walletAddress.toLowerCase());
      
      // Find or create a user with this wallet address
      let user = await this.findUserByWalletAddress(walletAddress);
      
      if (!user) {
        // Create a new user with this wallet address
        const [newUser] = await db
          .insert(users)
          .values({
            username: `wallet_${walletAddress.substring(0, 8)}`,
            email: `${walletAddress.toLowerCase()}@blockreceipt.ai`,
            password: null,
            walletAddress: walletAddress,
          })
          .returning();
        
        if (!newUser) {
          throw new Error("Failed to create user for wallet");
        }
        
        user = newUser;
      }
      
      // Update the wallet's last used timestamp
      if (this.walletService) {
        await this.walletService.updateLastUsed(walletAddress);
      }
      
      return user;
    } catch (error) {
      console.error("Error verifying signature:", error);
      throw new Error("Failed to verify signature");
    }
  }
  
  /**
   * Link a wallet address to an existing user account
   */
  async linkWalletToUser(userId: number, walletAddress: string): Promise<User> {
    try {
      // Find the user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        throw new Error("User not found");
      }
      
      // Update the user with the wallet address
      const [updatedUser] = await db
        .update(users)
        .set({ walletAddress })
        .where(eq(users.id, userId))
        .returning();
      
      if (!updatedUser) {
        throw new Error("Failed to update user with wallet address");
      }
      
      return updatedUser;
    } catch (error) {
      console.error("Error linking wallet to user:", error);
      throw new Error("Failed to link wallet to user");
    }
  }
  
  /**
   * Find a user by wallet address
   */
  private async findUserByWalletAddress(walletAddress: string): Promise<User | null> {
    try {
      // Normalize the address
      const checksum = ethers.utils.getAddress(walletAddress);
      
      // Find the user
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.walletAddress, checksum));
      
      return user || null;
    } catch (error) {
      console.error("Error finding user by wallet address:", error);
      throw new Error("Failed to find user by wallet address");
    }
  }
  
  /**
   * Get a user by wallet address (public method)
   */
  async getUserByWalletAddress(walletAddress: string): Promise<User | null> {
    return this.findUserByWalletAddress(walletAddress);
  }
  
  /**
   * Hash a password
   */
  private async hashPassword(password: string): Promise<string> {
    try {
      const saltRounds = 10;
      return await bcrypt.hash(password, saltRounds);
    } catch (error) {
      console.error("Error hashing password:", error);
      throw new Error("Failed to hash password");
    }
  }
}



// Create and export an instance of the AuthService
// Add missing wallet authentication methods to AuthService
AuthService.prototype.getUserOrCreateByWalletAddress = async function(walletAddress: string): Promise<User | null> {
  try {
    // First try to find the existing user
    let user = await this.findUserByWalletAddress(walletAddress);
    
    // If user doesn't exist, create a new one
    if (!user) {
      console.log(`[Dev Mode] Creating new user for wallet address: ${walletAddress}`);
      
      // Create a new user with this wallet address
      const [newUser] = await db
        .insert(users)
        .values({
          username: `devwallet_${walletAddress.substring(0, 8)}`,
          email: `${walletAddress.toLowerCase()}@blockreceipt.dev`,
          password: null, // No password for dev wallet users
          walletAddress: walletAddress,
        })
        .returning();
      
      if (!newUser) {
        throw new Error("Failed to create development user for wallet");
      }
      
      user = newUser;
    }
    
    return user;
  } catch (error) {
    console.error("Error in getUserOrCreateByWalletAddress:", error);
    throw new Error("Failed to get or create user by wallet address");
  }
};

AuthService.prototype.storeWalletNonce = async function(walletAddress: string, nonce: string): Promise<void> {
  try {
    // Ensure the address is in checksum format
    const checksum = ethers.utils.getAddress(walletAddress);
    
    // Find the user
    const user = await this.getUserByWalletAddress(checksum);
    
    if (user) {
      // Update the user's nonce
      await db
        .update(users)
        .set({ nonce: nonce })
        .where(eq(users.id, user.id));
    } else {
      // Create a new user with just the wallet address and nonce
      // This allows users to authenticate with wallet before providing email
      await db
        .insert(users)
        .values({
          walletAddress: checksum,
          nonce: nonce,
          email: `wallet-${checksum.substring(2, 8)}@placeholder.com`,
          password: crypto.randomBytes(16).toString('hex'),
          username: `wallet-${checksum.substring(2, 10)}`,
          createdAt: new Date(),
          updatedAt: new Date()
        });
    }
  } catch (error) {
    console.error("Error storing wallet nonce:", error);
    throw new Error("Failed to store wallet nonce");
  }
};

AuthService.prototype.updateUserAfterWalletLogin = async function(userId: number, newNonce: string): Promise<void> {
  try {
    await db
      .update(users)
      .set({
        nonce: newNonce,
        lastLogin: new Date()
      })
      .where(eq(users.id, userId));
  } catch (error) {
    console.error("Error updating user after wallet login:", error);
    throw new Error("Failed to update user after wallet login");
  }
};

// Create and export an instance of the AuthService
// For now, initialize with null dependencies since the server will inject them later
export const authService = new AuthService();