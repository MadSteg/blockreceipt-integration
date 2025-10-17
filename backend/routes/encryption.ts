import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

// Mock authentication middleware for demo purposes
const mockAuthMiddleware = (req: any, res: any, next: any) => {
  // For demo purposes, we'll assume the user is authenticated
  // and set a mock user with ID 1
  req.isAuthenticated = () => true;
  req.user = { id: 1 };
  next();
};

// Apply mock auth middleware to all routes
router.use(mockAuthMiddleware);

// Get encryption keys for current user
router.get("/api/encryption-keys", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const keys = await storage.getEncryptionKeys(req.user.id);
    res.json(keys);
  } catch (error) {
    console.error("Error fetching encryption keys:", error);
    res.status(500).json({ error: "Failed to fetch encryption keys" });
  }
});

// Create a new encryption key
router.post("/api/encryption-keys", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    // Create encryption key schema inline
    const encryptionKeySchema = z.object({
      userId: z.number(),
      publicKey: z.string(),
      encryptedPrivateKey: z.string(),
      name: z.string().optional(),
      keyType: z.string().default("rsa"),
      keySize: z.number().default(2048),
    });
    
    const validatedData = encryptionKeySchema.parse({
      ...req.body,
      userId: req.user.id,
    });

    const key = await storage.createEncryptionKey(validatedData);
    res.status(201).json(key);
  } catch (error) {
    console.error("Error creating encryption key:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create encryption key" });
  }
});

// Get a specific encryption key
router.get("/api/encryption-keys/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const keyId = parseInt(req.params.id);
    if (isNaN(keyId)) {
      return res.status(400).json({ error: "Invalid key ID" });
    }

    const key = await storage.getEncryptionKey(keyId);
    if (!key) {
      return res.status(404).json({ error: "Encryption key not found" });
    }

    // Security check - only allow access to user's own keys
    if (key.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(key);
  } catch (error) {
    console.error("Error fetching encryption key:", error);
    res.status(500).json({ error: "Failed to fetch encryption key" });
  }
});

// Update an encryption key
router.put("/api/encryption-keys/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const keyId = parseInt(req.params.id);
    if (isNaN(keyId)) {
      return res.status(400).json({ error: "Invalid key ID" });
    }

    const key = await storage.getEncryptionKey(keyId);
    if (!key) {
      return res.status(404).json({ error: "Encryption key not found" });
    }

    // Security check - only allow updating user's own keys
    if (key.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Create encryption key schema inline (same as before)
    const encryptionKeySchema = z.object({
      userId: z.number(),
      publicKey: z.string(),
      encryptedPrivateKey: z.string(),
      name: z.string().optional(),
      keyType: z.string().default("rsa"),
      keySize: z.number().default(2048),
    });
    
    const validatedData = encryptionKeySchema.partial().parse(req.body);
    const updatedKey = await storage.updateEncryptionKey(keyId, validatedData);
    res.json(updatedKey);
  } catch (error) {
    console.error("Error updating encryption key:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to update encryption key" });
  }
});

// Get shared accesses for a receipt
router.get("/api/receipts/:id/shared-access", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const receiptId = parseInt(req.params.id);
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: "Invalid receipt ID" });
    }

    const receipt = await storage.getReceipt(receiptId);
    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    // Security check - only allow access if user owns the receipt
    if (receipt.userId !== req.user.id) {
      // Check if user has shared access to this receipt
      const sharedAccesses = await storage.getSharedAccesses(receiptId);
      const hasAccess = sharedAccesses.some(access => access.targetUserId === req.user.id);
      
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    const sharedAccesses = await storage.getSharedAccesses(receiptId);
    res.json(sharedAccesses);
  } catch (error) {
    console.error("Error fetching shared access:", error);
    res.status(500).json({ error: "Failed to fetch shared access" });
  }
});

// Create shared access for a receipt
router.post("/api/receipts/:id/shared-access", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const receiptId = parseInt(req.params.id);
    if (isNaN(receiptId)) {
      return res.status(400).json({ error: "Invalid receipt ID" });
    }

    const receipt = await storage.getReceipt(receiptId);
    if (!receipt) {
      return res.status(404).json({ error: "Receipt not found" });
    }

    // Security check - only allow sharing if user owns the receipt
    if (receipt.userId !== req.user.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    // Create shared access schema inline
    const sharedAccessSchema = z.object({
      receiptId: z.number(),
      ownerUserId: z.number(),
      targetUserId: z.number(),
      reEncryptedKey: z.string(),
      permissions: z.string().default("read"),
      expiresAt: z.date().optional()
    });
    
    const validatedData = sharedAccessSchema.parse({
      ...req.body,
      receiptId,
      ownerUserId: req.user.id,
    });

    const sharedAccess = await storage.createSharedAccess(validatedData);
    res.status(201).json(sharedAccess);
  } catch (error) {
    console.error("Error creating shared access:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create shared access" });
  }
});

// Get all receipts shared with me
router.get("/api/shared-with-me", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const sharedAccesses = await storage.getSharedAccessesByTarget(req.user.id);
    
    // Get the full receipts for each shared access
    const receipts = await Promise.all(
      sharedAccesses.map(async (access) => {
        const receipt = await storage.getFullReceipt(access.receiptId);
        return {
          ...receipt,
          sharedBy: access.ownerUserId,
          sharedAt: access.createdAt,
          encryptedKey: access.reEncryptedKey,
        };
      })
    );
    
    res.json(receipts.filter(Boolean)); // Filter out any undefined receipts
  } catch (error) {
    console.error("Error fetching shared receipts:", error);
    res.status(500).json({ error: "Failed to fetch shared receipts" });
  }
});

// Get all receipts I've shared
router.get("/api/shared-by-me", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Not authenticated" });
  }

  try {
    const sharedAccesses = await storage.getSharedAccessesByOwner(req.user.id);
    
    // Get the full receipts for each shared access
    const receipts = await Promise.all(
      sharedAccesses.map(async (access) => {
        const receipt = await storage.getFullReceipt(access.receiptId);
        return {
          ...receipt,
          sharedWith: access.targetUserId,
          sharedAt: access.createdAt,
        };
      })
    );
    
    res.json(receipts.filter(Boolean)); // Filter out any undefined receipts
  } catch (error) {
    console.error("Error fetching shared receipts:", error);
    res.status(500).json({ error: "Failed to fetch shared receipts" });
  }
});

export default router;