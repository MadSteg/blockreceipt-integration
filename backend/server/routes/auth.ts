/**
 * Authentication Routes
 * 
 * Routes for user authentication, including:
 * - Email/password login
 * - User registration
 * - Web3 wallet authentication
 * - Session management
 */
import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { insertUserSchema } from "@shared/schema";
import { AuthService } from "../services/authService";
import { thresholdClient } from "../services/tacoService";
import { WalletService } from "../services/walletService";

// Extend insertUserSchema for signup with wallet creation
const signupSchema = insertUserSchema.extend({
  wantsWallet: z.boolean().optional().default(false),
  tacoPublicKey: z.string().optional(),
});

// Web3 login schema
const web3LoginSchema = z.object({
  walletAddress: z.string(),
  signature: z.string(),
  nonce: z.string(),
  devMode: z.boolean().optional(),
});

// Create express router
export const authRouter = Router();
export default authRouter;

// Initialize services
const walletService = new WalletService();
const authService = new AuthService(thresholdClient, walletService);

// Check authentication status
authRouter.get("/status", (req: Request, res: Response) => {
  if (req.session.userId) {
    return res.json({
      authenticated: true,
      userId: req.session.userId,
      walletAddress: req.session.walletAddress,
    });
  }
  
  return res.json({
    authenticated: false,
  });
});

// User signup
authRouter.post("/signup", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = signupSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.format(),
      });
    }
    
    const userData = validationResult.data;
    
    // Create the user
    const user = await authService.createUser(
      userData,
      userData.wantsWallet,
      userData.tacoPublicKey
    );
    
    // Set session data
    req.session.userId = user.id;
    req.session.walletAddress = user.walletAddress;
    
    // Get wallet if one was created
    let wallet = null;
    if (userData.wantsWallet) {
      wallet = await walletService.getUserWallet(user.id);
    }
    
    // Return success with user data (excluding password)
    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
      },
      wallet: wallet ? {
        address: wallet.address,
      } : null,
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to create user account",
    });
  }
});

// User login
authRouter.post("/login", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Email and password are required",
      });
    }
    
    // Verify credentials
    const user = await authService.verifyCredentials(email, password);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password",
      });
    }
    
    // Set session data
    req.session.userId = user.id;
    req.session.walletAddress = user.walletAddress;
    
    // Return success with user data (excluding password)
    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
      },
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Login failed",
    });
  }
});

// Get nonce for Web3 authentication
authRouter.get("/nonce/:walletAddress", async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: "Wallet address is required",
      });
    }
    
    // Generate nonce
    const nonce = await authService.generateNonce(walletAddress);
    
    // Create message to sign
    const message = `Sign this message to verify your ownership of wallet address ${walletAddress}. Nonce: ${nonce}`;
    
    return res.json({
      success: true,
      nonce,
      message,
    });
  } catch (error: any) {
    console.error("Nonce generation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Failed to generate nonce",
    });
  }
});

// Web3 wallet login
authRouter.post("/web3-login", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validationResult = web3LoginSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: "Invalid request data",
        details: validationResult.error.format(),
      });
    }
    
    const { walletAddress, signature, nonce, devMode } = validationResult.data;
    
    let user;
    
    // If in dev mode with a special wallet address, bypass signature verification
    if (devMode && process.env.NODE_ENV === 'development' && 
        walletAddress === '0x742d35Cc6634C0532925a3b844Bc454e4438f44e') {
      console.log('[Dev Mode] Bypassing signature verification for development wallet');
      user = await authService.getUserOrCreateByWalletAddress(walletAddress);
    } else {
      // Normal verification flow
      user = await authService.verifySignature(walletAddress, signature, nonce);
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "Signature verification failed",
      });
    }
    
    // Set session data
    req.session.userId = user.id;
    req.session.walletAddress = user.walletAddress;
    
    // Return success with user data
    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        walletAddress: user.walletAddress,
      },
    });
  } catch (error: any) {
    console.error("Web3 login error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Web3 authentication failed",
    });
  }
});

// Logout
authRouter.post("/logout", (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to log out",
      });
    }
    
    return res.json({
      success: true,
      message: "Logged out successfully",
    });
  });
});