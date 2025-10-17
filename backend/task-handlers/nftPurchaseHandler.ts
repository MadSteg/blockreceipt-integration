import { v4 as uuidv4 } from 'uuid';
import { blockchainEnhancedService } from '../services/blockchainEnhancedService';
import { ipfsService } from '../services/ipfsService';
import { mockBotWallet } from '../utils/mockBotWallet';
import { thresholdClient } from '../services/thresholdClient';
import { stampService } from '../services/stampService';
import { logger } from '../utils/logger';

interface NFTPurchaseTask {
  id: string;
  tokenId?: string;
  receiptData: {
    merchantName: string;
    date: string;
    total: number;
    items?: Array<{
      name: string;
      price: number;
      quantity?: number;
      category?: string;
    }>;
    category?: string;
    subtotal?: number;
    tax?: number;
  };
  walletAddress: string;
  ipfsHash: string;
  metadataIpfsHash?: string;
  policyId?: string;
  encrypt?: boolean;
}

/**
 * Handler for NFT purchase tasks
 * This processes receipts and mints them as NFTs with passport stamps
 */
class NFTPurchaseHandler {
  constructor() {
    logger.info('NFT Bot using random wallet for testing only. No actual purchases will work!');
  }

  async processTask(task: NFTPurchaseTask): Promise<any> {
    try {
      logger.info(`Processing NFT purchase task: ${task.id}`);

      // Generate metadata URI
      const metadataUri = await this.createMetadataUri(task);
      logger.info(`Created metadata URI: ${metadataUri}`);

      // Generate passport stamp
      const stampUri = await this.generateStamp(task);
      logger.info(`Created stamp URI: ${stampUri}`);

      // Create receipt hash for verification
      const receiptHash = blockchainEnhancedService.createReceiptHash({
        id: task.id,
        merchantName: task.receiptData.merchantName,
        date: task.receiptData.date,
        total: task.receiptData.total,
        items: task.receiptData.items,
        category: task.receiptData.category,
        subtotal: task.receiptData.subtotal,
        tax: task.receiptData.tax
      });

      // Mint the NFT 
      const mintResult = await blockchainEnhancedService.mintReceipt(
        {
          id: task.id,
          merchantName: task.receiptData.merchantName,
          date: task.receiptData.date,
          total: task.receiptData.total,
          items: task.receiptData.items,
          category: task.receiptData.category,
          subtotal: task.receiptData.subtotal,
          tax: task.receiptData.tax
        },
        metadataUri,
        stampUri,
        task.walletAddress,
        task.encrypt || false,
        task.policyId || ''
      );

      logger.info(`NFT minted successfully: ${JSON.stringify(mintResult)}`);

      return {
        ...task,
        tokenId: mintResult.tokenId,
        metadataUri,
        stampUri,
        receiptHash,
        transactionHash: mintResult.transactionHash,
        status: 'completed'
      };
    } catch (error) {
      logger.error(`Error processing NFT purchase task: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Create metadata URI for the NFT
   */
  private async createMetadataUri(task: NFTPurchaseTask): Promise<string> {
    try {
      // Get current date for display
      const displayDate = new Date(task.receiptData.date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });

      // Create metadata JSON
      const metadata = {
        name: `${task.receiptData.merchantName} Receipt - ${displayDate}`,
        description: `Digital receipt from ${task.receiptData.merchantName} for a purchase of $${task.receiptData.total.toFixed(2)} on ${displayDate}`,
        image: `ipfs://${task.ipfsHash}`,
        attributes: [
          {
            trait_type: 'Merchant',
            value: task.receiptData.merchantName
          },
          {
            trait_type: 'Date',
            value: displayDate
          },
          {
            trait_type: 'Total',
            value: `$${task.receiptData.total.toFixed(2)}`
          }
        ]
      };

      // Add category if available
      if (task.receiptData.category) {
        metadata.attributes.push({
          trait_type: 'Category',
          value: task.receiptData.category
        });
      }

      // Add items if available
      if (task.receiptData.items && task.receiptData.items.length > 0) {
        metadata.attributes.push({
          trait_type: 'Items',
          value: task.receiptData.items.length.toString()
        });
      }

      // Upload metadata to IPFS and get URI
      const response = await ipfsService.pinJSON(metadata);
      return `ipfs://${response.IpfsHash}`;
    } catch (error) {
      logger.error(`Error creating metadata URI: ${error instanceof Error ? error.message : String(error)}`);
      throw new Error(`Failed to create metadata URI: ${error}`);
    }
  }

  /**
   * Generate a passport stamp for the receipt
   */
  private async generateStamp(task: NFTPurchaseTask): Promise<string> {
    try {
      // Check if this is a promotional receipt (for demonstration, we'll consider
      // purchases over $100 as promotional)
      const isPromotional = task.receiptData.total > 100;

      // Generate stamp using the stamp service
      const stampUri = await stampService.generateStamp(
        {
          merchantName: task.receiptData.merchantName,
          date: task.receiptData.date,
          total: task.receiptData.total,
          category: task.receiptData.category
        },
        isPromotional
      );

      return stampUri;
    } catch (error) {
      logger.error(`Error generating stamp: ${error instanceof Error ? error.message : String(error)}`);
      // Return default stamp URI if there's an error
      return 'ipfs://QmdefaultStampHash';
    }
  }

  /**
   * Get the bot wallet for testing
   */
  getBotWallet() {
    return mockBotWallet;
  }
}

export const nftPurchaseHandler = new NFTPurchaseHandler();