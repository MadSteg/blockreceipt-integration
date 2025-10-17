import { 
  users, 
  categories, 
  merchants, 
  receipts, 
  receiptItems,
  spendingStats,
  retailers,
  products,
  retailerSyncLogs,
  encryptionKeys,
  sharedAccess,
  inventoryItems,
  inventoryCollections,
  inventoryItemCollections,
  type User, 
  type InsertUser, 
  type Category,
  type InsertCategory,
  type Merchant,
  type InsertMerchant,
  type Receipt,
  type InsertReceipt,
  type ReceiptItem,
  type InsertReceiptItem,
  type SpendingStat,
  type InsertSpendingStat,
  type Retailer,
  type InsertRetailer,
  type Product,
  type InsertProduct,
  type RetailerSyncLog,
  type InsertRetailerSyncLog,
  type EncryptionKey,
  type InsertEncryptionKey,
  type SharedAccess,
  type InsertSharedAccess,
  type InventoryItem,
  type InsertInventoryItem,
  type InventoryCollection,
  type InsertInventoryCollection,
  type InventoryItemCollection,
  type InsertInventoryItemCollection,
  type FullReceipt,
  type FullInventoryItem
} from "@shared/schema";

// Storage interface
export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  
  // Category methods
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  getCategoryByName(name: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Merchant methods
  getMerchants(): Promise<Merchant[]>;
  getMerchant(id: number): Promise<Merchant | undefined>;
  getMerchantByName(name: string): Promise<Merchant | undefined>;
  createMerchant(merchant: InsertMerchant): Promise<Merchant>;
  
  // Receipt methods
  getReceipts(userId: number): Promise<Receipt[]>;
  getReceipt(id: number): Promise<Receipt | undefined>;
  createReceipt(receipt: InsertReceipt): Promise<Receipt>;
  updateReceipt(id: number, updates: Partial<InsertReceipt>): Promise<Receipt | undefined>;
  getFullReceipt(id: number): Promise<FullReceipt | undefined>;
  getRecentReceipts(userId: number, limit: number): Promise<FullReceipt[]>;
  
  // Receipt Item methods
  getReceiptItems(receiptId: number): Promise<ReceiptItem[]>;
  getReceiptItem(id: number): Promise<ReceiptItem | undefined>;
  createReceiptItem(item: InsertReceiptItem): Promise<ReceiptItem>;
  updateReceiptItem(id: number, updates: Partial<InsertReceiptItem>): Promise<ReceiptItem | undefined>;
  
  // Spending stats methods
  getSpendingStatsByMonth(userId: number, month: number, year: number): Promise<SpendingStat[]>;
  getSpendingStatsByYear(userId: number, year: number): Promise<SpendingStat[]>;
  createOrUpdateSpendingStat(stat: InsertSpendingStat): Promise<SpendingStat>;
  getCategoryBreakdown(userId: number, month: number, year: number): Promise<{category: Category, amount: string, percentage: number}[]>;
  getMonthlySpending(userId: number, year: number): Promise<{month: number, total: string}[]>;
  
  // Retailer methods
  getRetailers(): Promise<Retailer[]>;
  getRetailer(id: number): Promise<Retailer | undefined>;
  createRetailer(retailer: InsertRetailer): Promise<Retailer>;
  updateRetailer(id: number, updates: Partial<InsertRetailer>): Promise<Retailer | undefined>;
  
  // Product methods
  getProduct(id: number): Promise<Product | undefined>;
  getProductByExternalId(retailerId: number, externalId: string): Promise<Product | undefined>;
  findProductsByName(name: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | undefined>;
  searchProducts(query: string, options?: {
    limit?: number;
    offset?: number;
    retailerId?: number;
    categoryId?: number;
  }): Promise<Product[]>;
  
  // Retailer sync logs methods
  getRetailerSyncLogs(retailerId: number, limit?: number): Promise<RetailerSyncLog[]>;
  createRetailerSyncLog(log: InsertRetailerSyncLog): Promise<RetailerSyncLog>;
  updateRetailerSyncLog(id: number, updates: Partial<InsertRetailerSyncLog>): Promise<RetailerSyncLog>;

  // Encryption key methods
  getEncryptionKeys(userId: number): Promise<EncryptionKey[]>;
  getEncryptionKey(id: number): Promise<EncryptionKey | undefined>;
  createEncryptionKey(key: InsertEncryptionKey): Promise<EncryptionKey>;
  updateEncryptionKey(id: number, updates: Partial<InsertEncryptionKey>): Promise<EncryptionKey | undefined>;

  // Shared access methods
  getSharedAccesses(receiptId: number): Promise<SharedAccess[]>;
  getSharedAccess(id: number): Promise<SharedAccess | undefined>;
  createSharedAccess(access: InsertSharedAccess): Promise<SharedAccess>;
  updateSharedAccess(id: number, updates: Partial<InsertSharedAccess>): Promise<SharedAccess | undefined>;
  getSharedAccessesByOwner(userId: number): Promise<SharedAccess[]>;
  getSharedAccessesByTarget(userId: number): Promise<SharedAccess[]>;
  
  // Inventory methods
  getInventoryItems(userId: number, options?: {
    categoryId?: number;
    status?: string;
    searchTerm?: string;
    limit?: number;
    offset?: number;
  }): Promise<InventoryItem[]>;
  
  getInventoryItem(id: number): Promise<InventoryItem | undefined>;
  
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  
  updateInventoryItem(id: number, updates: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  
  deleteInventoryItem(id: number): Promise<boolean>;
  
  getFullInventoryItem(id: number): Promise<FullInventoryItem | undefined>;
  
  // Inventory collections methods
  getInventoryCollections(userId: number): Promise<InventoryCollection[]>;
  
  getInventoryCollection(id: number): Promise<InventoryCollection | undefined>;
  
  createInventoryCollection(collection: InsertInventoryCollection): Promise<InventoryCollection>;
  
  updateInventoryCollection(id: number, updates: Partial<InsertInventoryCollection>): Promise<InventoryCollection | undefined>;
  
  deleteInventoryCollection(id: number): Promise<boolean>;
  
  // Inventory item-collection methods
  addItemToCollection(itemId: number, collectionId: number): Promise<InventoryItemCollection>;
  
  removeItemFromCollection(itemId: number, collectionId: number): Promise<boolean>;
  
  getItemCollections(itemId: number): Promise<InventoryCollection[]>;
  
  getCollectionItems(collectionId: number): Promise<InventoryItem[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private categories: Map<number, Category>;
  private merchants: Map<number, Merchant>;
  private receipts: Map<number, Receipt>;
  private receiptItems: Map<number, ReceiptItem>;
  private spendingStats: Map<number, SpendingStat>;
  private retailers: Map<number, Retailer>;
  private products: Map<number, Product>;
  private retailerSyncLogs: Map<number, RetailerSyncLog>;
  private encryptionKeys: Map<number, EncryptionKey>;
  private sharedAccesses: Map<number, SharedAccess>;
  private inventoryItems: Map<number, InventoryItem>;
  private inventoryCollections: Map<number, InventoryCollection>;
  private inventoryItemCollections: Map<number, InventoryItemCollection>;
  
  private currentUserId: number;
  private currentCategoryId: number;
  private currentMerchantId: number;
  private currentReceiptId: number;
  private currentReceiptItemId: number;
  private currentSpendingStatId: number;
  private currentRetailerId: number;
  private currentProductId: number;
  private currentRetailerSyncLogId: number;
  private currentEncryptionKeyId: number;
  private currentSharedAccessId: number;
  private currentInventoryItemId: number;
  private currentInventoryCollectionId: number;
  private currentInventoryItemCollectionId: number;
  
  constructor() {
    this.users = new Map();
    this.categories = new Map();
    this.merchants = new Map();
    this.receipts = new Map();
    this.receiptItems = new Map();
    this.spendingStats = new Map();
    this.retailers = new Map();
    this.products = new Map();
    this.retailerSyncLogs = new Map();
    this.encryptionKeys = new Map();
    this.sharedAccesses = new Map();
    this.inventoryItems = new Map();
    this.inventoryCollections = new Map();
    this.inventoryItemCollections = new Map();
    
    this.currentUserId = 1;
    this.currentCategoryId = 1;
    this.currentMerchantId = 1;
    this.currentReceiptId = 1;
    this.currentReceiptItemId = 1;
    this.currentSpendingStatId = 1;
    this.currentRetailerId = 1;
    this.currentProductId = 1;
    this.currentRetailerSyncLogId = 1;
    this.currentEncryptionKeyId = 1;
    this.currentSharedAccessId = 1;
    this.currentInventoryItemId = 1;
    this.currentInventoryCollectionId = 1;
    this.currentInventoryItemCollectionId = 1;

    this.initializeDemoData();
  }

  // Initialize demo data
  private async initializeDemoData() {
    // Create a demo user
    const demoUser = await this.createUser({
      username: "demo",
      password: "password"
    });

    // Create categories
    const groceriesCategory = await this.createCategory({
      name: "Groceries",
      color: "#3B82F6", // blue
      icon: "ri-shopping-cart-line"
    });

    const diningCategory = await this.createCategory({
      name: "Dining",
      color: "#10B981", // green
      icon: "ri-restaurant-line"
    });

    const clothingCategory = await this.createCategory({
      name: "Clothing & Accessories",
      color: "#F59E0B", // amber
      icon: "ri-t-shirt-line"
    });

    const entertainmentCategory = await this.createCategory({
      name: "Entertainment",
      color: "#8B5CF6", // purple
      icon: "ri-movie-line"
    });

    const transportationCategory = await this.createCategory({
      name: "Transportation",
      color: "#EC4899", // pink
      icon: "ri-car-line"
    });
    
    // Additional categories for inventory management
    const electronicsCategory = await this.createCategory({
      name: "Electronics",
      color: "#06B6D4", // cyan
      icon: "ri-smartphone-line"
    });
    
    const homeAppliancesCategory = await this.createCategory({
      name: "Home Appliances",
      color: "#64748B", // slate
      icon: "ri-home-line"
    });
    
    const furnitureCategory = await this.createCategory({
      name: "Furniture",
      color: "#6366F1", // indigo
      icon: "ri-sofa-line"
    });
    
    const booksCategory = await this.createCategory({
      name: "Books & Media",
      color: "#0EA5E9", // sky
      icon: "ri-book-line"
    });

    // Create merchants
    const wholeFoods = await this.createMerchant({
      name: "Whole Foods Market",
      logo: "ri-shopping-cart-line",
      address: "123 Main Street, San Francisco, CA",
      phone: "(415) 555-1234"
    });

    const oliveGarden = await this.createMerchant({
      name: "Olive Garden",
      logo: "ri-restaurant-line",
      address: "456 Oak Avenue, San Francisco, CA",
      phone: "(415) 555-5678"
    });

    const hm = await this.createMerchant({
      name: "H&M",
      logo: "ri-t-shirt-line",
      address: "789 Market Street, San Francisco, CA",
      phone: "(415) 555-9012"
    });

    // Create receipts and items
    // Whole Foods Receipt
    const wholeFoodsReceipt = await this.createReceipt({
      userId: demoUser.id,
      merchantId: wholeFoods.id,
      categoryId: groceriesCategory.id,
      date: new Date('2023-04-12T14:34:00'),
      subtotal: "79.99",
      tax: "6.48",
      total: "86.47",
      blockchainTxHash: "0x7f3e1c7b62b9542a6b95247a0c82b034fd3c3a01c23dd07e42aeaf02371b94d",
      blockchainVerified: true,
      blockNumber: 14356789,
      nftTokenId: "WF12042023-001"
    });

    await this.createReceiptItem({
      receiptId: wholeFoodsReceipt.id,
      name: "Organic Bananas",
      price: "1.99",
      quantity: 1
    });

    await this.createReceiptItem({
      receiptId: wholeFoodsReceipt.id,
      name: "Almond Milk (32 oz)",
      price: "3.49",
      quantity: 1
    });

    await this.createReceiptItem({
      receiptId: wholeFoodsReceipt.id,
      name: "Sliced Turkey Breast",
      price: "7.99",
      quantity: 1
    });

    await this.createReceiptItem({
      receiptId: wholeFoodsReceipt.id,
      name: "Organic Spinach",
      price: "4.99",
      quantity: 1
    });

    await this.createReceiptItem({
      receiptId: wholeFoodsReceipt.id,
      name: "Avocado",
      price: "2.99",
      quantity: 2
    });

    await this.createReceiptItem({
      receiptId: wholeFoodsReceipt.id,
      name: "Greek Yogurt",
      price: "4.49",
      quantity: 1
    });

    await this.createReceiptItem({
      receiptId: wholeFoodsReceipt.id,
      name: "Whole Grain Bread",
      price: "3.99",
      quantity: 1
    });

    await this.createReceiptItem({
      receiptId: wholeFoodsReceipt.id,
      name: "Organic Blueberries",
      price: "6.99",
      quantity: 1
    });

    await this.createReceiptItem({
      receiptId: wholeFoodsReceipt.id,
      name: "Free Range Eggs",
      price: "5.49",
      quantity: 1
    });

    // Olive Garden Receipt
    const oliveGardenReceipt = await this.createReceipt({
      userId: demoUser.id,
      merchantId: oliveGarden.id,
      categoryId: diningCategory.id,
      date: new Date('2023-04-10T19:15:00'),
      subtotal: "39.78",
      tax: "3.18",
      total: "42.96",
      blockchainTxHash: "0x3d1a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1f42e",
      blockchainVerified: true,
      blockNumber: 14355678,
      nftTokenId: "OG10042023-001"
    });

    await this.createReceiptItem({
      receiptId: oliveGardenReceipt.id,
      name: "Chicken Alfredo",
      price: "18.99",
      quantity: 1
    });

    await this.createReceiptItem({
      receiptId: oliveGardenReceipt.id,
      name: "Breadsticks",
      price: "0.00",
      quantity: 1
    });

    await this.createReceiptItem({
      receiptId: oliveGardenReceipt.id,
      name: "Caesar Salad",
      price: "8.99",
      quantity: 1
    });

    await this.createReceiptItem({
      receiptId: oliveGardenReceipt.id,
      name: "Iced Tea",
      price: "2.99",
      quantity: 2
    });

    await this.createReceiptItem({
      receiptId: oliveGardenReceipt.id,
      name: "Tiramisu",
      price: "6.99",
      quantity: 1
    });

    // H&M Receipt
    const hmReceipt = await this.createReceipt({
      userId: demoUser.id,
      merchantId: hm.id,
      categoryId: clothingCategory.id,
      date: new Date('2023-04-08T15:22:00'),
      subtotal: "68.44",
      tax: "5.48",
      total: "73.92",
      blockchainTxHash: "0x8b2c4d6e8f0a2c4e6f8a0c2e4d6f8a0c2e4d6f8a0c2e4d6f8a0c2e4d6e19a",
      blockchainVerified: true,
      blockNumber: 14354567,
      nftTokenId: "HM08042023-001"
    });

    await this.createReceiptItem({
      receiptId: hmReceipt.id,
      name: "Men's Slim Fit Jeans",
      price: "29.99",
      quantity: 1
    });

    await this.createReceiptItem({
      receiptId: hmReceipt.id,
      name: "Cotton T-Shirt",
      price: "16.99",
      quantity: 2
    });

    await this.createReceiptItem({
      receiptId: hmReceipt.id,
      name: "Leather Belt",
      price: "9.95",
      quantity: 1
    });

    // Create spending stats
    await this.createOrUpdateSpendingStat({
      userId: demoUser.id,
      month: 4,
      year: 2023,
      categoryId: groceriesCategory.id,
      amount: "86.47"
    });

    await this.createOrUpdateSpendingStat({
      userId: demoUser.id,
      month: 4,
      year: 2023,
      categoryId: diningCategory.id,
      amount: "42.96"
    });

    await this.createOrUpdateSpendingStat({
      userId: demoUser.id,
      month: 4,
      year: 2023,
      categoryId: clothingCategory.id,
      amount: "73.92"
    });

    await this.createOrUpdateSpendingStat({
      userId: demoUser.id,
      month: 3,
      year: 2023,
      categoryId: groceriesCategory.id,
      amount: "78.25"
    });

    await this.createOrUpdateSpendingStat({
      userId: demoUser.id,
      month: 3,
      year: 2023,
      categoryId: diningCategory.id,
      amount: "39.50"
    });

    await this.createOrUpdateSpendingStat({
      userId: demoUser.id,
      month: 3,
      year: 2023,
      categoryId: entertainmentCategory.id,
      amount: "29.99"
    });

    await this.createOrUpdateSpendingStat({
      userId: demoUser.id,
      month: 3,
      year: 2023,
      categoryId: transportationCategory.id,
      amount: "45.75"
    });

    // Create inventory collections
    const electronicsCollection = await this.createInventoryCollection({
      userId: demoUser.id,
      name: "Electronics",
      description: "All my electronic devices and gadgets",
      color: "#06B6D4", // cyan
      icon: "ri-smartphone-line"
    });

    const warrantyCollection = await this.createInventoryCollection({
      userId: demoUser.id,
      name: "Under Warranty",
      description: "Items still covered by warranty",
      color: "#10B981", // green
      icon: "ri-shield-check-line"
    });

    const clothingCollection = await this.createInventoryCollection({
      userId: demoUser.id,
      name: "Clothing",
      description: "My clothing items",
      color: "#F59E0B", // amber
      icon: "ri-t-shirt-line" 
    });

    // Create inventory items
    const laptop = await this.createInventoryItem({
      userId: demoUser.id,
      name: "MacBook Pro 16-inch",
      description: "16-inch MacBook Pro with M1 Pro chip, 16GB RAM, 512GB SSD",
      categoryId: electronicsCategory.id,
      receiptId: wholeFoodsReceipt.id, // Just for demo purposes
      serialNumber: "C02XL0GTPFRP",
      purchasePrice: "2499.00",
      currentValue: "1899.00",
      condition: "Good",
      status: "In Use",
      location: "Home Office",
      notes: "Work laptop, AppleCare+ until 2024",
      tags: ["apple", "laptop", "work"],
      purchaseDate: new Date("2023-01-15"),
      warrantyExpiryDate: new Date("2024-01-15"),
      imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/mbp16-spacegray-select-202110?wid=904&hei=840&fmt=jpeg&qlt=90&.v=1632788574000"
    });

    const smartphone = await this.createInventoryItem({
      userId: demoUser.id,
      name: "iPhone 13 Pro",
      description: "iPhone 13 Pro, 256GB, Sierra Blue",
      categoryId: electronicsCategory.id,
      receiptId: hmReceipt.id, // Just for demo purposes
      serialNumber: "DNQXKCZ0KXMN",
      purchasePrice: "1099.00",
      currentValue: "799.00",
      condition: "Excellent",
      status: "In Use",
      location: "Everyday Carry",
      notes: "Personal phone, AppleCare+ until 2023",
      tags: ["apple", "phone", "mobile"],
      purchaseDate: new Date("2022-09-24"),
      warrantyExpiryDate: new Date("2023-09-24"),
      imageUrl: "https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-13-pro-blue-select?wid=940&hei=1112&fmt=png-alpha&.v=1631652954000"
    });

    const headphones = await this.createInventoryItem({
      userId: demoUser.id,
      name: "Sony WH-1000XM4",
      description: "Sony WH-1000XM4 Wireless Noise-Canceling Headphones",
      categoryId: electronicsCategory.id,
      serialNumber: "S01234567",
      purchasePrice: "349.99",
      currentValue: "249.99",
      condition: "Good",
      status: "In Use",
      location: "Living Room",
      notes: "Great noise cancellation, use daily for work",
      tags: ["audio", "headphones", "sony"],
      purchaseDate: new Date("2022-05-10"),
      warrantyExpiryDate: new Date("2023-05-10")
    });

    const jeans = await this.createInventoryItem({
      userId: demoUser.id,
      name: "Levi's 501 Original Jeans",
      description: "Levi's 501 Original Fit Men's Jeans, Dark Wash",
      categoryId: clothingCategory.id,
      receiptId: hmReceipt.id,
      purchasePrice: "59.99",
      currentValue: "59.99",
      condition: "New",
      status: "In Use",
      location: "Bedroom Closet",
      notes: "Size: 32x32",
      tags: ["clothing", "jeans", "levis"],
      purchaseDate: new Date("2023-03-15")
    });

    const coffeeMaker = await this.createInventoryItem({
      userId: demoUser.id,
      name: "Breville Barista Express",
      description: "Breville BES870XL Barista Express Espresso Machine",
      categoryId: homeAppliancesCategory.id,
      serialNumber: "BES870XL123456",
      purchasePrice: "699.95",
      currentValue: "599.95",
      condition: "Excellent",
      status: "In Use",
      location: "Kitchen Counter",
      notes: "Clean and descale monthly",
      tags: ["kitchen", "coffee", "appliance"],
      purchaseDate: new Date("2022-12-25"),
      warrantyExpiryDate: new Date("2023-12-25")
    });

    const tvSet = await this.createInventoryItem({
      userId: demoUser.id,
      name: "Samsung 65\" QLED 4K TV",
      description: "Samsung 65-inch Class QLED Q80A Series 4K UHD Smart TV",
      categoryId: electronicsCategory.id,
      serialNumber: "Q80A6500123",
      purchasePrice: "1299.99",
      currentValue: "1099.99",
      condition: "Excellent",
      status: "In Use",
      location: "Living Room Wall",
      notes: "Mounted on wall, calibrated for movie watching",
      tags: ["tv", "samsung", "entertainment"],
      purchaseDate: new Date("2023-02-14"),
      warrantyExpiryDate: new Date("2025-02-14")
    });

    // Add items to collections
    await this.addItemToCollection(laptop.id, electronicsCollection.id);
    await this.addItemToCollection(laptop.id, warrantyCollection.id);
    
    await this.addItemToCollection(smartphone.id, electronicsCollection.id);
    await this.addItemToCollection(smartphone.id, warrantyCollection.id);
    
    await this.addItemToCollection(headphones.id, electronicsCollection.id);
    
    await this.addItemToCollection(jeans.id, clothingCollection.id);
    
    await this.addItemToCollection(coffeeMaker.id, warrantyCollection.id);
    
    await this.addItemToCollection(tvSet.id, electronicsCollection.id);
    await this.addItemToCollection(tvSet.id, warrantyCollection.id);
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentUserId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Category methods
  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async getCategory(id: number): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async getCategoryByName(name: string): Promise<Category | undefined> {
    return Array.from(this.categories.values()).find(
      (category) => category.name === name,
    );
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = this.currentCategoryId++;
    const category: Category = { ...insertCategory, id };
    this.categories.set(id, category);
    return category;
  }

  // Merchant methods
  async getMerchants(): Promise<Merchant[]> {
    return Array.from(this.merchants.values());
  }

  async getMerchant(id: number): Promise<Merchant | undefined> {
    return this.merchants.get(id);
  }

  async getMerchantByName(name: string): Promise<Merchant | undefined> {
    return Array.from(this.merchants.values()).find(
      (merchant) => merchant.name === name,
    );
  }

  async createMerchant(insertMerchant: InsertMerchant): Promise<Merchant> {
    const id = this.currentMerchantId++;
    const merchant: Merchant = { ...insertMerchant, id };
    this.merchants.set(id, merchant);
    return merchant;
  }

  // Receipt methods
  async getReceipts(userId: number): Promise<Receipt[]> {
    return Array.from(this.receipts.values()).filter(
      (receipt) => receipt.userId === userId,
    );
  }

  async getReceipt(id: number): Promise<Receipt | undefined> {
    return this.receipts.get(id);
  }

  async createReceipt(insertReceipt: InsertReceipt): Promise<Receipt> {
    const id = this.currentReceiptId++;
    const receipt: Receipt = { ...insertReceipt, id };
    this.receipts.set(id, receipt);
    return receipt;
  }

  async updateReceipt(id: number, updates: Partial<InsertReceipt>): Promise<Receipt | undefined> {
    const receipt = this.receipts.get(id);
    if (!receipt) return undefined;
    
    const updatedReceipt: Receipt = { ...receipt, ...updates };
    this.receipts.set(id, updatedReceipt);
    return updatedReceipt;
  }

  async getFullReceipt(id: number): Promise<FullReceipt | undefined> {
    const receipt = this.receipts.get(id);
    if (!receipt) return undefined;
    
    const merchant = await this.getMerchant(receipt.merchantId);
    const category = await this.getCategory(receipt.categoryId);
    const items = await this.getReceiptItems(id);
    
    if (!merchant || !category) return undefined;
    
    return {
      id: receipt.id,
      merchant: {
        name: merchant.name,
        logo: merchant.logo,
        address: merchant.address,
        phone: merchant.phone,
      },
      category: {
        name: category.name,
        color: category.color,
        icon: category.icon,
      },
      date: receipt.date,
      subtotal: receipt.subtotal,
      tax: receipt.tax,
      total: receipt.total,
      items: items.map(item => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      blockchain: {
        txHash: receipt.blockchainTxHash,
        verified: receipt.blockchainVerified,
        blockNumber: receipt.blockNumber,
        nftTokenId: receipt.nftTokenId,
        ipfsCid: receipt.ipfsCid,
        ipfsUrl: receipt.ipfsUrl,
        encryptionKey: receipt.encryptionKey,
      },
    };
  }

  async getRecentReceipts(userId: number, limit: number): Promise<FullReceipt[]> {
    const userReceipts = Array.from(this.receipts.values())
      .filter(receipt => receipt.userId === userId)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);
    
    const fullReceipts: FullReceipt[] = [];
    
    for (const receipt of userReceipts) {
      const fullReceipt = await this.getFullReceipt(receipt.id);
      if (fullReceipt) {
        fullReceipts.push(fullReceipt);
      }
    }
    
    return fullReceipts;
  }

  // Receipt Item methods
  async getReceiptItems(receiptId: number): Promise<ReceiptItem[]> {
    return Array.from(this.receiptItems.values()).filter(
      (item) => item.receiptId === receiptId,
    );
  }

  async createReceiptItem(insertItem: InsertReceiptItem): Promise<ReceiptItem> {
    const id = this.currentReceiptItemId++;
    const item: ReceiptItem = { ...insertItem, id };
    this.receiptItems.set(id, item);
    return item;
  }

  // Spending stats methods
  async getSpendingStatsByMonth(userId: number, month: number, year: number): Promise<SpendingStat[]> {
    return Array.from(this.spendingStats.values()).filter(
      (stat) => stat.userId === userId && stat.month === month && stat.year === year,
    );
  }

  async getSpendingStatsByYear(userId: number, year: number): Promise<SpendingStat[]> {
    return Array.from(this.spendingStats.values()).filter(
      (stat) => stat.userId === userId && stat.year === year,
    );
  }

  async createOrUpdateSpendingStat(insertStat: InsertSpendingStat): Promise<SpendingStat> {
    // Check if stat already exists for this user, month, year, and category
    const existingStat = Array.from(this.spendingStats.values()).find(
      (stat) => 
        stat.userId === insertStat.userId && 
        stat.month === insertStat.month && 
        stat.year === insertStat.year && 
        stat.categoryId === insertStat.categoryId,
    );
    
    if (existingStat) {
      // Update existing stat
      const amount = parseFloat(existingStat.amount) + parseFloat(insertStat.amount);
      const updatedStat: SpendingStat = { 
        ...existingStat, 
        amount: amount.toString() 
      };
      this.spendingStats.set(existingStat.id, updatedStat);
      return updatedStat;
    } else {
      // Create new stat
      const id = this.currentSpendingStatId++;
      const stat: SpendingStat = { ...insertStat, id };
      this.spendingStats.set(id, stat);
      return stat;
    }
  }

  async getCategoryBreakdown(userId: number, month: number, year: number): Promise<{category: Category, amount: string, percentage: number}[]> {
    const stats = await this.getSpendingStatsByMonth(userId, month, year);
    if (stats.length === 0) return [];
    
    // Calculate total spending
    let totalSpending = 0;
    for (const stat of stats) {
      totalSpending += parseFloat(stat.amount);
    }
    
    // Calculate percentage for each category
    const result: {category: Category, amount: string, percentage: number}[] = [];
    
    for (const stat of stats) {
      const category = await this.getCategory(stat.categoryId);
      if (category) {
        const percentage = (parseFloat(stat.amount) / totalSpending) * 100;
        result.push({
          category,
          amount: stat.amount,
          percentage: Math.round(percentage),
        });
      }
    }
    
    // Sort by percentage (highest first)
    return result.sort((a, b) => b.percentage - a.percentage);
  }

  async getMonthlySpending(userId: number, year: number): Promise<{month: number, total: string}[]> {
    const stats = await this.getSpendingStatsByYear(userId, year);
    if (stats.length === 0) return [];
    
    // Group by month and sum amounts
    const monthlyTotals = new Map<number, number>();
    
    for (const stat of stats) {
      const month = stat.month;
      const amount = parseFloat(stat.amount);
      
      if (monthlyTotals.has(month)) {
        monthlyTotals.set(month, monthlyTotals.get(month)! + amount);
      } else {
        monthlyTotals.set(month, amount);
      }
    }
    
    // Convert to array and sort by month
    const result: {month: number, total: string}[] = [];
    
    for (const [month, total] of monthlyTotals.entries()) {
      result.push({
        month,
        total: total.toString(),
      });
    }
    
    return result.sort((a, b) => a.month - b.month);
  }
  
  // Retailer methods
  async getRetailers(): Promise<Retailer[]> {
    return Array.from(this.retailers.values());
  }

  async getRetailer(id: number): Promise<Retailer | undefined> {
    return this.retailers.get(id);
  }

  async createRetailer(retailer: InsertRetailer): Promise<Retailer> {
    const id = this.currentRetailerId++;
    const newRetailer: Retailer = { ...retailer, id };
    this.retailers.set(id, newRetailer);
    return newRetailer;
  }

  async updateRetailer(id: number, updates: Partial<InsertRetailer>): Promise<Retailer | undefined> {
    const retailer = this.retailers.get(id);
    if (!retailer) return undefined;
    
    const updatedRetailer: Retailer = { ...retailer, ...updates };
    this.retailers.set(id, updatedRetailer);
    return updatedRetailer;
  }

  // Product methods
  async getProduct(id: number): Promise<Product | undefined> {
    return this.products.get(id);
  }

  async getProductByExternalId(retailerId: number, externalId: string): Promise<Product | undefined> {
    return Array.from(this.products.values()).find(
      product => product.retailerId === retailerId && product.externalId === externalId
    );
  }

  async findProductsByName(name: string): Promise<Product[]> {
    const lowercaseName = name.toLowerCase();
    return Array.from(this.products.values()).filter(
      product => product.name.toLowerCase().includes(lowercaseName)
    );
  }

  async createProduct(product: InsertProduct): Promise<Product> {
    const id = this.currentProductId++;
    const newProduct: Product = { ...product, id };
    this.products.set(id, newProduct);
    return newProduct;
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const product = this.products.get(id);
    if (!product) return undefined;
    
    const updatedProduct: Product = { ...product, ...updates };
    this.products.set(id, updatedProduct);
    return updatedProduct;
  }

  async searchProducts(query: string, options?: {
    limit?: number;
    offset?: number;
    retailerId?: number;
    categoryId?: number;
  }): Promise<Product[]> {
    const { limit = 10, offset = 0, retailerId, categoryId } = options || {};
    
    let results = Array.from(this.products.values());
    
    if (query) {
      const lowercaseQuery = query.toLowerCase();
      results = results.filter(product => 
        product.name.toLowerCase().includes(lowercaseQuery) || 
        (product.description && product.description.toLowerCase().includes(lowercaseQuery))
      );
    }
    
    if (retailerId) {
      results = results.filter(product => product.retailerId === retailerId);
    }
    
    if (categoryId) {
      results = results.filter(product => product.categoryId === categoryId);
    }
    
    return results.slice(offset, offset + limit);
  }

  // Retailer sync logs methods
  async getRetailerSyncLogs(retailerId: number, limit?: number): Promise<RetailerSyncLog[]> {
    const logs = Array.from(this.retailerSyncLogs.values())
      .filter(log => log.retailerId === retailerId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    return limit ? logs.slice(0, limit) : logs;
  }

  async createRetailerSyncLog(log: InsertRetailerSyncLog): Promise<RetailerSyncLog> {
    const id = this.currentRetailerSyncLogId++;
    const newLog: RetailerSyncLog = { ...log, id };
    this.retailerSyncLogs.set(id, newLog);
    return newLog;
  }

  async updateRetailerSyncLog(id: number, updates: Partial<InsertRetailerSyncLog>): Promise<RetailerSyncLog> {
    const log = this.retailerSyncLogs.get(id);
    if (!log) {
      throw new Error(`RetailerSyncLog with id ${id} not found`);
    }
    
    const updatedLog: RetailerSyncLog = { ...log, ...updates };
    this.retailerSyncLogs.set(id, updatedLog);
    return updatedLog;
  }

  // Encryption key methods
  async getEncryptionKeys(userId: number): Promise<EncryptionKey[]> {
    return Array.from(this.encryptionKeys.values())
      .filter(key => key.userId === userId);
  }

  async getEncryptionKey(id: number): Promise<EncryptionKey | undefined> {
    return this.encryptionKeys.get(id);
  }

  async createEncryptionKey(key: InsertEncryptionKey): Promise<EncryptionKey> {
    const id = this.currentEncryptionKeyId++;
    const newKey: EncryptionKey = { ...key, id };
    this.encryptionKeys.set(id, newKey);
    return newKey;
  }

  async updateEncryptionKey(id: number, updates: Partial<InsertEncryptionKey>): Promise<EncryptionKey | undefined> {
    const key = this.encryptionKeys.get(id);
    if (!key) return undefined;
    
    const updatedKey: EncryptionKey = { ...key, ...updates };
    this.encryptionKeys.set(id, updatedKey);
    return updatedKey;
  }

  // Shared access methods
  async getSharedAccesses(receiptId: number): Promise<SharedAccess[]> {
    return Array.from(this.sharedAccesses.values())
      .filter(access => access.receiptId === receiptId);
  }

  async getSharedAccess(id: number): Promise<SharedAccess | undefined> {
    return this.sharedAccesses.get(id);
  }

  async createSharedAccess(access: InsertSharedAccess): Promise<SharedAccess> {
    const id = this.currentSharedAccessId++;
    const newAccess: SharedAccess = { ...access, id };
    this.sharedAccesses.set(id, newAccess);
    return newAccess;
  }

  async updateSharedAccess(id: number, updates: Partial<InsertSharedAccess>): Promise<SharedAccess | undefined> {
    const access = this.sharedAccesses.get(id);
    if (!access) return undefined;
    
    const updatedAccess: SharedAccess = { ...access, ...updates };
    this.sharedAccesses.set(id, updatedAccess);
    return updatedAccess;
  }

  async getSharedAccessesByOwner(userId: number): Promise<SharedAccess[]> {
    return Array.from(this.sharedAccesses.values())
      .filter(access => access.ownerUserId === userId);
  }

  async getSharedAccessesByTarget(userId: number): Promise<SharedAccess[]> {
    return Array.from(this.sharedAccesses.values())
      .filter(access => access.targetUserId === userId);
  }
  
  // Inventory methods
  async getInventoryItems(userId: number, options?: {
    categoryId?: number;
    status?: string;
    searchTerm?: string;
    limit?: number;
    offset?: number;
  }): Promise<InventoryItem[]> {
    let items = Array.from(this.inventoryItems.values()).filter(
      item => item.userId === userId
    );
    
    // Apply filters
    if (options?.categoryId) {
      items = items.filter(item => item.categoryId === options.categoryId);
    }
    
    if (options?.status) {
      items = items.filter(item => item.status === options.status);
    }
    
    if (options?.searchTerm) {
      const searchTerm = options.searchTerm.toLowerCase();
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchTerm) ||
        (item.description?.toLowerCase() || '').includes(searchTerm) ||
        (item.brandName?.toLowerCase() || '').includes(searchTerm) ||
        (item.modelNumber?.toLowerCase() || '').includes(searchTerm) ||
        (item.serialNumber?.toLowerCase() || '').includes(searchTerm)
      );
    }
    
    // Apply pagination
    if (options?.offset !== undefined && options?.limit !== undefined) {
      items = items.slice(options.offset, options.offset + options.limit);
    } else if (options?.limit !== undefined) {
      items = items.slice(0, options.limit);
    }
    
    return items;
  }
  
  async getInventoryItem(id: number): Promise<InventoryItem | undefined> {
    return this.inventoryItems.get(id);
  }
  
  async createInventoryItem(insertItem: InsertInventoryItem): Promise<InventoryItem> {
    const id = this.currentInventoryItemId++;
    const createdAt = new Date();
    const updatedAt = createdAt;
    const item: InventoryItem = { ...insertItem, id, createdAt, updatedAt };
    this.inventoryItems.set(id, item);
    return item;
  }
  
  async updateInventoryItem(id: number, updates: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(id);
    if (!item) return undefined;
    
    const updatedItem: InventoryItem = { 
      ...item, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.inventoryItems.set(id, updatedItem);
    return updatedItem;
  }
  
  async deleteInventoryItem(id: number): Promise<boolean> {
    const exists = this.inventoryItems.has(id);
    if (!exists) return false;
    
    // Remove item from all collections
    for (const itemCollection of Array.from(this.inventoryItemCollections.values())) {
      if (itemCollection.itemId === id) {
        this.inventoryItemCollections.delete(itemCollection.id);
      }
    }
    
    this.inventoryItems.delete(id);
    return true;
  }
  
  async getFullInventoryItem(id: number): Promise<FullInventoryItem | undefined> {
    const item = this.inventoryItems.get(id);
    if (!item) return undefined;
    
    // Get category
    const category = item.categoryId ? this.categories.get(item.categoryId) : undefined;
    
    // Get receipt if available
    const receipt = item.receiptId ? this.receipts.get(item.receiptId) : undefined;
    let merchant;
    if (receipt && receipt.merchantId) {
      merchant = this.merchants.get(receipt.merchantId);
    }
    
    // Get collections
    const collections = await this.getItemCollections(id);
    
    // Construct full item
    return {
      ...item,
      category,
      receipt: receipt ? {
        id: receipt.id,
        date: receipt.date,
        total: receipt.total,
        blockchainVerified: receipt.blockchainVerified || false,
        nftTokenId: receipt.nftTokenId || undefined,
        merchant: merchant ? {
          id: merchant.id,
          name: merchant.name,
          logo: merchant.logo
        } : undefined
      } : undefined,
      collections
    };
  }
  
  // Inventory collections methods
  async getInventoryCollections(userId: number): Promise<InventoryCollection[]> {
    return Array.from(this.inventoryCollections.values()).filter(
      collection => collection.userId === userId
    );
  }
  
  async getInventoryCollection(id: number): Promise<InventoryCollection | undefined> {
    return this.inventoryCollections.get(id);
  }
  
  async createInventoryCollection(insertCollection: InsertInventoryCollection): Promise<InventoryCollection> {
    const id = this.currentInventoryCollectionId++;
    const createdAt = new Date();
    const updatedAt = createdAt;
    const collection: InventoryCollection = { ...insertCollection, id, createdAt, updatedAt };
    this.inventoryCollections.set(id, collection);
    return collection;
  }
  
  async updateInventoryCollection(id: number, updates: Partial<InsertInventoryCollection>): Promise<InventoryCollection | undefined> {
    const collection = this.inventoryCollections.get(id);
    if (!collection) return undefined;
    
    const updatedCollection: InventoryCollection = { 
      ...collection, 
      ...updates, 
      updatedAt: new Date() 
    };
    this.inventoryCollections.set(id, updatedCollection);
    return updatedCollection;
  }
  
  async deleteInventoryCollection(id: number): Promise<boolean> {
    const exists = this.inventoryCollections.has(id);
    if (!exists) return false;
    
    // Remove all items from this collection
    for (const itemCollection of Array.from(this.inventoryItemCollections.values())) {
      if (itemCollection.collectionId === id) {
        this.inventoryItemCollections.delete(itemCollection.id);
      }
    }
    
    this.inventoryCollections.delete(id);
    return true;
  }
  
  // Inventory item-collection methods
  async addItemToCollection(itemId: number, collectionId: number): Promise<InventoryItemCollection> {
    // Check if item and collection exist
    const item = this.inventoryItems.get(itemId);
    const collection = this.inventoryCollections.get(collectionId);
    
    if (!item || !collection) {
      throw new Error("Item or collection not found");
    }
    
    // Check if already exists
    const existing = Array.from(this.inventoryItemCollections.values()).find(
      ic => ic.itemId === itemId && ic.collectionId === collectionId
    );
    
    if (existing) {
      return existing;
    }
    
    // Create new relationship
    const id = this.currentInventoryItemCollectionId++;
    const addedAt = new Date();
    const itemCollection: InventoryItemCollection = { 
      id, 
      itemId, 
      collectionId, 
      addedAt 
    };
    
    this.inventoryItemCollections.set(id, itemCollection);
    return itemCollection;
  }
  
  async removeItemFromCollection(itemId: number, collectionId: number): Promise<boolean> {
    const relationship = Array.from(this.inventoryItemCollections.values()).find(
      ic => ic.itemId === itemId && ic.collectionId === collectionId
    );
    
    if (!relationship) {
      return false;
    }
    
    this.inventoryItemCollections.delete(relationship.id);
    return true;
  }
  
  async getItemCollections(itemId: number): Promise<InventoryCollection[]> {
    // Find all collection relationships for this item
    const collectionIds = Array.from(this.inventoryItemCollections.values())
      .filter(ic => ic.itemId === itemId)
      .map(ic => ic.collectionId);
    
    // Get the actual collections
    return collectionIds
      .map(id => this.inventoryCollections.get(id))
      .filter((collection): collection is InventoryCollection => !!collection);
  }
  
  async getCollectionItems(collectionId: number): Promise<InventoryItem[]> {
    // Find all item relationships for this collection
    const itemIds = Array.from(this.inventoryItemCollections.values())
      .filter(ic => ic.collectionId === collectionId)
      .map(ic => ic.itemId);
    
    // Get the actual items
    return itemIds
      .map(id => this.inventoryItems.get(id))
      .filter((item): item is InventoryItem => !!item);
  }
}

export const storage = new MemStorage();
