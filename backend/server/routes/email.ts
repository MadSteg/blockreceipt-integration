import { Router } from 'express';
import { sendReceiptEmail } from '../services/emailService';

const router = Router();

// Send receipt email
router.post('/send-receipt', async (req, res) => {
  try {
    const { receiptId, email } = req.body;

    if (!receiptId || !email) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // In a real application, we'd fetch the receipt details from the database
    // For development, we'll use mock data
    const mockReceiptDetails = {
      to: email,
      productName: 'Product Name', // This would be fetched based on receiptId
      merchantName: 'Merchant Name', // This would be fetched based on receiptId
      receiptId: receiptId,
      receiptNftId: `NFT-${Date.now()}`,
      transactionHash: `0x${Date.now().toString(16)}abcdef1234567890`,
      walletAddress: '0x123456789abcdef123456789abcdef123456789a',
      tier: 'standard',
      amount: 0.01,
      ipfsHash: `ipfs://QmMock${Date.now()}`
    };

    const success = await sendReceiptEmail(mockReceiptDetails);

    if (success) {
      res.json({ success: true, message: 'Receipt email sent successfully' });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send receipt email' });
    }
  } catch (error) {
    console.error('Failed to send receipt email:', error);
    res.status(500).json({ success: false, message: 'Failed to send receipt email' });
  }
});

export default router;