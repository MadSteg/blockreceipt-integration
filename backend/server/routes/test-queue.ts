/**
 * Test Routes for Task Queue
 * 
 * These routes allow for testing the task queue functionality
 * without needing to go through the entire receipt upload flow.
 */

import express, { Request, Response } from 'express';
import { createTask, createNFTPurchaseTask, getTaskById } from '../services/taskQueue';

const router = express.Router();

// Create a test task
router.post('/test-task', (req: Request, res: Response) => {
  try {
    const { type, walletAddress, data } = req.body;
    
    if (!type || !walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Task type and wallet address are required'
      });
    }
    
    const receiptId = `test-receipt-${Date.now()}`;
    const receiptData = data || {
      merchantName: 'Test Merchant',
      date: new Date().toISOString(),
      total: 99.99,
      subtotal: 89.99,
      tax: 10.00,
      items: [
        { name: 'Test Product', price: 89.99 }
      ]
    };
    
    // Create the task
    const task = createNFTPurchaseTask(
      walletAddress,
      receiptId,
      receiptData
    );
    
    return res.status(201).json({
      success: true,
      message: 'Test task created successfully',
      task
    });
  } catch (error: any) {
    console.error('Error creating test task:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create test task',
      error: error.message || 'Unknown error'
    });
  }
});

// Get task status
router.get('/test-task/:taskId', (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'Task ID is required'
      });
    }
    
    const task = getTaskById(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    return res.status(200).json({
      success: true,
      task
    });
  } catch (error: any) {
    console.error('Error retrieving test task:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve test task',
      error: error.message || 'Unknown error'
    });
  }
});

export default router;