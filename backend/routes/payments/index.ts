import { Router } from 'express';
import cryptoPaymentRoutes from './crypto';

const router = Router();

// Register crypto payment routes
router.use('/crypto', cryptoPaymentRoutes);

// Add more payment method routes here
// For example:
// router.use('/stripe', stripePaymentRoutes);

export default router;