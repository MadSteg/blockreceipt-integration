import express from 'express';
import crypto from 'crypto';
import { merchantMatchingService } from '../services/merchantMatchingService';
import { verifyToastSignature } from '../middleware/verifyToastSignature';
import { logger } from '../utils/logger';

const router = express.Router();

// In-memory store for POS orders (in production, use a database)
const posOrders = new Map();

/**
 * Verify Square signature
 */
function verifySquareSignature(req: any, res: any, next: any) {
  try {
    const squareSignature = req.headers['square-signature'];
    
    if (!squareSignature) {
      return res.status(401).json({ message: 'Missing Square signature' });
    }
    
    // In production, retrieve this from environment variables or secure storage
    const squareSecret = process.env.SQUARE_WEBHOOK_SECRET || 'square-test-secret';
    
    // Create HMAC
    const hmac = crypto.createHmac('sha256', squareSecret);
    hmac.update(JSON.stringify(req.body));
    const expectedSignature = hmac.digest('hex');
    
    if (squareSignature !== expectedSignature) {
      return res.status(401).json({ message: 'Invalid Square signature' });
    }
    
    next();
  } catch (error) {
    console.error('Error verifying Square signature:', error);
    res.status(500).json({ message: 'Error verifying webhook signature' });
  }
}

/**
 * Toast POS Webhook
 * POST /api/pos/webhook/toast
 */
router.post('/webhook/toast', verifyToastSignature, async (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (event === 'order.created' || event === 'order.updated') {
      // Extract relevant data from Toast order
      const order = {
        id: data.guid,
        merchantId: 'TOAST_' + (data.restaurantGuid || 'UNKNOWN'),
        timestamp: new Date(data.createdDate).getTime(),
        total: data.totalAmount,
        subtotal: data.subtotalAmount,
        items: data.items?.map((item: any) => ({
          name: item.name,
          price: item.totalAmount,
          quantity: item.quantity
        })) || []
      };
      
      // Store the order
      posOrders.set(order.id.toString(), {
        ...order,
        source: 'toast',
        rawData: data
      });
      
      console.log(`[POS] Received Toast order: ${order.id}`);
      
      res.status(200).json({ status: 'success', orderId: order.id });
    } else {
      res.status(200).json({ status: 'ignored', event });
    }
  } catch (error) {
    console.error('Error processing Toast webhook:', error);
    res.status(500).json({ message: 'Error processing webhook' });
  }
});

/**
 * Square POS Webhook
 * POST /api/pos/webhook/square
 */
router.post('/webhook/square', verifySquareSignature, async (req, res) => {
  try {
    const { type, data } = req.body;
    
    if (type === 'order.created' || type === 'order.updated') {
      const orderData = data.object.order;
      
      // Extract relevant data from Square order
      const order = {
        id: orderData.id,
        merchantId: 'SQUARE_' + (orderData.location_id || 'UNKNOWN'),
        timestamp: new Date(orderData.created_at).getTime(),
        total: parseFloat(orderData.total_money.amount) / 100, // Square amounts are in cents
        subtotal: parseFloat(orderData.total_money.amount - (orderData.total_tax_money?.amount || 0)) / 100,
        items: orderData.line_items?.map((item: any) => ({
          name: item.name,
          price: parseFloat(item.total_money.amount) / 100,
          quantity: item.quantity
        })) || []
      };
      
      // Store the order
      posOrders.set(order.id, {
        ...order,
        source: 'square',
        rawData: orderData
      });
      
      console.log(`[POS] Received Square order: ${order.id}`);
      
      res.status(200).json({ status: 'success', orderId: order.id });
    } else {
      res.status(200).json({ status: 'ignored', type });
    }
  } catch (error) {
    console.error('Error processing Square webhook:', error);
    res.status(500).json({ message: 'Error processing webhook' });
  }
});

/**
 * Clover POS Webhook
 * POST /api/pos/webhook/clover
 */
router.post('/webhook/clover', async (req, res) => {
  try {
    const { type, merchants, payload } = req.body;
    
    if (type === 'ORDER_CREATED' || type === 'ORDER_UPDATED') {
      const orderData = payload;
      
      // Extract relevant data from Clover order
      const order = {
        id: orderData.id,
        merchantId: 'CLOVER_' + (merchants[0] || 'UNKNOWN'),
        timestamp: orderData.createdTime,
        total: orderData.total / 100, // Clover amounts are in cents
        subtotal: (orderData.total - (orderData.taxAmount || 0)) / 100,
        items: orderData.lineItems?.elements?.map((item: any) => ({
          name: item.name,
          price: item.price / 100,
          quantity: item.quantity
        })) || []
      };
      
      // Store the order
      posOrders.set(order.id, {
        ...order,
        source: 'clover',
        rawData: orderData
      });
      
      console.log(`[POS] Received Clover order: ${order.id}`);
      
      res.status(200).json({ status: 'success', orderId: order.id });
    } else {
      res.status(200).json({ status: 'ignored', type });
    }
  } catch (error) {
    console.error('Error processing Clover webhook:', error);
    res.status(500).json({ message: 'Error processing webhook' });
  }
});

/**
 * Find a POS order that matches the receipt
 * @param merchantId Merchant ID
 * @param total Receipt total
 * @param timestamp Receipt timestamp
 * @returns Matching POS order or undefined
 */
export function findMatchingPOSOrder(merchantId: string, total: number, timestamp: number): any {
  // Allow for some timestamp variance (within 15 minutes)
  const timestampVariance = 15 * 60 * 1000; // 15 minutes in milliseconds
  const minTimestamp = timestamp - timestampVariance;
  const maxTimestamp = timestamp + timestampVariance;
  
  // Allow for slight total variance (1%)
  const maxTotalVariance = 0.01;
  
  for (const [_, order] of posOrders) {
    // Check if merchant IDs match (partially)
    const merchantMatch = order.merchantId.includes(merchantId) || 
                          merchantId.includes(order.merchantId);
                         
    // Check if totals are close enough
    const totalDiff = Math.abs(order.total - total) / total;
    const totalMatch = totalDiff <= maxTotalVariance;
    
    // Check if timestamps are close enough
    const timestampMatch = order.timestamp >= minTimestamp && 
                           order.timestamp <= maxTimestamp;
    
    if (merchantMatch && totalMatch && timestampMatch) {
      return order;
    }
  }
  
  return undefined;
}

/**
 * Get webhook setup URLs for POS integrations
 * GET /api/pos/webhook-urls
 */
router.get('/webhook-urls', async (req, res) => {
  try {
    const host = req.headers.host || 'localhost';
    const protocol = req.protocol || 'https';
    
    const webhookUrls = {
      toast: `${protocol}://${host}/api/pos/webhook/toast`,
      square: `${protocol}://${host}/api/pos/webhook/square`,
      clover: `${protocol}://${host}/api/pos/webhook/clover`
    };
    
    res.json(webhookUrls);
  } catch (error) {
    console.error('Error generating webhook URLs:', error);
    res.status(500).json({ message: 'Error generating webhook URLs' });
  }
});

/**
 * Get all stored POS orders (for debugging)
 * GET /api/pos/orders
 */
router.get('/orders', async (req, res) => {
  try {
    const orders = Array.from(posOrders.values()).map(order => {
      // Don't return raw data in the response
      const { rawData, ...orderData } = order;
      return orderData;
    });
    
    res.json(orders);
  } catch (error) {
    console.error('Error fetching POS orders:', error);
    res.status(500).json({ message: 'Error fetching POS orders' });
  }
});

export default router;