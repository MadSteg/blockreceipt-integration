import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to check if user is authenticated
 * @param req Request object
 * @param res Response object
 * @param next Next function
 */
export const isAuthenticated = (req: Request, res: Response, next: NextFunction): void => {
  // For development/testing purposes, we'll skip authentication checks
  if (process.env.NODE_ENV === 'development') {
    // In development, attach a mock user to the request
    (req as any).user = {
      id: 1,
      username: 'testuser',
      email: 'test@example.com',
      walletAddress: '0x1234567890123456789012345678901234567890',
    };
    return next();
  }
  
  // In production, check if user is authenticated
  if ((req as any).isAuthenticated && (req as any).isAuthenticated()) {
    return next();
  }
  
  // User is not authenticated
  res.status(401).json({ message: 'Unauthorized - Please login to continue' });
};

/**
 * Middleware to check if request has a valid API key
 * @param req Request object
 * @param res Response object 
 * @param next Next function
 */
export const apiKeyAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // For development/testing purposes, we'll skip API key checks
  if (process.env.NODE_ENV === 'development') {
    return next();
  }
  
  // In production, check for a valid API key in the request headers
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json({ message: 'API key is missing' });
  }
  
  // TODO: Validate the API key against the database
  // For now, in development we'll just check if any key is provided
  
  next();
};