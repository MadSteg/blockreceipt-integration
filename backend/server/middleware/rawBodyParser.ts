/**
 * Raw Body Parser Middleware
 * 
 * This middleware captures the raw request body for webhook
 * signature verification purposes, making it available at req.rawBody
 */
import { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include rawBody
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
    }
  }
}

export function rawBodyParser(req: Request, res: Response, next: NextFunction) {
  // Skip for PRE encryption routes to avoid conflicts
  if (req.path.includes('/api/pre/') || req.path.includes('/api/taco/')) {
    return next();
  }

  let data = '';
  
  // Skip if not a POST request or body already parsed
  if (req.method !== 'POST' || req.body) {
    return next();
  }
  
  req.setEncoding('utf8');
  
  req.on('data', (chunk) => {
    data += chunk;
  });
  
  req.on('end', () => {
    if (data) {
      req.rawBody = data;
      
      // Try to parse JSON
      try {
        req.body = JSON.parse(data);
      } catch (e) {
        // If parsing fails, let the next middleware handle it
      }
    }
    
    next();
  });
}