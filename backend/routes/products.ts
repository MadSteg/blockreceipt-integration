/**
 * Product Catalog API Routes
 * Provides endpoints for browsing products and merchants
 */

import express from 'express';
import { 
  products, 
  merchants, 
  getProductById, 
  getMerchantById, 
  getProductsByMerchant,
  getProductsByCategory,
  ProductCategory
} from '@shared/products';

const router = express.Router();

/**
 * @route GET /api/products
 * @desc Get all products with optional filtering
 */
router.get('/', (req, res) => {
  const { category, merchant, search, minPrice, maxPrice } = req.query;
  
  let filteredProducts = [...products];
  
  // Filter by category if provided
  if (category) {
    filteredProducts = filteredProducts.filter(
      product => product.category === category
    );
  }
  
  // Filter by merchant if provided
  if (merchant) {
    filteredProducts = filteredProducts.filter(
      product => product.merchantId === merchant
    );
  }
  
  // Filter by search term if provided
  if (search && typeof search === 'string') {
    const searchTerm = search.toLowerCase();
    filteredProducts = filteredProducts.filter(
      product => 
        product.name.toLowerCase().includes(searchTerm) ||
        product.description.toLowerCase().includes(searchTerm) ||
        product.tags.some(tag => tag.toLowerCase().includes(searchTerm))
    );
  }
  
  // Filter by price range if provided
  if (minPrice) {
    filteredProducts = filteredProducts.filter(
      product => product.price >= Number(minPrice)
    );
  }
  
  if (maxPrice) {
    filteredProducts = filteredProducts.filter(
      product => product.price <= Number(maxPrice)
    );
  }
  
  // Return only available products unless specifically requested
  if (req.query.includeUnavailable !== 'true') {
    filteredProducts = filteredProducts.filter(product => product.available);
  }
  
  res.json(filteredProducts);
});

/**
 * @route GET /api/products/categories
 * @desc Get all product categories with counts
 */
router.get('/categories', (req, res) => {
  const categoryCounts = Object.values(ProductCategory).map(category => {
    const count = products.filter(
      product => product.category === category && product.available
    ).length;
    
    return {
      category,
      count
    };
  });
  
  res.json(categoryCounts);
});

/**
 * @route GET /api/products/:id
 * @desc Get product by ID
 */
router.get('/:id', (req, res) => {
  const product = getProductById(req.params.id);
  
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  
  res.json(product);
});

/**
 * @route GET /api/products/:id/merchant
 * @desc Get merchant information for a product
 */
router.get('/:id/merchant', (req, res) => {
  const product = getProductById(req.params.id);
  
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  
  const merchant = getMerchantById(product.merchantId);
  
  if (!merchant) {
    return res.status(404).json({ message: 'Merchant not found' });
  }
  
  res.json(merchant);
});

/**
 * @route GET /api/products/:id/related
 * @desc Get related products (same category or merchant)
 */
router.get('/:id/related', (req, res) => {
  const product = getProductById(req.params.id);
  
  if (!product) {
    return res.status(404).json({ message: 'Product not found' });
  }
  
  // Get products in the same category (excluding this product)
  const sameCategory = products.filter(
    p => p.id !== product.id && 
         p.category === product.category && 
         p.available
  ).slice(0, 3);
  
  // Get other products from the same merchant (excluding this product)
  const sameMerchant = products.filter(
    p => p.id !== product.id && 
         p.merchantId === product.merchantId && 
         p.available
  ).slice(0, 3);
  
  res.json({
    sameCategory,
    sameMerchant
  });
});

export default router;