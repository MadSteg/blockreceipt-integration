import request from 'supertest';
import express from 'express';
import { validateBody, schemas } from '../middleware/validation';

describe('Input Validation Middleware', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    // Test route with receipt validation
    app.post('/test/receipt', validateBody(schemas.createReceipt), (req, res) => {
      res.json({ success: true, data: req.body });
    });
  });

  describe('Receipt Validation', () => {
    test('should accept valid receipt data', async () => {
      const validReceipt = {
        userId: 1,
        merchantName: 'Coffee Shop',
        total: 15.99,
        subtotal: 14.50,
        tax: 1.49,
        items: [
          { name: 'Latte', quantity: 1, price: 5.99 }
        ]
      };

      const response = await request(app)
        .post('/test/receipt')
        .send(validReceipt);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject receipt with negative total', async () => {
      const invalidReceipt = {
        userId: 1,
        merchantName: 'Test Store',
        total: -10.00
      };

      const response = await request(app)
        .post('/test/receipt')
        .send(invalidReceipt);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Validation failed');
    });
  });
});