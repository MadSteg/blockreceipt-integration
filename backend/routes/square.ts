import { Router } from 'express';
import bodyParser from 'body-parser';
import { squareService } from '../services/square-service';
import { createLogger } from '../logger';

const router = Router();
const logger = createLogger('square-routes');

router.post('/webhook', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-square-hmacsha256-signature'] as string;
    const body = req.body.toString('utf8');
    
    if (!signature) {
      logger.warn('[square] Webhook received without signature');
      return res.status(400).json({ error: 'Missing signature' });
    }

    const event = JSON.parse(body);
    const { type, data } = event;

    logger.info('[square] Received webhook event:', type);

    if (type === 'payment.created' || type === 'payment.updated') {
      const payment = data.object.payment;
      const merchantId = event.merchant_id;

      const merchant = await squareService.getMerchantBySquareId(merchantId);
      
      if (!merchant) {
        logger.warn('[square] Webhook received for unknown merchant:', merchantId);
        return res.status(404).json({ error: 'Merchant not found' });
      }

      const signatureKey = merchant.squareWebhookSignatureKey;
      
      if (!signatureKey) {
        logger.warn('[square] No webhook signature key configured for merchant:', merchant.id);
        return res.status(500).json({ error: 'Webhook signature key not configured' });
      }

      const isValid = await squareService.verifySquareWebhookSignature(
        body,
        signature,
        signatureKey
      );

      if (!isValid) {
        logger.error('[square] Invalid webhook signature for merchant:', merchant.id);
        return res.status(401).json({ error: 'Invalid signature' });
      }

      logger.info('[square] Webhook signature verified for merchant:', merchant.name);

      if (type === 'payment.created') {
        logger.info('[square] Processing payment.created event:', payment.id);

        let lineItems = [];
        if (payment.order_id) {
          try {
            const orderResponse = await fetch(
              `https://connect.squareup.com/v2/orders/${payment.order_id}`,
              {
                headers: {
                  'Authorization': `Bearer ${merchant.squareAccessToken}`,
                  'Square-Version': '2024-01-18'
                }
              }
            );

            if (orderResponse.ok) {
              const orderData = await orderResponse.json();
              lineItems = orderData.order?.line_items || [];
            }
          } catch (error) {
            logger.error('[square] Error fetching order details:', error);
          }
        }

        const mintedReceipt = await squareService.mintReceiptFromSquarePayment(
          payment,
          { id: merchant.id, name: merchant.name },
          lineItems,
          merchantId
        );

        logger.info('[square] Receipt minted successfully:', {
          receiptId: mintedReceipt.id,
          paymentId: payment.id,
          total: mintedReceipt.total / 100
        });

        return res.json({
          success: true,
          receiptId: mintedReceipt.id,
          paymentToken: mintedReceipt.paymentToken
        });
      }

      if (type === 'payment.updated') {
        logger.info('[square] Processing payment.updated event:', payment.id);
        return res.json({ success: true, message: 'Payment update acknowledged' });
      }
    }

    res.json({ received: true });

  } catch (error) {
    logger.error('[square] Webhook processing error:', error);
    res.status(500).json({
      error: 'Webhook processing failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/connect', async (req, res) => {
  try {
    const { merchantId, code } = req.body;

    if (!merchantId || !code) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: merchantId and code'
      });
    }

    logger.info('[square] Processing OAuth connection for merchant:', merchantId);

    const result = await squareService.connectSquareMerchant(merchantId, code);

    if (result.success) {
      logger.info('[square] Successfully connected merchant:', {
        merchantId,
        squareMerchantId: result.squareMerchantId
      });

      return res.json({
        success: true,
        squareMerchantId: result.squareMerchantId,
        message: 'Successfully connected to Square'
      });
    } else {
      logger.error('[square] Failed to connect merchant:', result.error);
      
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    logger.error('[square] OAuth connection error:', error);
    
    res.status(500).json({
      success: false,
      error: 'OAuth connection failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
