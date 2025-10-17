import { Router } from 'express';
import { verifyReceipt, verifyReceiptOwnership } from '../services/verifyService';

const router = Router();

// GET /api/verify/:tokenId - Verify a receipt exists on blockchain
router.get('/:tokenId', async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    if (!tokenId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token ID is required' 
      });
    }

    const data = await verifyReceipt(tokenId);
    
    if (data.success) {
      res.json({ 
        success: true, 
        data,
        message: 'Receipt verified successfully on blockchain'
      });
    } else {
      res.status(404).json({
        success: false,
        error: data.error,
        tokenId
      });
    }
    
  } catch (err: any) {
    console.error('Verification route error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Internal server error during verification'
    });
  }
});

// GET /api/verify/:tokenId/ownership/:walletAddress - Verify ownership of a receipt
router.get('/:tokenId/ownership/:walletAddress', async (req, res) => {
  try {
    const { tokenId, walletAddress } = req.params;
    
    if (!tokenId || !walletAddress) {
      return res.status(400).json({ 
        success: false, 
        error: 'Token ID and wallet address are required' 
      });
    }

    const data = await verifyReceiptOwnership(tokenId, walletAddress);
    
    if (data.success) {
      res.json({ 
        success: true, 
        data,
        message: data.owns ? 'Ownership verified' : 'No ownership found'
      });
    } else {
      res.status(500).json({
        success: false,
        error: data.error,
        tokenId,
        walletAddress
      });
    }
    
  } catch (err: any) {
    console.error('Ownership verification route error:', err);
    res.status(500).json({ 
      success: false, 
      error: err.message || 'Internal server error during ownership verification'
    });
  }
});

export default router;