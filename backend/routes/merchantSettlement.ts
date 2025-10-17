import { Router } from 'express';
import { merchantSettlementService } from '../services/merchantSettlement';
import { createLogger } from '../logger';

const router = Router();
const logger = createLogger('settlement-routes');

/**
 * GET /api/settlement/balances
 * Get all merchant balances and settlement information
 */
router.get('/balances', (req, res) => {
  try {
    const balances = merchantSettlementService.getAllMerchantBalances();
    const poolStats = merchantSettlementService.getPoolStatistics();
    
    res.json({
      success: true,
      balances,
      poolStatistics: poolStats
    });
  } catch (error) {
    logger.error('Error fetching merchant balances:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch merchant balances'
    });
  }
});

/**
 * GET /api/settlement/history
 * Get settlement transaction history
 */
router.get('/history', (req, res) => {
  try {
    const history = merchantSettlementService.getSettlementHistory();
    
    res.json({
      success: true,
      transactions: history
    });
  } catch (error) {
    logger.error('Error fetching settlement history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settlement history'
    });
  }
});

/**
 * GET /api/settlement/merchant/:merchantId
 * Get specific merchant balance information
 */
router.get('/merchant/:merchantId', (req, res) => {
  try {
    const { merchantId } = req.params;
    const balance = merchantSettlementService.getMerchantBalance(merchantId);
    
    if (!balance) {
      return res.status(404).json({
        success: false,
        error: 'Merchant not found'
      });
    }
    
    res.json({
      success: true,
      balance
    });
  } catch (error) {
    logger.error('Error fetching merchant balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch merchant balance'
    });
  }
});

/**
 * POST /api/settlement/transaction
 * Process a new transaction (for testing settlement)
 */
router.post('/transaction', (req, res) => {
  try {
    const { merchantId, customerId, amount, action, stamps } = req.body;
    
    if (!merchantId || !customerId || !amount || !action || !stamps) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: merchantId, customerId, amount, action, stamps'
      });
    }
    
    if (action !== 'earn' && action !== 'redeem') {
      return res.status(400).json({
        success: false,
        error: 'Action must be either "earn" or "redeem"'
      });
    }
    
    merchantSettlementService.processTransaction(merchantId, customerId, amount, action, stamps);
    
    const updatedBalance = merchantSettlementService.getMerchantBalance(merchantId);
    const poolStats = merchantSettlementService.getPoolStatistics();
    
    res.json({
      success: true,
      message: `Transaction processed: ${action} ${stamps} stamps`,
      merchantBalance: updatedBalance,
      poolStatistics: poolStats
    });
  } catch (error) {
    logger.error('Error processing settlement transaction:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process transaction'
    });
  }
});

export function registerMerchantSettlementRoutes(app: any) {
  app.use('/api/settlement', router);
  logger.info('Merchant settlement routes registered successfully');
}

export default router;