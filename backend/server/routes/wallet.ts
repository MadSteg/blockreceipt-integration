/**
 * Wallet Authentication Routes
 * 
 * This file handles wallet-based authentication using MetaMask and WalletConnect
 */
import { Router } from 'express';
import { z } from 'zod';
import { authService } from '../services/authService';
import { verifyWalletSignature, generateWalletNonce } from '../utils/verifyWallet';

const router = Router();

// Schema for wallet nonce request
const walletNonceSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address format")
});

// Schema for wallet login request
const walletLoginSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address format"),
  signature: z.string()
});

/**
 * Request a nonce for wallet authentication
 * This nonce will be signed by the wallet to verify ownership
 */
router.post('/request-nonce', async (req, res) => {
  try {
    const result = walletNonceSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: "Validation error", 
        details: result.error.format() 
      });
    }
    
    const { walletAddress } = result.data;
    const nonce = generateWalletNonce();
    
    // Store nonce in database associated with wallet address
    await authService.storeWalletNonce(walletAddress, nonce);
    
    // Return the nonce to the client for signing
    return res.json({ 
      success: true,
      nonce,
      message: `Login to BlockReceipt with nonce: ${nonce}`
    });
  } catch (error) {
    console.error("Error generating wallet nonce:", error);
    return res.status(500).json({ error: "Failed to generate nonce" });
  }
});

/**
 * Authenticate with a wallet signature
 */
router.post('/login', async (req, res) => {
  try {
    const result = walletLoginSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: "Validation error", 
        details: result.error.format() 
      });
    }
    
    const { walletAddress, signature } = result.data;
    
    // Retrieve the previously stored nonce for this wallet
    const user = await authService.getUserByWalletAddress(walletAddress);
    
    if (!user || !user.nonce) {
      return res.status(400).json({ error: "Invalid wallet or nonce not found. Please request a new nonce." });
    }
    
    // Verify the signature
    const isValid = verifyWalletSignature(walletAddress, signature, user.nonce);
    
    if (!isValid) {
      return res.status(401).json({ error: "Invalid signature" });
    }
    
    // Update the session
    if (req.session) {
      req.session.userId = user.id;
      req.session.walletAddress = walletAddress;
    }
    
    // Generate a new nonce for next time and update user's last login
    const newNonce = generateWalletNonce();
    await authService.updateUserAfterWalletLogin(user.id, newNonce);
    
    return res.json({ 
      success: true,
      message: "Wallet authentication successful",
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        walletAddress
      }
    });
  } catch (error) {
    console.error("Wallet authentication error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
});

export default router;