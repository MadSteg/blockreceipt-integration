/**
 * Email Scanning Service
 * 
 * This service handles scanning email accounts for receipts and order confirmations,
 * then processes them to extract transaction details and items.
 */

import { IStorage } from "../storage";
import type { 
  InsertReceipt, 
  InsertReceiptItem, 
  User, 
  Category,
  Merchant
} from "@shared/schema";

interface EmailConnectionConfig {
  userId: number;
  provider: 'gmail' | 'outlook' | 'yahoo' | 'imap';
  credentials: {
    email: string;
    accessToken?: string;
    refreshToken?: string;
    // For IMAP
    imapHost?: string;
    imapPort?: number;
    username?: string;
    password?: string; // Not stored, only used during setup
  };
  syncFrequency: 'manual' | 'daily' | 'hourly';
  lastSync?: Date;
  folders: string[]; // Folders/labels to scan
}

interface ExtractedReceipt {
  date: Date;
  merchantName: string;
  total: string;
  tax?: string;
  currency: string;
  items: Array<{
    name: string;
    price: number;
    quantity: number;
    description?: string;
  }>;
  orderNumber?: string;
  metadata: any;
}

export class EmailScanningService {
  private storage: IStorage;
  private emailConnections: Map<number, EmailConnectionConfig[]>;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.emailConnections = new Map();
  }

  /**
   * Configure a new email connection for a user
   */
  async configureEmailConnection(config: EmailConnectionConfig): Promise<boolean> {
    // In a real implementation, we would validate the credentials
    // and test the connection before saving
    const connections = this.emailConnections.get(config.userId) || [];
    connections.push(config);
    this.emailConnections.set(config.userId, connections);
    return true;
  }

  /**
   * Get all email connections for a user
   */
  async getUserEmailConnections(userId: number): Promise<EmailConnectionConfig[]> {
    return this.emailConnections.get(userId) || [];
  }

  /**
   * Remove an email connection
   */
  async removeEmailConnection(userId: number, email: string): Promise<boolean> {
    const connections = this.emailConnections.get(userId) || [];
    const updatedConnections = connections.filter(c => c.credentials.email !== email);
    
    if (connections.length === updatedConnections.length) {
      return false; // No connection was removed
    }
    
    this.emailConnections.set(userId, updatedConnections);
    return true;
  }

  /**
   * Scan emails for a specific user
   */
  async scanEmails(userId: number): Promise<{ 
    processed: number; 
    receiptsAdded: number; 
    errors: string[] 
  }> {
    const user = await this.storage.getUser(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    const connections = this.emailConnections.get(userId) || [];
    if (connections.length === 0) {
      return {
        processed: 0,
        receiptsAdded: 0,
        errors: ['No email connections configured']
      };
    }

    let processed = 0;
    let receiptsAdded = 0;
    const errors: string[] = [];

    for (const connection of connections) {
      try {
        const result = await this.scanSingleEmailAccount(user, connection);
        processed += result.processed;
        receiptsAdded += result.receiptsAdded;
        errors.push(...result.errors);
        
        // Update last sync time
        connection.lastSync = new Date();
      } catch (error) {
        errors.push(`Error scanning ${connection.credentials.email}: ${String(error)}`);
      }
    }

    return {
      processed,
      receiptsAdded,
      errors
    };
  }

  /**
   * Scan a single email account
   */
  private async scanSingleEmailAccount(
    user: User, 
    connection: EmailConnectionConfig
  ): Promise<{ 
    processed: number; 
    receiptsAdded: number; 
    errors: string[] 
  }> {
    // In a real implementation, this would connect to the email API
    // and fetch messages from the appropriate folders
    
    // For demonstration purposes, we'll simulate finding some receipts
    const mockReceipts = this.getMockExtractedReceipts(connection.credentials.email);
    
    let processed = mockReceipts.length;
    let receiptsAdded = 0;
    const errors: string[] = [];

    for (const receipt of mockReceipts) {
      try {
        // Find or create merchant
        let merchant = await this.storage.getMerchantByName(receipt.merchantName);
        if (!merchant) {
          merchant = await this.storage.createMerchant({
            name: receipt.merchantName,
            logo: 'ri-store-3-line', // Default icon
            address: '',
            phone: ''
          });
        }

        // Find a suitable category based on merchant or items
        const categories = await this.storage.getCategories();
        const guessedCategory = this.guessCategoryFromReceipt(receipt, categories);
        
        // Create the receipt
        const newReceipt = await this.storage.createReceipt({
          userId: user.id,
          merchantId: merchant.id,
          categoryId: guessedCategory?.id || null,
          date: receipt.date,
          total: receipt.total,
          tax: receipt.tax || 0,
          currency: receipt.currency,
          paymentMethod: 'Unknown', // We don't know from the email
          notes: `Imported from email: ${connection.credentials.email}`,
          blockchainVerified: false,
        });

        // Create receipt items
        for (const item of receipt.items) {
          await this.storage.createReceiptItem({
            receiptId: newReceipt.id,
            name: item.name,
            price: item.price.toString(),
            quantity: item.quantity,
          });
        }

        receiptsAdded++;
      } catch (error) {
        errors.push(`Failed to process receipt from ${receipt.merchantName}: ${String(error)}`);
      }
    }

    return {
      processed,
      receiptsAdded,
      errors
    };
  }

  /**
   * Try to determine the best category for a receipt
   */
  private guessCategoryFromReceipt(receipt: ExtractedReceipt, categories: Category[]): Category | undefined {
    // This is a simplistic implementation that could be improved
    // with machine learning or more sophisticated algorithms
    
    const merchantNameLower = receipt.merchantName.toLowerCase();
    
    // Grocery stores
    if (
      merchantNameLower.includes('grocery') ||
      merchantNameLower.includes('market') ||
      merchantNameLower.includes('food') ||
      merchantNameLower.includes('wholefood') ||
      merchantNameLower.includes('safeway') ||
      merchantNameLower.includes('kroger')
    ) {
      return categories.find(c => c.name.toLowerCase() === 'groceries');
    }
    
    // Restaurants
    if (
      merchantNameLower.includes('restaurant') ||
      merchantNameLower.includes('cafe') ||
      merchantNameLower.includes('grill') ||
      merchantNameLower.includes('bistro') ||
      merchantNameLower.includes('kitchen') ||
      merchantNameLower.includes('pizza') ||
      merchantNameLower.includes('burger')
    ) {
      return categories.find(c => c.name.toLowerCase() === 'restaurants');
    }
    
    // Clothing
    if (
      merchantNameLower.includes('apparel') ||
      merchantNameLower.includes('clothing') ||
      merchantNameLower.includes('fashion') ||
      merchantNameLower.includes('dress') ||
      merchantNameLower.includes('wear') ||
      merchantNameLower.includes('h&m') ||
      merchantNameLower.includes('zara')
    ) {
      return categories.find(c => c.name.toLowerCase() === 'clothing');
    }
    
    // Electronics
    if (
      merchantNameLower.includes('electronic') ||
      merchantNameLower.includes('tech') ||
      merchantNameLower.includes('computer') ||
      merchantNameLower.includes('phone') ||
      merchantNameLower.includes('mobile') ||
      merchantNameLower.includes('app store') ||
      merchantNameLower.includes('amazon')
    ) {
      return categories.find(c => c.name.toLowerCase() === 'electronics');
    }
    
    // Transportation
    if (
      merchantNameLower.includes('transport') ||
      merchantNameLower.includes('travel') ||
      merchantNameLower.includes('airline') ||
      merchantNameLower.includes('air') ||
      merchantNameLower.includes('flight') ||
      merchantNameLower.includes('taxi') ||
      merchantNameLower.includes('uber') ||
      merchantNameLower.includes('lyft')
    ) {
      return categories.find(c => c.name.toLowerCase() === 'transportation');
    }
    
    // Default to uncategorized or the first category
    return categories.find(c => c.name.toLowerCase() === 'uncategorized') || categories[0];
  }

  /**
   * Generate mock receipts for demonstration
   * In a real implementation, this would be replaced with actual email parsing
   */
  private getMockExtractedReceipts(email: string): ExtractedReceipt[] {
    // These are simulated receipts that would be extracted from emails
    // In a real system, we would use an email parser to extract this information
    
    // Generate a few random receipts for demonstration
    return [
      {
        date: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Random date in last 30 days
        merchantName: 'Amazon',
        total: Math.floor(Math.random() * 10000) / 100, // Random price between $0-$100
        tax: Math.floor(Math.random() * 1000) / 100, // Random tax
        currency: 'USD',
        orderNumber: `ORDER-${Math.floor(Math.random() * 1000000)}`,
        items: [
          {
            name: 'Bluetooth Headphones',
            price: Math.floor(Math.random() * 5000) / 100,
            quantity: 1,
            description: 'Wireless Over-Ear Headphones with Noise Cancellation'
          },
          {
            name: 'USB-C Cable 6ft',
            price: Math.floor(Math.random() * 1500) / 100,
            quantity: 2,
            description: 'Fast Charging Braided Cable'
          }
        ],
        metadata: {
          sender: 'orders@amazon.com',
          subject: 'Your Amazon.com order confirmation',
          receivedAt: new Date().toISOString(),
          emailId: `email-${Math.floor(Math.random() * 1000000)}`
        }
      },
      {
        date: new Date(Date.now() - Math.random() * 15 * 24 * 60 * 60 * 1000), // Random date in last 15 days
        merchantName: 'Uber Eats',
        total: Math.floor(Math.random() * 3000) / 100, // Random price between $0-$30
        tax: Math.floor(Math.random() * 300) / 100,
        currency: 'USD',
        orderNumber: `UEAT-${Math.floor(Math.random() * 1000000)}`,
        items: [
          {
            name: 'Chicken Burrito',
            price: Math.floor(Math.random() * 1500) / 100,
            quantity: 1,
            description: 'With rice, beans, and guacamole'
          },
          {
            name: 'Chips & Salsa',
            price: Math.floor(Math.random() * 700) / 100,
            quantity: 1,
            description: 'Fresh tortilla chips with salsa'
          },
          {
            name: 'Delivery Fee',
            price: Math.floor(Math.random() * 500) / 100,
            quantity: 1,
            description: 'Service fee for delivery'
          }
        ],
        metadata: {
          sender: 'orders@ubereats.com',
          subject: 'Your Uber Eats order receipt',
          receivedAt: new Date().toISOString(),
          emailId: `email-${Math.floor(Math.random() * 1000000)}`
        }
      }
    ];
  }

  /**
   * Parse email content to extract receipt data
   * This would be a complex function using NLP, regex, and other techniques
   */
  private parseEmailContent(emailContent: string): ExtractedReceipt | null {
    // In a real implementation, this would use various techniques to extract
    // structured receipt data from email content
    
    // For common retailers, we might use specialized parsers
    // For unknown formats, we would use more general ML-based approaches
    
    // This is just a placeholder
    return null;
  }
}

// Export a singleton instance
let emailScanningService: EmailScanningService | null = null;

export function getEmailScanningService(storage: IStorage): EmailScanningService {
  if (!emailScanningService) {
    emailScanningService = new EmailScanningService(storage);
  }
  return emailScanningService;
}