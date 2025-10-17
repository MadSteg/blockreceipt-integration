/**
 * Task Queue Service for BlockReceipt
 * 
 * Manages asynchronous tasks like NFT purchases and fallback minting
 * with proper tracking and error handling.
 */

import { nftPurchaseBot } from './nftPurchaseBot';
import { encryptLineItems } from './tpreService';
import { metadataService } from './metadataService';

type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

interface Task {
  id: string;
  type: 'nft_purchase' | 'fallback_mint' | 'metadata_encryption';
  status: TaskStatus;
  data: any;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  walletAddress: string;
  receiptId: string;
}

// In-memory storage for task queue (replace with DB in production)
const taskQueue: Map<string, Task> = new Map();

/**
 * Generate a unique task ID
 */
function generateTaskId(): string {
  return `task-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

/**
 * Create a new task and add it to the queue
 */
export function createTask(
  type: 'nft_purchase' | 'fallback_mint' | 'metadata_encryption',
  data: any,
  walletAddress: string,
  receiptId: string
): Task {
  const taskId = generateTaskId();
  const now = new Date();
  
  const task: Task = {
    id: taskId,
    type,
    status: 'pending',
    data,
    createdAt: now,
    updatedAt: now,
    walletAddress,
    receiptId
  };
  
  taskQueue.set(taskId, task);
  console.log(`Task created: ${taskId} of type ${type} for wallet ${walletAddress}`);
  
  // Start processing the task immediately
  processTask(taskId).catch(err => {
    console.error(`Error processing task ${taskId}:`, err);
    updateTaskStatus(taskId, 'failed', { error: err.message || 'Unknown error' });
  });
  
  return task;
}

/**
 * Update the status of a task
 */
export function updateTaskStatus(
  taskId: string, 
  status: TaskStatus, 
  updates: Partial<Task> = {}
): Task | null {
  const task = taskQueue.get(taskId);
  
  if (!task) {
    console.warn(`Attempted to update non-existent task: ${taskId}`);
    return null;
  }
  
  const updatedTask = {
    ...task,
    ...updates,
    status,
    updatedAt: new Date()
  };
  
  taskQueue.set(taskId, updatedTask);
  console.log(`Task ${taskId} updated to status: ${status}`);
  
  return updatedTask;
}

/**
 * Get a task by ID
 */
export function getTaskById(taskId: string): Task | null {
  return taskQueue.get(taskId) || null;
}

/**
 * Get all tasks for a wallet address
 */
export function getTasksByWallet(walletAddress: string): Task[] {
  return Array.from(taskQueue.values())
    .filter(task => task.walletAddress === walletAddress)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

/**
 * Process a task based on its type
 */
async function processTask(taskId: string): Promise<void> {
  const task = taskQueue.get(taskId);
  
  if (!task) {
    console.warn(`Attempted to process non-existent task: ${taskId}`);
    return;
  }
  
  updateTaskStatus(taskId, 'processing');
  
  try {
    let result;
    
    switch (task.type) {
      case 'nft_purchase':
        // Try to purchase an NFT from the marketplace
        console.log(`Processing NFT purchase task ${taskId} for wallet ${task.walletAddress}`);
        result = await nftPurchaseBot.purchaseAndTransferNFT(
          task.walletAddress,
          task.receiptId,
          task.data.receiptData
        );
        
        if (result && result.success) {
          // NFT purchase successful
          updateTaskStatus(taskId, 'completed', { result });
          
          // If we have encrypted metadata, update the encryption with the token ID
          if (task.data.encryptedMetadata) {
            createTask(
              'metadata_encryption',
              {
                encryptedMetadata: task.data.encryptedMetadata,
                tokenId: result.tokenId
              },
              task.walletAddress,
              task.receiptId
            );
          }
        } else {
          // NFT purchase failed, try fallback minting
          console.log(`NFT purchase failed for ${task.walletAddress}, trying fallback mint...`);
          createTask(
            'fallback_mint',
            task.data,
            task.walletAddress,
            task.receiptId
          );
          
          updateTaskStatus(taskId, 'failed', { 
            error: 'NFT marketplace purchase failed, trying fallback mint', 
            result 
          });
        }
        break;
        
      case 'fallback_mint':
        // Mint a fallback NFT from our collection
        console.log(`Processing fallback mint task ${taskId} for wallet ${task.walletAddress}`);
        result = await nftPurchaseBot.mintFallbackNFT(
          task.walletAddress,
          task.receiptId,
          task.data.receiptData
        );
        
        if (result && result.success) {
          // Fallback mint successful
          updateTaskStatus(taskId, 'completed', { result });
          
          // If we have encrypted metadata, update the encryption with the token ID
          if (task.data.encryptedMetadata) {
            createTask(
              'metadata_encryption',
              {
                encryptedMetadata: task.data.encryptedMetadata,
                tokenId: result.tokenId
              },
              task.walletAddress,
              task.receiptId
            );
          }
        } else {
          // Fallback mint failed
          updateTaskStatus(taskId, 'failed', { 
            error: 'Fallback NFT minting failed', 
            result 
          });
        }
        break;
        
      case 'metadata_encryption':
        // Store or update encrypted metadata with token ID using metadataService
        console.log(`Processing metadata encryption task ${taskId} for wallet ${task.walletAddress}`);
        
        const { encryptedMetadata, tokenId } = task.data;
        
        if (!encryptedMetadata || !tokenId) {
          updateTaskStatus(taskId, 'failed', { 
            error: 'Missing required data (encryptedMetadata or tokenId)',
            result: { encryptionStatus: 'failed' } 
          });
          break;
        }
        
        // Extract TACo metadata
        const { policyId, capsuleId, ciphertext } = encryptedMetadata;
        
        if (!policyId || !capsuleId || !ciphertext) {
          updateTaskStatus(taskId, 'failed', { 
            error: 'Invalid encryption metadata (missing policyId, capsuleId, or ciphertext)',
            result: { encryptionStatus: 'failed' } 
          });
          break;
        }
        
        // Prepare complete metadata package with TACo encryption details
        const tacoMetadata = {
          policyPublicKey: policyId,
          capsule: capsuleId,
          ciphertext: ciphertext,
          tokenId: tokenId,
          receiptId: task.receiptId,
          encryptedAt: new Date().toISOString()
        };
        
        // Create preview data with non-sensitive information
        const previewData = {
          receiptId: task.receiptId,
          tokenId: tokenId,
          walletAddress: task.walletAddress,
          timestamp: new Date().toISOString(),
          status: 'encrypted'
        };
        
        // Store the complete metadata (including TACo details) in the database
        const metadataStored = await metadataService.storeEncryptedMetadata(
          tokenId,
          task.walletAddress,
          JSON.stringify(tacoMetadata),
          previewData
        );
        
        if (metadataStored) {
          console.log(`✅ Successfully stored encrypted metadata for receipt ${task.receiptId} with tokenId ${tokenId}`);
          console.log(`TACo encryption details:
            Policy key: ${policyId.substring(0, 15)}...
            Capsule: ${capsuleId.substring(0, 15)}...
            Ciphertext: ${ciphertext.substring(0, 30)}...
          `);
          
          updateTaskStatus(taskId, 'completed', { 
            result: { 
              tokenId,
              encryptionStatus: 'stored',
              message: 'Encrypted metadata successfully stored with NFT'
            } 
          });
        } else {
          console.error(`❌ Failed to store encrypted metadata for receipt ${task.receiptId} with tokenId ${tokenId}`);
          updateTaskStatus(taskId, 'failed', { 
            error: 'Failed to store encrypted metadata',
            result: { 
              tokenId,
              encryptionStatus: 'failed'
            } 
          });
        }
        break;
        
      default:
        updateTaskStatus(taskId, 'failed', { error: `Unknown task type: ${task.type}` });
        break;
    }
  } catch (error: any) {
    console.error(`Error processing task ${taskId} of type ${task.type}:`, error);
    updateTaskStatus(taskId, 'failed', { error: error.message || 'Unknown error' });
  }
}

/**
 * Create an NFT purchase task with receipt data and wallet address
 */
export function createNFTPurchaseTask(
  walletAddress: string,
  receiptId: string,
  receiptData: any,
  encryptedMetadata?: any
): Task {
  return createTask('nft_purchase', { receiptData, encryptedMetadata }, walletAddress, receiptId);
}

/**
 * Get the status of the NFT purchase process for a receipt
 */
export function getNFTPurchaseStatus(receiptId: string): Task | null {
  const tasks = Array.from(taskQueue.values())
    .filter(task => task.receiptId === receiptId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  
  return tasks.length > 0 ? tasks[0] : null;
}

/**
 * Get task status with relevant data for frontend display
 */
export function getTaskStatus(taskId: string): any {
  const task = getTaskById(taskId);
  
  if (!task) {
    return null;
  }
  
  // Get cleaned version of task status for frontend
  return {
    id: task.id,
    status: task.status,
    type: task.type,
    result: task.result,
    error: task.error,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    // Format the result for display based on task type
    nft: task.status === 'completed' && task.result ? {
      tokenId: task.result.tokenId,
      name: task.result.name,
      imageUrl: task.result.imageUrl,
      contractAddress: task.result.contractAddress,
      marketplace: task.result.marketplace,
      txHash: task.result.txHash
    } : undefined
  };
}

export default {
  createTask,
  createNFTPurchaseTask,
  getTaskById,
  getTasksByWallet,
  getNFTPurchaseStatus,
  updateTaskStatus,
  getTaskStatus
};