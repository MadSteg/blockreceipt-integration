/**
 * Authentication utilities
 */
import { Request, Response, NextFunction } from 'express';
import logger from './logger';

/**
 * Middleware to check if the user is authenticated
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  // Check if user is authenticated via session
  if (req.session && req.session.userId) {
    return next();
  }
  
  // If this is development mode, allow certain routes for testing
  if (process.env.NODE_ENV === 'development') {
    // For development, we can check for a special header or query param
    // This is not secure and should never be used in production
    if (req.headers['x-dev-auth'] === 'true' || req.query.devAuth === 'true') {
      logger.warn('Using development authentication bypass - NOT SECURE FOR PRODUCTION');
      return next();
    }
  }
  
  // User is not authenticated
  return res.status(401).json({ error: 'Unauthorized' });
};

/**
 * Middleware to check if the user has a wallet address
 */
export const hasWallet = (req: Request, res: Response, next: NextFunction) => {
  // Check if user is authenticated and has a wallet
  if (req.session && req.session.walletAddress) {
    return next();
  }
  
  // If this is development mode, allow certain routes for testing
  if (process.env.NODE_ENV === 'development') {
    // For development, we can check for a special header or query param
    if (req.headers['x-dev-wallet'] || req.query.devWallet) {
      const walletAddress = 
        req.headers['x-dev-wallet'] as string || 
        req.query.devWallet as string ||
        '0x1234567890123456789012345678901234567890';
        
      logger.warn(`Using development wallet bypass (${walletAddress}) - NOT SECURE FOR PRODUCTION`);
      req.user = { walletAddress };
      return next();
    }
  }
  
  // User doesn't have a wallet
  return res.status(403).json({ error: 'Wallet connection required' });
};