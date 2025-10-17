import request from 'supertest';
import express from 'express';
import { validateBody, mintSchema, stripePaymentSchema, verifyReceiptSchema } from '../middleware/validation';

// Create test app
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  
  // Test route for mint validation
  app.post('/api/test-mint', validateBody(mintSchema), (req, res) => {
    res.json({ success: true, data: req.body });
  });
  
  // Test route for payment validation
  app.post('/api/test-payment', validateBody(stripePaymentSchema), (req, res) => {
    res.json({ success: true, data: req.body });
  });
  
  // Test route for verification validation
  app.post('/api/test-verify', validateBody(verifyReceiptSchema), (req, res) => {
    res.json({ success: true, data: req.body });
  });
  
  return app;
};

describe('Validation Middleware', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
  });
  
  describe('Mint Schema Validation', () => {
    it('should accept valid mint data', async () => {
      const validData = {
        merchantName: 'Test Store',
        totalAmount: '10.50',
        currency: 'USD',
        items: [
          { name: 'Test Item', quantity: 1, price: '10.50' }
        ],
        walletAddress: '0x1234567890123456789012345678901234567890'
      };
      
      const res = await request(app)
        .post('/api/test-mint')
        .send(validData);
        
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.merchantName).toBe('Test Store');
    });
    
    it('should reject invalid wallet address', async () => {
      const invalidData = {
        merchantName: 'Test Store',
        totalAmount: '10.50',
        currency: 'USD',
        items: [
          { name: 'Test Item', quantity: 1, price: '10.50' }
        ],
        walletAddress: 'invalid-address'
      };
      
      const res = await request(app)
        .post('/api/test-mint')
        .send(invalidData);
        
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
    
    it('should reject missing required fields', async () => {
      const incompleteData = {
        merchantName: 'Test Store'
        // Missing other required fields
      };
      
      const res = await request(app)
        .post('/api/test-mint')
        .send(incompleteData);
        
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
    });
  });
  
  describe('Security Features', () => {
    it('should strip unknown fields', async () => {
      const dataWithExtraFields = {
        merchantName: 'Test Store',
        totalAmount: '10.50',
        currency: 'USD',
        items: [{ name: 'Test Item', quantity: 1, price: '10.50' }],
        walletAddress: '0x1234567890123456789012345678901234567890',
        maliciousField: '<script>alert("xss")</script>',
        anotherBadField: 'DROP TABLE users;'
      };
      
      const res = await request(app)
        .post('/api/test-mint')
        .send(dataWithExtraFields);
        
      expect(res.status).toBe(200);
      expect(res.body.data.maliciousField).toBeUndefined();
      expect(res.body.data.anotherBadField).toBeUndefined();
    });
  });
});