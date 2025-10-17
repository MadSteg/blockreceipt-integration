/**
 * Toast Webhook Signature Verification Middleware
 * 
 * This middleware validates incoming webhook requests from Toast POS
 * by verifying the HMAC signature in the Toast-Signature header.
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function verifyToastSignature(req: Request, res: Response, next: NextFunction) {
  try {
    // Get the signature from the request header
    const signature = req.get('Toast-Signature');
    
    if (!signature) {
      logger.warn('Missing Toast-Signature header');
      return res.status(401).json({ error: 'Missing signature header' });
    }
    
    if (!process.env.TOAST_SECRET) {
      logger.error('Missing TOAST_SECRET environment variable');
      return res.status(500).json({ error: 'Service misconfiguration' });
    }
    
    // Create HMAC using the shared secret from environment variables
    const hmac = crypto.createHmac('sha256', process.env.TOAST_SECRET || 'toast-test-secret')
      .update(typeof req.body === 'object' ? JSON.stringify(req.body) : req.rawBody || '')
      .digest('hex');
    
    // Compare the computed HMAC with the provided signature
    if (hmac !== signature) {
      logger.warn('Invalid Toast webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }
    
    // If signature verification is successful, proceed to the route handler
    logger.info('Toast webhook signature verified');
    next();
  } catch (error) {
    logger.error('Error verifying Toast signature:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}