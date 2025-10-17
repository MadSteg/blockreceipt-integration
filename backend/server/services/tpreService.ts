/**
 * Utility to encrypt receipt line items using TaCo threshold encryption
 */
import { thresholdClient } from '../services/tacoService';
import { logger } from '../utils/logger';

interface LineItem {
  category?: string;
  price: number;
  name?: string;
  quantity?: number;
}

/**
 * Encrypts receipt line items for a specific wallet address
 * 
 * @param walletAddress The wallet address that will have access to the encrypted data
 * @param items Array of receipt line items to encrypt
 * @returns Encrypted data object that can be stored with the receipt
 */
export async function encryptLineItems(walletAddress: string, items: LineItem[]) {
  try {
    logger.info(`Encrypting ${items.length} items for wallet ${walletAddress}`);
    
    // Convert items to a simple string format for encryption
    const itemsText = items.map(item => {
      return `${item.name || 'Item'} - $${item.price} - ${item.category || 'Other'}`;
    }).join('\n');
    
    // Encrypt the data using ThresholdClient
    const encryptedData = await thresholdClient.encrypt({
      recipientPublicKey: walletAddress,
      data: Buffer.from(itemsText)
    });
    
    return {
      encryptedText: encryptedData,
      itemCount: items.length,
      encryptedAt: new Date().toISOString()
    };
  } catch (error) {
    logger.error(`Encryption error: ${error}`);
    throw new Error(`Failed to encrypt line items: ${error}`);
  }
}