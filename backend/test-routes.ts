import { Router } from 'express';
import { storage } from './storage-real';

const router = Router();

// Test endpoint to verify database functionality
router.get('/test/database', async (req, res) => {
  try {
    console.log('Testing database connection...');
    
    const userCount = await storage.getUserCount();
    const receiptCount = await storage.getReceiptCount();
    
    res.json({
      success: true,
      database: {
        connected: true,
        userCount,
        receiptCount
      },
      message: 'Database is fully operational!'
    });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Database connection failed'
    });
  }
});

// Test user creation
router.post('/test/create-user', async (req, res) => {
  try {
    const testUser = await storage.createUser({
      email: `test-${Date.now()}@example.com`,
      password: 'test123',
      username: `testuser_${Date.now()}`,
      fullName: 'Test User'
    });
    
    res.json({
      success: true,
      user: testUser,
      message: 'User created successfully'
    });
  } catch (error) {
    console.error('User creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;