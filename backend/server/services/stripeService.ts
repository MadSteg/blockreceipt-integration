/**
 * Stripe Payment Service
 * Handles payment processing with Stripe
 */
import Stripe from 'stripe';
import { log } from '../vite';

// Global state
let stripeClient: Stripe | null = null;
let mockMode = false;

/**
 * Initialize Stripe service
 */
export function initializeStripeService() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  
  if (stripeKey) {
    try {
      stripeClient = new Stripe(stripeKey, {
        apiVersion: '2022-11-15',
      });
      log('Stripe payment service initialized successfully', 'payments');
    } catch (error: any) {
      log(`Error initializing Stripe: ${error.message}`, 'payments');
      mockMode = true;
      log('Falling back to mock payment mode', 'payments');
    }
  } else {
    log('Missing Stripe secret key, using mock payment mode', 'payments');
    mockMode = true;
  }
}

/**
 * Check if Stripe service is available
 */
export function isAvailable() {
  return {
    available: !!stripeClient,
    mockMode,
  };
}

/**
 * Create a payment intent with Stripe
 * In mock mode, creates a fake payment intent
 */
export async function createPaymentIntent(
  amount: number,
  currency: string = 'usd',
  metadata: Record<string, string> = {}
) {
  // If Stripe is available, create a real payment intent
  if (stripeClient && !mockMode) {
    try {
      const paymentIntent = await stripeClient.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency,
        metadata,
      });
      
      return {
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
      };
    } catch (error: any) {
      log(`Error creating payment intent: ${error.message}`, 'payments');
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // If in mock mode, create a fake payment intent
  const mockPaymentIntentId = `pi_mock_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  const mockClientSecret = `${mockPaymentIntentId}_secret_${Math.floor(Math.random() * 1000000)}`;
  
  log(`Created mock payment intent: ${mockPaymentIntentId}`, 'payments');
  
  return {
    success: true,
    clientSecret: mockClientSecret,
    paymentIntentId: mockPaymentIntentId,
    mockMode: true,
  };
}

/**
 * Create a mock payment for testing
 */
export async function createMockPayment(
  amount: number,
  paymentMethod: string = 'card',
  metadata: Record<string, string> = {}
) {
  const mockPaymentId = `py_mock_${Date.now()}_${Math.floor(Math.random() * 1000000)}`;
  const mockReceiptUrl = `https://receipt.memorychain.example/mock/${mockPaymentId}`;
  
  log(`Created mock payment: ${mockPaymentId}`, 'payments');
  
  return {
    success: true,
    paymentId: mockPaymentId,
    amount,
    currency: 'usd',
    paymentMethod,
    metadata,
    receiptUrl: mockReceiptUrl,
    status: 'succeeded',
    created: new Date(),
  };
}

/**
 * Retrieve a payment by ID
 */
export async function retrievePayment(paymentId: string) {
  // If Stripe is available and not in mock mode, try to retrieve a real payment
  if (stripeClient && !mockMode && !paymentId.startsWith('py_mock_')) {
    try {
      const payment = await stripeClient.paymentIntents.retrieve(paymentId);
      return {
        success: true,
        payment,
      };
    } catch (error: any) {
      log(`Error retrieving payment: ${error.message}`, 'payments');
      return {
        success: false,
        error: error.message,
      };
    }
  }
  
  // For mock payments, return mock data
  if (paymentId.startsWith('py_mock_')) {
    return {
      success: true,
      payment: {
        id: paymentId,
        amount: 1000, // Example amount in cents
        currency: 'usd',
        payment_method_types: ['card'],
        status: 'succeeded',
        created: Math.floor(Date.now() / 1000),
        metadata: {},
        receipt_url: `https://receipt.memorychain.example/mock/${paymentId}`,
      },
    };
  }
  
  return {
    success: false,
    error: 'Payment not found',
  };
}