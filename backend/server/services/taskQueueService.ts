/**
 * Task Queue Service for BlockReceipt.ai
 * 
 * This service manages background tasks for computationally expensive operations
 * like OCR processing and blockchain transactions.
 */

import logger from '../logger';
import { EventEmitter } from 'events';

// Define task status enum
export enum TaskStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

// Define task interface
export interface Task {
  id: string;
  type: string;
  status: TaskStatus;
  data: any;
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

/**
 * Task Queue Service Class
 */
class TaskQueueService extends EventEmitter {
  private tasks: Map<string, Task> = new Map();
  private processingCount: number = 0;
  private maxConcurrent: number = 3;
  private handlers: Map<string, (task: Task) => Promise<any>> = new Map();
  private pollingInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    super();
    logger.info('Initializing task queue service');
    
    // Start task processor
    this.startTaskProcessor();
  }
  
  /**
   * Register a task handler
   * @param taskType Task type
   * @param handler Handler function
   */
  registerHandler(taskType: string, handler: (task: Task) => Promise<any>): void {
    logger.info(`Registering handler for task type: ${taskType}`);
    this.handlers.set(taskType, handler);
  }
  
  /**
   * Create a new task
   * @param type Task type
   * @param data Task data
   * @returns Created task
   */
  createTask(type: string, data: any): Task {
    // Generate task ID
    const id = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Create task object
    const task: Task = {
      id,
      type,
      status: TaskStatus.PENDING,
      data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Add to task queue
    this.tasks.set(id, task);
    
    logger.info(`Created ${type} task with ID: ${id}`);
    
    // Emit task created event
    this.emit('taskCreated', task);
    
    return task;
  }
  
  /**
   * Get a task by ID
   * @param id Task ID
   * @returns Task or undefined
   */
  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }
  
  /**
   * Update a task
   * @param id Task ID
   * @param updates Updates to apply
   * @returns Updated task
   */
  updateTask(id: string, updates: Partial<Task>): Task | undefined {
    const task = this.tasks.get(id);
    
    if (!task) {
      return undefined;
    }
    
    // Apply updates
    const updatedTask: Task = {
      ...task,
      ...updates,
      updatedAt: new Date()
    };
    
    // If status changed to completed, set completedAt
    if (updates.status === TaskStatus.COMPLETED && !task.completedAt) {
      updatedTask.completedAt = new Date();
    }
    
    // Update task
    this.tasks.set(id, updatedTask);
    
    // Emit task updated event
    this.emit('taskUpdated', updatedTask);
    
    return updatedTask;
  }
  
  /**
   * Start task processor
   */
  private startTaskProcessor(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
    }
    
    this.pollingInterval = setInterval(() => this.processPendingTasks(), 1000);
    logger.info('Task processor started');
  }
  
  /**
   * Stop task processor
   */
  stopTaskProcessor(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
      logger.info('Task processor stopped');
    }
  }
  
  /**
   * Process pending tasks
   */
  private async processPendingTasks(): Promise<void> {
    // Skip if maximum concurrent tasks are already running
    if (this.processingCount >= this.maxConcurrent) {
      return;
    }
    
    try {
      // Find pending tasks
      const pendingTasks: Task[] = [];
      
      for (const [, task] of this.tasks) {
        if (task.status === TaskStatus.PENDING) {
          pendingTasks.push(task);
          
          // Stop once we have enough tasks to fill available slots
          if (pendingTasks.length >= this.maxConcurrent - this.processingCount) {
            break;
          }
        }
      }
      
      // Process pending tasks
      for (const task of pendingTasks) {
        // Skip if handler not found
        if (!this.handlers.has(task.type)) {
          this.updateTask(task.id, {
            status: TaskStatus.FAILED,
            error: `No handler registered for task type: ${task.type}`
          });
          continue;
        }
        
        // Update task status to processing
        this.updateTask(task.id, { status: TaskStatus.PROCESSING });
        this.processingCount++;
        
        // Process task asynchronously
        this.processTask(task).finally(() => {
          this.processingCount--;
        });
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error processing pending tasks: ${errorMessage}`);
    }
  }
  
  /**
   * Process a single task
   * @param task Task to process
   */
  private async processTask(task: Task): Promise<void> {
    const handler = this.handlers.get(task.type);
    
    if (!handler) {
      this.updateTask(task.id, {
        status: TaskStatus.FAILED,
        error: `No handler found for task type: ${task.type}`
      });
      return;
    }
    
    try {
      logger.info(`Processing ${task.type} task ${task.id}`);
      
      // Execute handler
      const result = await handler(task);
      
      // Update task with result
      this.updateTask(task.id, {
        status: TaskStatus.COMPLETED,
        result
      });
      
      logger.info(`Task ${task.id} completed successfully`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Task ${task.id} failed: ${errorMessage}`);
      
      // Update task with error
      this.updateTask(task.id, {
        status: TaskStatus.FAILED,
        error: errorMessage
      });
    }
  }
  
  /**
   * Get tasks by status
   * @param status Task status
   * @returns Array of tasks
   */
  getTasksByStatus(status: TaskStatus): Task[] {
    const matchingTasks: Task[] = [];
    
    for (const [, task] of this.tasks) {
      if (task.status === status) {
        matchingTasks.push(task);
      }
    }
    
    return matchingTasks;
  }
  
  /**
   * Get all tasks
   * @returns Array of all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }
  
  /**
   * Clean up completed tasks
   * @param olderThan Timestamp for filtering old tasks
   */
  cleanupCompletedTasks(olderThan?: Date): void {
    const now = olderThan || new Date();
    let count = 0;
    
    for (const [id, task] of this.tasks) {
      if (
        (task.status === TaskStatus.COMPLETED || task.status === TaskStatus.FAILED) &&
        task.completedAt &&
        task.completedAt < now
      ) {
        this.tasks.delete(id);
        count++;
      }
    }
    
    if (count > 0) {
      logger.info(`Cleaned up ${count} completed/failed tasks`);
    }
  }
}

// Export singleton instance
export const taskQueueService = new TaskQueueService();