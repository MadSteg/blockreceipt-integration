import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Validation schemas
export const mintSchema = Joi.object({
  merchantName: Joi.string().min(1).max(100).required(),
  totalAmount: Joi.string().pattern(/^[0-9]+(\.[0-9]{1,2})?$/).required(),
  currency: Joi.string().valid('USD', 'EUR', 'GBP', 'CAD').required(),
  items: Joi.array().items(
    Joi.object({
      name: Joi.string().min(1).max(200).required(),
      quantity: Joi.number().integer().min(1).max(1000).required(),
      price: Joi.string().pattern(/^[0-9]+(\.[0-9]{1,2})?$/).required()
    })
  ).min(1).max(50).required(),
  walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});

export const stripePaymentSchema = Joi.object({
  amount: Joi.number().min(0.50).max(999999.99).required(),
  currency: Joi.string().valid('usd', 'eur', 'gbp', 'cad').required(),
  receiptData: Joi.object({
    merchantName: Joi.string().min(1).max(100).required(),
    items: Joi.array().items(
      Joi.object({
        name: Joi.string().min(1).max(200).required(),
        quantity: Joi.number().integer().min(1).required(),
        price: Joi.number().min(0).required()
      })
    ).min(1).required()
  }).optional()
});

export const verifyReceiptSchema = Joi.object({
  tokenId: Joi.string().pattern(/^[0-9]+$/).required(),
  contractAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required()
});

export const walletConnectionSchema = Joi.object({
  walletAddress: Joi.string().pattern(/^0x[a-fA-F0-9]{40}$/).required(),
  signature: Joi.string().min(10).max(500).required()
});

// Validation middleware factory
export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // Include all errors
      stripUnknown: true // Remove unknown fields
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Validation failed',
        details: errorMessages
      });
    }

    // Replace req.body with validated and sanitized data
    req.body = value;
    next();
  };
};

// Query parameter validation
export const validateQuery = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      return res.status(400).json({
        error: 'Query validation failed',
        details: errorMessages
      });
    }

    req.query = value;
    next();
  };
};

// Sanitization helpers
export const sanitizeInput = {
  // Remove potentially dangerous characters
  cleanString: (input: string): string => {
    return input.replace(/[<>\"']/g, '').trim();
  },
  
  // Validate and clean wallet addresses
  cleanWalletAddress: (address: string): string => {
    const cleaned = address.toLowerCase().trim();
    if (!/^0x[a-f0-9]{40}$/.test(cleaned)) {
      throw new Error('Invalid wallet address format');
    }
    return cleaned;
  },
  
  // Clean monetary amounts
  cleanAmount: (amount: string): number => {
    const cleaned = parseFloat(amount);
    if (isNaN(cleaned) || cleaned < 0) {
      throw new Error('Invalid amount format');
    }
    return Math.round(cleaned * 100) / 100; // Round to 2 decimal places
  }
};