import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
// Using zod directly instead of importing from schema

// Define the schemas inline
const insertInventoryItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  imageUrl: z.string().url().optional(),
  purchasePrice: z.number().optional(),
});

const insertInventoryCollectionSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  isDefault: z.boolean().optional(),
});

const router = Router();

// Get all inventory items for the user
router.get("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { categoryId, status, q, limit, offset } = req.query;
  
  try {
    const items = await storage.getInventoryItems(req.user.id, {
      categoryId: categoryId ? parseInt(categoryId as string) : undefined,
      status: status as string | undefined,
      searchTerm: q as string | undefined,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    
    res.json(items);
  } catch (error) {
    console.error("Error fetching inventory items:", error);
    res.status(500).json({ error: "Failed to fetch inventory items" });
  }
});

// Get a specific inventory item
router.get("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.params.id);
  
  try {
    const item = await storage.getFullInventoryItem(id);
    
    if (!item) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    
    // Check if the item belongs to the user
    if (item.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    res.json(item);
  } catch (error) {
    console.error("Error fetching inventory item:", error);
    res.status(500).json({ error: "Failed to fetch inventory item" });
  }
});

// Create a new inventory item
router.post("/", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Validate incoming data
    const validatedData = insertInventoryItemSchema.extend({
      tags: z.array(z.string()).optional(),
      warrantyExpiryDate: z.string().optional(), // ISO date string
      purchaseDate: z.string().optional(), // ISO date string
      expiryDate: z.string().optional(), // ISO date string
    }).parse(req.body);
    
    // Process dates if provided
    const processedData = {
      ...validatedData,
      userId: req.user.id,
      warrantyExpiryDate: validatedData.warrantyExpiryDate ? new Date(validatedData.warrantyExpiryDate) : undefined,
      purchaseDate: validatedData.purchaseDate ? new Date(validatedData.purchaseDate) : undefined,
      expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : undefined,
    };
    
    const item = await storage.createInventoryItem(processedData);
    
    // If collections were specified, add the item to those collections
    if (req.body.collectionIds && Array.isArray(req.body.collectionIds)) {
      const collectionIds = req.body.collectionIds as number[];
      
      for (const collectionId of collectionIds) {
        // Check if collection belongs to user before adding
        const collection = await storage.getInventoryCollection(collectionId);
        if (collection && collection.userId === req.user.id) {
          await storage.addItemToCollection(item.id, collectionId);
        }
      }
    }
    
    res.status(201).json(item);
  } catch (error) {
    console.error("Error creating inventory item:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    res.status(500).json({ error: "Failed to create inventory item" });
  }
});

// Update an inventory item
router.patch("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.params.id);
  
  try {
    // Check if item exists and belongs to user
    const existingItem = await storage.getInventoryItem(id);
    
    if (!existingItem) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    
    if (existingItem.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    // Validate incoming data
    const validatedData = insertInventoryItemSchema.partial().extend({
      tags: z.array(z.string()).optional(),
      warrantyExpiryDate: z.string().optional(), // ISO date string
      purchaseDate: z.string().optional(), // ISO date string
      expiryDate: z.string().optional(), // ISO date string
    }).parse(req.body);
    
    // Process dates if provided
    const processedData = {
      ...validatedData,
      warrantyExpiryDate: validatedData.warrantyExpiryDate ? new Date(validatedData.warrantyExpiryDate) : undefined,
      purchaseDate: validatedData.purchaseDate ? new Date(validatedData.purchaseDate) : undefined,
      expiryDate: validatedData.expiryDate ? new Date(validatedData.expiryDate) : undefined,
    };
    
    const updatedItem = await storage.updateInventoryItem(id, processedData);
    
    // Update collections if specified
    if (req.body.collectionIds && Array.isArray(req.body.collectionIds)) {
      // Get current collections
      const currentCollections = await storage.getItemCollections(id);
      const currentCollectionIds = currentCollections.map(c => c.id);
      const newCollectionIds = req.body.collectionIds as number[];
      
      // Remove from collections not in the new list
      for (const collId of currentCollectionIds) {
        if (!newCollectionIds.includes(collId)) {
          await storage.removeItemFromCollection(id, collId);
        }
      }
      
      // Add to new collections
      for (const collId of newCollectionIds) {
        if (!currentCollectionIds.includes(collId)) {
          // Check if collection belongs to user before adding
          const collection = await storage.getInventoryCollection(collId);
          if (collection && collection.userId === req.user.id) {
            await storage.addItemToCollection(id, collId);
          }
        }
      }
    }
    
    // Return the full updated item with collections
    const fullItem = await storage.getFullInventoryItem(id);
    res.json(fullItem);
  } catch (error) {
    console.error("Error updating inventory item:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    res.status(500).json({ error: "Failed to update inventory item" });
  }
});

// Delete an inventory item
router.delete("/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.params.id);
  
  try {
    // Check if item exists and belongs to user
    const existingItem = await storage.getInventoryItem(id);
    
    if (!existingItem) {
      return res.status(404).json({ error: "Inventory item not found" });
    }
    
    if (existingItem.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    await storage.deleteInventoryItem(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    res.status(500).json({ error: "Failed to delete inventory item" });
  }
});

// Collection routes

// Get all collections for the user
router.get("/collections", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  try {
    const collections = await storage.getInventoryCollections(req.user.id);
    res.json(collections);
  } catch (error) {
    console.error("Error fetching inventory collections:", error);
    res.status(500).json({ error: "Failed to fetch inventory collections" });
  }
});

// Create a new collection
router.post("/collections", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // Validate incoming data
    const validatedData = insertInventoryCollectionSchema.parse(req.body);
    
    const collection = await storage.createInventoryCollection({
      ...validatedData,
      userId: req.user.id
    });
    
    res.status(201).json(collection);
  } catch (error) {
    console.error("Error creating inventory collection:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    res.status(500).json({ error: "Failed to create inventory collection" });
  }
});

// Get a specific collection
router.get("/collections/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.params.id);
  
  try {
    const collection = await storage.getInventoryCollection(id);
    
    if (!collection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    
    // Check if the collection belongs to the user
    if (collection.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    // Get items in this collection
    const items = await storage.getCollectionItems(id);
    
    res.json({
      ...collection,
      items
    });
  } catch (error) {
    console.error("Error fetching inventory collection:", error);
    res.status(500).json({ error: "Failed to fetch inventory collection" });
  }
});

// Update a collection
router.patch("/collections/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.params.id);
  
  try {
    // Check if collection exists and belongs to user
    const existingCollection = await storage.getInventoryCollection(id);
    
    if (!existingCollection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    
    if (existingCollection.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    // Validate incoming data
    const validatedData = insertInventoryCollectionSchema.partial().parse(req.body);
    
    const updatedCollection = await storage.updateInventoryCollection(id, validatedData);
    
    res.json(updatedCollection);
  } catch (error) {
    console.error("Error updating inventory collection:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid data", 
        details: error.errors 
      });
    }
    res.status(500).json({ error: "Failed to update inventory collection" });
  }
});

// Delete a collection
router.delete("/collections/:id", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = parseInt(req.params.id);
  
  try {
    // Check if collection exists and belongs to user
    const existingCollection = await storage.getInventoryCollection(id);
    
    if (!existingCollection) {
      return res.status(404).json({ error: "Collection not found" });
    }
    
    if (existingCollection.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    await storage.deleteInventoryCollection(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting inventory collection:", error);
    res.status(500).json({ error: "Failed to delete inventory collection" });
  }
});

// Add item to collection
router.post("/collections/:collectionId/items/:itemId", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const collectionId = parseInt(req.params.collectionId);
  const itemId = parseInt(req.params.itemId);
  
  try {
    // Check if collection and item exist and belong to user
    const collection = await storage.getInventoryCollection(collectionId);
    const item = await storage.getInventoryItem(itemId);
    
    if (!collection || !item) {
      return res.status(404).json({ error: "Collection or item not found" });
    }
    
    if (collection.userId !== req.user.id || item.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    await storage.addItemToCollection(itemId, collectionId);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error adding item to collection:", error);
    res.status(500).json({ error: "Failed to add item to collection" });
  }
});

// Remove item from collection
router.delete("/collections/:collectionId/items/:itemId", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const collectionId = parseInt(req.params.collectionId);
  const itemId = parseInt(req.params.itemId);
  
  try {
    // Check if collection and item exist and belong to user
    const collection = await storage.getInventoryCollection(collectionId);
    const item = await storage.getInventoryItem(itemId);
    
    if (!collection || !item) {
      return res.status(404).json({ error: "Collection or item not found" });
    }
    
    if (collection.userId !== req.user.id || item.userId !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    
    await storage.removeItemFromCollection(itemId, collectionId);
    
    res.json({ success: true });
  } catch (error) {
    console.error("Error removing item from collection:", error);
    res.status(500).json({ error: "Failed to remove item from collection" });
  }
});

export default router;