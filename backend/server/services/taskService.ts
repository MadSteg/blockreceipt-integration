/**
 * Task Service
 * 
 * This service handles long-running tasks like NFT minting
 * It provides a way to track task status and retrieve results
 */

import { logger } from '../utils/logger';

// Task types
export type TaskType = 'nft_mint' | 'image_processing' | 'receipt_analysis';

// Task status
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Task entity
export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  walletAddress?: string;
  data?: any;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory task storage for development
// In production, this would be a database table
const tasks = new Map<string, Task>();

/**
 * Generate a unique task ID
 */
function generateTaskId(type: TaskType): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000000);
  return `task-${timestamp}-${random}`;
}

/**
 * Create a new task
 */
export function createTask(
  type: TaskType,
  walletAddress?: string,
  initialData?: any
): Task {
  const taskId = generateTaskId(type);
  const now = new Date();
  
  const task: Task = {
    id: taskId,
    type,
    status: 'pending',
    walletAddress,
    data: initialData,
    createdAt: now,
    updatedAt: now
  };
  
  tasks.set(taskId, task);
  
  logger.info(`Task created: ${taskId} of type ${type}${walletAddress ? ` for wallet ${walletAddress}` : ''}`);
  
  return task;
}

/**
 * Get a task by ID
 */
export function getTask(taskId: string): Task | undefined {
  return tasks.get(taskId);
}

/**
 * Update a task's status and optionally add result data
 */
export function updateTask(
  taskId: string,
  status: TaskStatus,
  result?: any,
  error?: string
): Task | undefined {
  const task = tasks.get(taskId);
  
  if (!task) {
    return undefined;
  }
  
  task.status = status;
  task.updatedAt = new Date();
  
  if (result !== undefined) {
    task.result = result;
  }
  
  if (error !== undefined) {
    task.error = error;
  }
  
  logger.info(`Task ${taskId} updated to status: ${status}`);
  
  return task;
}

/**
 * Process a task asynchronously
 */
export async function processTask<T>(
  taskId: string,
  processor: () => Promise<T>
): Promise<T | undefined> {
  const task = getTask(taskId);
  
  if (!task) {
    logger.error(`Cannot process non-existent task: ${taskId}`);
    return undefined;
  }
  
  try {
    // Update task to processing
    updateTask(taskId, 'processing');
    
    // Run the processor function
    const result = await processor();
    
    // Update task to completed with the result
    updateTask(taskId, 'completed', result);
    
    return result;
  } catch (error: any) {
    // Update task to failed with the error
    updateTask(taskId, 'failed', undefined, error.message);
    logger.error(`Task ${taskId} failed:`, error);
    return undefined;
  }
}

/**
 * Get all tasks for a specific wallet
 */
export function getTasksByWallet(walletAddress: string): Task[] {
  return Array.from(tasks.values())
    .filter(task => task.walletAddress === walletAddress);
}

/**
 * Clean up old completed or failed tasks
 * (would be a cron job in production)
 */
export function cleanupOldTasks(maxAgeHours: number = 24): void {
  const now = new Date();
  const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds
  
  for (const [taskId, task] of tasks.entries()) {
    if ((task.status === 'completed' || task.status === 'failed') &&
        now.getTime() - task.updatedAt.getTime() > maxAge) {
      tasks.delete(taskId);
      logger.info(`Cleaned up old task: ${taskId}`);
    }
  }
}