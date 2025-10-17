/**
 * Authentication Middleware
 * 
 * A simplified middleware for requiring authentication in development
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Middleware to require authentication for a route
 * For development, this will allow all requests through
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  // For development, just pass through
  if (process.env.NODE_ENV === 'development') {
    // Attach mock user data for development
    (req as any).user = {
      id: 1,
      username: 'devuser',
      email: 'dev@example.com',
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e'
    };
    logger.debug('Development mode: Auth check bypassed');
    return next();
  }
  
  // In production, check if user is authenticated
  if (!(req as any).isAuthenticated || !(req as any).isAuthenticated()) {
    logger.warn('Unauthorized access attempt');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'You must be logged in to access this resource'
    });
  }
  
  next();
};