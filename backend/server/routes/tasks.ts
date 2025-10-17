/**
 * Task Queue Routes
 * 
 * Routes for checking task statuses and managing background tasks.
 */

import express, { Request, Response } from 'express';

const router = express.Router();

// Route for checking task status
router.get('/task/:taskId/status', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    // In development/testing we'll just simulate a task status
    // This would normally come from a database or task queue service
    const mockStatus = {
      id: taskId,
      status: getTaskStatusByTime(taskId),
      progress: getTaskProgressByTime(taskId),
      result: getTaskResult(taskId),
      error: null
    };
    
    res.json({
      success: true,
      status: mockStatus.status,
      progress: mockStatus.progress,
      result: mockStatus.result,
      error: mockStatus.error
    });
  } catch (error: any) {
    console.error('Error getting task status:', error);
    res.status(500).json({
      success: false,
      message: `Error getting task status: ${error.message || 'Unknown error'}`
    });
  }
});

// Helper functions for mock task status in development
function getTaskStatusByTime(taskId: string): 'pending' | 'processing' | 'completed' | 'failed' {
  const now = Date.now();
  const taskCreationTime = parseInt(taskId.split('-')[0] || '0', 10);
  const timeDiff = now - taskCreationTime;
  
  // Task lifecycle: pending (0-5s) -> processing (5-15s) -> completed (15s+)
  if (timeDiff < 5000) return 'pending';
  if (timeDiff < 15000) return 'processing';
  return 'completed';
}

function getTaskProgressByTime(taskId: string): number {
  const now = Date.now();
  const taskCreationTime = parseInt(taskId.split('-')[0] || '0', 10);
  const timeDiff = now - taskCreationTime;
  
  // Calculate progress based on time elapsed (5-15s timeframe)
  if (timeDiff < 5000) return 0;
  if (timeDiff > 15000) return 100;
  
  // Map 5000-15000 to 0-100
  return Math.floor(((timeDiff - 5000) / 10000) * 100);
}

function getTaskResult(taskId: string): any {
  const now = Date.now();
  const taskCreationTime = parseInt(taskId.split('-')[0] || '0', 10);
  const timeDiff = now - taskCreationTime;
  
  // Only return result if task is completed
  if (timeDiff < 15000) return null;
  
  // Mock transaction hash and token ID from task ID
  return {
    transactionHash: `0x${taskId.slice(0, 40).padEnd(64, '0')}`,
    tokenId: parseInt(taskId.slice(0, 8), 16) % 1000,
    contractAddress: '0x1111111111111111111111111111111111111111'
  };
}

export default router;