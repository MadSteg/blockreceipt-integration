import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupWebSocket } from "./websocket";
import { posIntegrationService } from "./services/posIntegrationService";
import { notificationService } from "./services/notificationService";
import { merchantOnboardingService } from "./services/merchantOnboarding";
import { storage } from "./storage-real";
import { validateBody, mintSchema, stripePaymentSchema, verifyReceiptSchema } from "./middleware/validation";
import stripeWebhook from "./routes/stripeWebhook";
// Square POS webhook integration routes
import squareRoutes from "./routes/square";
// Removed legacy Mumbai blockchain routes
import blockchainAmoyRoutes from "./routes/blockchain-amoy";
import multiBlockchainRoutes from "./routes/multi-blockchain";
import emailRoutes from "./routes/email";
import paymentRoutes from "./routes/payments";
import thresholdReceiptRoutes from "./routes/threshold-receipt";
import encryptedPaymentRoutes from "./routes/encrypted-payments";
import encryptionRoutes from "./routes/encryption";
import tacoRoutes from "./routes/taco";
import tacoPreRoutes from "./routes/tacoPre";
import cryptoRoutes from "./routes/crypto";
import inventoryRoutes from "./routes/inventory";
import merchantPluginRoutes from "./routes/merchant-plugin";
// New product catalog routes
import productsRoutes from "./routes/products";
// Import merchant registry routes
import { merchantRoutes } from "./routes/merchants";
import { registerMerchantPortalRoutes } from "./routes/merchantPortal";
import { googleCloudStorageService } from "./services/googleCloudStorage";
// POS webhook integration routes
import posWebhookRoutes from "./routes/posWebhook";
import nftReceiptsRoutes from "./routes/nft-receipts";
// Metadata access control routes
import metadataRoutes from "./routes/metadata";
// OCR receipt scanning routes
import ocrRoutes from "./routes/ocr";
// OCR test tool routes
import ocrTestRoutes from "./routes/ocrTest";
// Receipt upload routes
// Import the uploadReceipt routes
// Loyalty rewards routes
import loyaltyRewardsRoutes from "./routes/loyaltyRewards";
import uploadReceiptRoutes from "./routes/uploadReceipt";
// Import the auto-process receipt routes
import autoProcessReceiptRoutes from "./routes/autoProcessReceipt";
// Import the unified upload-and-mint route
import uploadAndMintRoutes from "./routes/uploadAndMint";
// Import the NFT options routes
import nftOptionsRoutes from "./routes/nftOptions";
// User authentication and wallet management routes
import authRoutes from "./routes/auth";
// Import the gallery routes for NFT display
import galleryRoutes from "./routes/gallery";
// Import the NFT catalog routes
import nftsRoutes from "./routes/nfts";
// Import test routes for database verification
import testRoutes from "./test-routes";
// Import the NFT Purchase Bot routes
import nftPurchaseBotRoutes from "./routes/nftPurchaseBot";
// Import the NFT Pool routes
import nftPoolRoutes from "./routes/nftPool";
// Import the NFT Procurement routes
import nftProcurementRoutes from "./routes/nftProcurement";
// Import the direct mint routes for testing enriched metadata
import directMintRoutes from "./routes/directMint";
// Import the task queue routes
import taskRoutes from "./routes/tasks";
// Import test routes for the task queue
import testQueueRoutes from "./routes/test-queue";
// Import hot wallet routes with TACo encryption
// Import test NFT routes for development
import testNFTRoutes from "./routes/test-nft";
import walletTacoRoutes from "./routes/wallet";
// Import wallet authentication routes
import walletAuthRoutes from "./routes/wallet";
// Import receipt encryption routes with TaCo
// Import test upload route
import testUploadRoutes from "./routes/testUpload";
// Import coupon routes
import couponRoutes from "./routes/coupons";
// Import NFT routes
import nftRoutes from "./routes/nfts";
// Import dual-metadata related routes
import promotionsRoutes from "./routes/promotions";
import nftMetadataRoutes from "./routes/nftMetadata";
// Import cloud storage routes for accessing images
import cloudStorageRoutes from "./routes/cloudStorage";
// Import routes for core functionalities


export async function registerRoutes(app: Express): Promise<Server> {
  // API Routes
  // All routes are prefixed with /api
  
  // Stripe webhook must be registered BEFORE JSON parser middleware
  app.use('/api/webhook', stripeWebhook);
  
  // Square webhook must also be registered BEFORE JSON parser middleware
  app.use('/api/square', squareRoutes);
  
  // Mumbai blockchain routes have been removed completely
  
  // Register Amoy blockchain routes (recommended)
  app.use('/api/blockchain/amoy', blockchainAmoyRoutes);
  
  // Register multi-blockchain status route
  app.use('/api/blockchain', multiBlockchainRoutes);
  
  // Register email scanning routes
  app.use('/api/email', emailRoutes);
  
  // Register payment processing routes
  app.use('/api/payments', paymentRoutes);
  
  // Register threshold receipt routes
  app.use('/api/threshold-receipt', thresholdReceiptRoutes);
  
  // Register encrypted payment routes
  app.use('/api/encrypted-payments', encryptedPaymentRoutes);
  
  // Register encryption key and shared access routes
  app.use(encryptionRoutes);
  
  // Register Taco threshold encryption routes
  app.use('/api/taco', tacoRoutes);
  
  // Register TACo PRE (Proxy Re-Encryption) routes
  app.use('/api', tacoPreRoutes);
  
  // Register receipt encryption routes with TaCo
  // app.use('/api/receipt-encryption', receiptEncryptionRoutes);
  
  // Register crypto payment routes
  app.use('/api/crypto', cryptoRoutes);
  
  // Register inventory management routes
  app.use('/api/inventory', inventoryRoutes);
  
  // Register merchant plugin routes
  app.use('/api/merchant', merchantPluginRoutes);
  
  // Register merchant portal routes
  registerMerchantPortalRoutes(app);
  
  // Register merchant settlement routes
  const { registerMerchantSettlementRoutes } = await import('./routes/merchantSettlement.js');
  registerMerchantSettlementRoutes(app);
  
  // Register loyalty card routes
  try {
    const loyaltyModule = await import('./routes/loyaltyCard.js');
    loyaltyModule.registerLoyaltyCardRoutes(app);
    console.log('[express] Loyalty card routes registered successfully');
  } catch (error) {
    console.warn('[express] Could not load loyalty card routes:', error.message);
  }
  
  // Register new catalog routes
  app.use('/api/products', productsRoutes);
  app.use('/api/merchants', merchantRoutes);
  app.use('/api/nft-receipts', nftReceiptsRoutes);
  
  // Register metadata access control routes
  app.use('/api', metadataRoutes);
  
  // Register OCR routes
  app.use('/api/ocr', ocrRoutes);
  
  // Register OCR test tool routes
  app.use('/api/ocr-test', ocrTestRoutes);
  
  // Register loyalty rewards routes
  app.use('/api/loyalty', loyaltyRewardsRoutes);
  
  // Register receipt upload routes
  app.use('/api/upload', uploadReceiptRoutes);
  
  // Register test NFT routes (for development testing)
  app.use('/api', testNFTRoutes);
  
  // Register auto-process receipt routes (development mode)
  if (process.env.NODE_ENV === 'development') {
    app.use('/api', autoProcessReceiptRoutes);
    console.log('[express] Auto-process receipt endpoints enabled in development mode');
    
    // Register task queue test endpoints
    app.use('/api', taskRoutes);
    console.log('[express] Task queue test endpoints enabled in development mode');
  }
  
  // Register NFT options routes
  app.use('/api', nftOptionsRoutes);
  
  // Register NFT gallery routes
  app.use('/api/gallery', galleryRoutes);
  
  // Register NFT catalog routes
  // Register NFT routes (including minting)
  app.use('/api/nfts', nftsRoutes);
  
  // Register NFT Purchase Bot routes
  app.use('/api/nft-bot', nftPurchaseBotRoutes);
  
  // Register NFT Pool routes
  app.use('/api/nfts', nftPoolRoutes);
  
  // Register NFT Procurement routes (NEW: OpenSea NFT buying with metadata encryption)
  app.use('/api/nft-procurement', nftProcurementRoutes);
  console.log('[express] NFT Procurement routes registered successfully');
  
  // Register direct mint routes for testing enriched metadata
  app.use('/api/direct-mint', directMintRoutes);
  
  // Register Task Queue routes
  app.use('/api', taskRoutes);
  
  // Register authentication routes
  app.use('/api/auth', authRoutes);
  
  // Register test routes for database verification
  app.use('/api', testRoutes);
  
  // Register real receipt routes
  const receiptsRealRoutes = await import('./routes/receipts-real');
  app.use('/api/receipts', receiptsRealRoutes.default);
  console.log('[express] Real receipt routes registered successfully');
  
  // Register real user routes
  const usersRealRoutes = await import('./routes/users-real');
  app.use('/api/users', usersRealRoutes.default);
  console.log('[express] Real user routes registered successfully');
  
  // Register Hot Wallet routes with TACo encryption
  app.use('/api/wallet', walletTacoRoutes);
  
  // Register test upload route (for debugging file upload issues)
  app.use('/api', testUploadRoutes);
  
  // Register wallet authentication routes
  app.use('/api/wallet-auth', walletAuthRoutes);
  
  // Register Test Queue routes (only in development)
  if (process.env.NODE_ENV === 'development') {
    app.use('/api/test', testQueueRoutes);
    console.log('[express] Task queue test endpoints enabled in development mode');
  }
  
  // Register coupon routes
  app.use('/api/coupons', couponRoutes);
  console.log('[express] Coupon routes registered successfully');
  
  // Register POS integration routes
  app.post('/api/pos/mint-receipt', async (req, res) => {
    try {
      const { merchantId, merchantName, customerPhone, totalAmount, items, transactionId } = req.body;
      
      const result = await posIntegrationService.createDigitalReceipt(
        merchantId,
        merchantName,
        customerPhone,
        totalAmount,
        items,
        transactionId
      );
      
      // Create reward notification if points were earned
      if (result.rewardPoints > 0) {
        const customerId = posIntegrationService.generateCustomerId(customerPhone);
        await notificationService.createRewardNotification(
          customerId,
          result.rewardPoints,
          merchantName,
          result.nftTokenId || 'receipt'
        );
      }
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('[pos] Error minting receipt:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });

  // Register notification routes
  app.get('/api/notifications/:userId', (req, res) => {
    try {
      const { userId } = req.params;
      const notifications = notificationService.getUserNotifications(userId);
      res.json({ success: true, notifications });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/notifications/:userId/unread-count', (req, res) => {
    try {
      const { userId } = req.params;
      const count = notificationService.getUnreadCount(userId);
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/notifications/:userId/:notificationId/read', (req, res) => {
    try {
      const { userId, notificationId } = req.params;
      const success = notificationService.markAsRead(userId, notificationId);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/notifications/:userId/read-all', (req, res) => {
    try {
      const { userId } = req.params;
      const count = notificationService.markAllAsRead(userId);
      res.json({ success: true, markedCount: count });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/brands/:brandName/request-access', async (req, res) => {
    try {
      const { brandName } = req.params;
      const { userId, receiptId, incentive } = req.body;
      
      const notification = await notificationService.createBrandAccessRequest(
        userId,
        brandName,
        receiptId,
        incentive
      );
      
      res.json({ success: true, notification });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Register merchant onboarding routes
  app.post('/api/merchants/apply', async (req, res) => {
    try {
      const application = await merchantOnboardingService.submitApplication(req.body);
      res.json({ success: true, application });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/merchants/applications', (req, res) => {
    try {
      const { status } = req.query;
      const applications = merchantOnboardingService.getApplications(status as any);
      res.json({ success: true, applications });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/merchants/:merchantId/onboarding', (req, res) => {
    try {
      const { merchantId } = req.params;
      const progress = merchantOnboardingService.getOnboardingProgress(merchantId);
      res.json({ success: true, progress });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/merchants/:merchantId/onboarding/:stepId/complete', (req, res) => {
    try {
      const { merchantId, stepId } = req.params;
      const success = merchantOnboardingService.completeOnboardingStep(merchantId, stepId);
      res.json({ success });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/merchants/:merchantId/analytics', (req, res) => {
    try {
      const { merchantId } = req.params;
      const analytics = merchantOnboardingService.getMerchantAnalytics(merchantId);
      res.json({ success: true, analytics });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  
  // Register NFT routes
  app.use('/api/nfts', nftRoutes);
  console.log('[express] NFT routes registered successfully');
  
  // Register promotion routes for vendor-controlled promotional metadata
  app.use('/api/promotions', promotionsRoutes);
  console.log('[express] Promotions routes registered successfully');
  
  // Register NFT metadata routes for dual metadata structure
  app.use('/api/nft-metadata', nftMetadataRoutes);
  console.log('[express] NFT metadata routes registered successfully');

  // Register POS webhook routes for merchant integration
  app.use('/api/pos', posWebhookRoutes);
  console.log('[express] POS webhook routes registered successfully');
  
  // Register cloud storage routes for accessing images from Google Cloud
  app.use('/api/storage', cloudStorageRoutes);
  console.log('[express] Cloud storage routes registered successfully');
  
  // Register Replit object storage routes
  const replitStorageRoutes = await import('./routes/replitStorage');
  app.use('/api/replit-storage', replitStorageRoutes.default);
  console.log('[express] Replit storage routes registered successfully');
  

  

  
  // Blockchain network status endpoint with multi-provider details
  app.get('/api/blockchain/status', async (req, res) => {
    try {
      const timestamp = new Date().toISOString();
      
      // Get the services from app.locals - handle possible structure/name differences
      const amoyService = req.app.locals.blockchainAmoyService || req.app.locals.amoyProvider;
      const cryptoPaymentService = req.app.locals.cryptoPaymentService;
      
      // Build the status response
      const status: {
        timestamp: string;
        networks: Record<string, any>;
        cryptoPayment?: any;
      } = {
        timestamp,
        networks: {}
      };
      
      // Mumbai has been removed
      
      // Add Amoy status if available
      if (amoyService && typeof amoyService.getNetworkStatus === 'function') {
        try {
          status.networks.amoy = await amoyService.getNetworkStatus();
        } catch (err) {
          status.networks.amoy = { 
            status: 'Error', 
            error: 'Failed to get network status',
            mockMode: true
          };
        }
      } else {
        status.networks.amoy = { status: 'Service Unavailable' };
      }
      
      // Add other network statuses as needed
      status.networks.ethereum = {
        status: 'Available',
        chainId: 1,
        mockMode: true,
        network: 'ethereum',
        message: 'Ethereum Mainnet - Coming Soon'
      };
      
      status.networks.bitcoin = {
        status: 'Available',
        chainId: 0,
        mockMode: true,
        network: 'bitcoin',
        message: 'Bitcoin Network - Coming Soon'
      };
      
      status.networks.solana = {
        status: 'Available',
        chainId: 0,
        mockMode: true,
        network: 'solana',
        message: 'Solana Network - Coming Soon'
      };
      
      // Add crypto payment service status if available
      if (cryptoPaymentService) {
        try {
          status.cryptoPayment = {
            status: 'Active',
            availableCurrencies: cryptoPaymentService.getAvailableCurrencies ? 
              cryptoPaymentService.getAvailableCurrencies() : [],
            providers: cryptoPaymentService.getProviderStatuses ? 
              cryptoPaymentService.getProviderStatuses() : 
              { polygon: { available: true }, ethereum: { available: true } }
          };
        } catch (err) {
          status.cryptoPayment = { 
            status: 'Error', 
            error: 'Failed to get crypto payment status'
          };
        }
      } else {
        status.cryptoPayment = { status: 'Service Unavailable' };
      }
      
      res.json(status);
    } catch (error) {
      console.error('Error getting blockchain status:', error);
      res.status(500).json({ 
        timestamp: new Date().toISOString(),
        error: 'Failed to get blockchain status'
      });
    }
  });
  

  // Get categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // Get merchants
  app.get("/api/merchants", async (req, res) => {
    try {
      const merchants = await storage.getMerchants();
      res.json(merchants);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch merchants" });
    }
  });

  // Get all receipts for a user
  app.get("/api/receipts", async (req, res) => {
    try {
      // For demo purposes, always use user ID 1
      const userId = 1;
      const receipts = await storage.getReceipts(userId);
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  // Get recent receipts with limit
  app.get("/api/receipts/recent", async (req, res) => {
    try {
      // For demo purposes, always use user ID 1
      const userId = 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 3;
      const receipts = await storage.getRecentReceipts(userId, limit);
      res.json(receipts);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch recent receipts" });
    }
  });

  // Get full receipt by ID
  app.get("/api/receipts/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const receipt = await storage.getFullReceipt(id);
      
      if (!receipt) {
        return res.status(404).json({ message: "Receipt not found" });
      }
      
      res.json(receipt);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch receipt" });
    }
  });

  // Create new receipt
  app.post("/api/receipts", validateBody(mintSchema), async (req, res) => {
    try {
      // For demo purposes, always use user ID 1
      const userId = 1;
      const { merchantId, categoryId, date, subtotal, tax, total, items } = req.body;
      
      // Create receipt
      const receipt = await storage.createReceipt({
        userId,
        merchantId,
        categoryId,
        date: new Date(date),
        subtotal,
        tax,
        total,
        blockchainTxHash: undefined,
        blockchainVerified: false,
        blockNumber: undefined,
        nftTokenId: undefined
      });
      
      // Add items
      if (items && Array.isArray(items)) {
        for (const item of items) {
          await storage.createReceiptItem({
            receiptId: receipt.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1
          });
        }
      }
      
      // Update spending stats
      await storage.createOrUpdateSpendingStat({
        userId,
        month: new Date(date).getMonth() + 1, // JavaScript months are 0-indexed
        year: new Date(date).getFullYear(),
        categoryId,
        amount: total
      });
      
      // Simulate blockchain processing
      setTimeout(async () => {
        // Generate fake blockchain data
        const txHash = `0x${Math.random().toString(16).substring(2, 42)}`;
        const blockNumber = Math.floor(14000000 + Math.random() * 1000000);
        const nftTokenId = `NFT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Update receipt with blockchain data
        await storage.updateReceipt(receipt.id, {
          blockchainTxHash: txHash,
          blockchainVerified: true,
          blockNumber,
          nftTokenId
        });
      }, 3000);
      
      res.status(201).json(receipt);
    } catch (error) {
      res.status(500).json({ message: "Failed to create receipt" });
    }
  });

  // Get spending stats by month and year
  app.get("/api/stats/:year/:month", async (req, res) => {
    try {
      // For demo purposes, always use user ID 1
      const userId = 1;
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const stats = await storage.getSpendingStatsByMonth(userId, month, year);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch spending stats" });
    }
  });

  // Get category breakdown for a month and year
  app.get("/api/stats/:year/:month/breakdown", async (req, res) => {
    try {
      // For demo purposes, always use user ID 1
      const userId = 1;
      const year = parseInt(req.params.year);
      const month = parseInt(req.params.month);
      
      const breakdown = await storage.getCategoryBreakdown(userId, month, year);
      res.json(breakdown);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch category breakdown" });
    }
  });

  // Get monthly spending for a year
  app.get("/api/stats/:year/monthly", async (req, res) => {
    try {
      // For demo purposes, always use user ID 1
      const userId = 1;
      const year = parseInt(req.params.year);
      
      const monthlySpending = await storage.getMonthlySpending(userId, year);
      res.json(monthlySpending);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch monthly spending" });
    }
  });

  // Get NFT images from Google Cloud Storage
  app.get("/api/nft-images", async (req, res) => {
    try {
      const images = await googleCloudStorageService.getNFTImagesWithUrls();
      // Convert to proxy URLs that work through our server
      const proxiedImages = images.map(image => ({
        fileName: image.fileName,
        url: `/api/image-proxy/${encodeURIComponent(image.fileName)}`
      }));
      
      res.json({
        success: true,
        images: proxiedImages,
        count: proxiedImages.length
      });
    } catch (error) {
      console.error('Error fetching NFT images:', error);
      res.json({ 
        success: true, 
        images: [],
        count: 0
      });
    }
  });

  // Analyze images with AI and get smart NFT names
  app.post("/api/analyze-nft-images", async (req, res) => {
    try {
      const { imageAnalysisService } = await import('./services/imageAnalysis');
      const images = await googleCloudStorageService.getNFTImagesWithUrls();
      
      // Convert to proxy URLs for analysis
      const proxiedImages = images.map(image => ({
        fileName: image.fileName,
        url: `http://localhost:5000/api/image-proxy/${encodeURIComponent(image.fileName)}`
      }));
      
      console.log(`Starting AI analysis of ${proxiedImages.length} images...`);
      const analysisResults = await imageAnalysisService.analyzeMultipleImages(proxiedImages);
      
      res.json({
        success: true,
        results: analysisResults,
        count: analysisResults.length
      });
    } catch (error) {
      console.error('Error analyzing images:', error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to analyze images",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Image proxy endpoint to serve images directly from our server
  app.get("/api/image-proxy/:fileName(*)", async (req, res) => {
    try {
      const fileName = decodeURIComponent(req.params.fileName);
      const file = googleCloudStorageService.storage.bucket('blockreceipt').file(fileName);
      
      // Check if file exists
      const [exists] = await file.exists();
      if (!exists) {
        return res.status(404).send('Image not found');
      }
      
      // Set appropriate headers for PNG images
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      
      // Stream the file directly to the response
      file.createReadStream()
        .on('error', (err) => {
          console.error('Error streaming file:', err);
          if (!res.headersSent) {
            res.status(500).send('Error loading image');
          }
        })
        .pipe(res);
        
    } catch (error) {
      console.error('Error in image proxy:', error);
      if (!res.headersSent) {
        res.status(500).send('Error loading image');
      }
    }
  });

  // Test Google Cloud Storage connection
  app.get("/api/test-gcs-connection", async (req, res) => {
    try {
      const isConnected = await googleCloudStorageService.testConnection();
      res.json({
        success: isConnected,
        message: isConnected ? "Google Cloud Storage connection successful" : "Failed to connect to Google Cloud Storage"
      });
    } catch (error) {
      console.error('Error testing GCS connection:', error);
      res.status(500).json({ 
        success: false, 
        message: "Error testing Google Cloud Storage connection",
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Mount NFT Pool routes
  app.use('/api/nfts', nftPoolRoutes);
  
  // Mount unified upload-and-mint route
  app.use('/api/upload-and-mint', uploadAndMintRoutes);

  // Mount PRE encryption routes
  const preEncryptionRoutes = await import('./routes/preEncryption');
  app.use('/api/pre', preEncryptionRoutes.default);
  console.log('[express] PRE encryption routes registered successfully');

  // Add verification endpoint directly
  app.get('/api/verify/:tokenId', async (req, res) => {
    try {
      const { tokenId } = req.params;
      const demoTokens = ['1', '2', '3'];
      
      if (demoTokens.includes(tokenId)) {
        res.json({
          success: true,
          data: {
            tokenId,
            exists: true,
            metadataUri: `ipfs://demo-metadata-${tokenId}`,
            totalSupply: '1',
            contractAddress: '0x1111111111111111111111111111111111111111',
            network: {
              name: 'polygon-amoy',
              chainId: 80002
            },
            verifiedAt: new Date().toISOString(),
            isDemoToken: true
          },
          message: 'Receipt verified successfully on blockchain'
        });
      } else {
        res.status(404).json({
          success: false,
          error: `Token ID ${tokenId} not found in demo collection`,
          tokenId
        });
      }
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: error.message || 'Verification failed',
        tokenId: req.params.tokenId
      });
    }
  });
  console.log('[express] Verification routes registered successfully');

  // Create HTTP server
  const httpServer = createServer(app);
  
  // Setup WebSocket for real-time notifications
  setupWebSocket(httpServer);

  return httpServer;
}
