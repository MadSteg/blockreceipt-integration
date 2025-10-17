/**
 * NFT Pool Routes
 * 
 * Provides endpoints for accessing the NFT pool collection
 * These routes are mounted at /api/nfts
 */

import { Router, Request, Response } from 'express';
import * as nftPoolRepository from '../repositories/nftPoolRepository';
import { NFTOption } from '../repositories/nftPoolRepository';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Get random NFTs from the pool by receipt tier
 * GET /api/nfts/pool?tier=premium&count=5
 */
router.get('/pool', async (req: Request, res: Response) => {
  try {
    const tier = (req.query.tier as string) || 'standard';
    const count = parseInt(req.query.count as string) || 5;
    
    // Validate tier
    if (!['standard', 'premium', 'luxury', 'ultra'].includes(tier)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid tier. Must be one of: standard, premium, luxury, ultra' 
      });
    }
    
    // Get all NFTs for the specified tier
    const allNfts = await nftPoolRepository.getNFTsByTier(tier);
    
    // Randomly select up to 'count' NFTs
    const randomizedNfts = allNfts
      .sort(() => Math.random() - 0.5)
      .slice(0, count);
    
    return res.json({
      success: true,
      nfts: randomizedNfts,
      count: randomizedNfts.length,
      tier
    });
  } catch (error) {
    logger.error('Error fetching NFTs from pool:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch NFTs from pool' 
    });
  }
});

/**
 * Get NFT details by ID
 * GET /api/nfts/details/:nftId
 */
router.get('/details/:nftId', async (req: Request, res: Response) => {
  try {
    const { nftId } = req.params;
    
    const nft = await nftPoolRepository.getNFTById(nftId);
    
    if (!nft) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found'
      });
    }
    
    return res.json({
      success: true,
      nft
    });
  } catch (error) {
    logger.error('Error fetching NFT details:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch NFT details'
    });
  }
});

/**
 * Select an NFT from the pool
 * POST /api/nfts/select
 * Body: { nftId, walletAddress }
 */
router.post('/select', async (req: Request, res: Response) => {
  try {
    const { nftId, walletAddress } = req.body;
    
    if (!nftId || !walletAddress) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: nftId, walletAddress'
      });
    }
    
    // Get the NFT from the pool
    const nft = await nftPoolRepository.getNFTById(nftId);
    
    if (!nft) {
      return res.status(404).json({
        success: false,
        message: 'NFT not found'
      });
    }
    
    // Note: Our current repository doesn't have a method to disable an NFT
    // This would need to be implemented in a database-backed system
    // For now, we just return success
    
    return res.json({
      success: true,
      message: 'NFT selected successfully',
      nft,
      walletAddress
    });
  } catch (error) {
    logger.error('Error selecting NFT:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to select NFT'
    });
  }
});

/**
 * Get available NFT counts by tier
 * GET /api/nfts/counts
 */
router.get('/counts', async (req: Request, res: Response) => {
  try {
    // Get all NFTs and count them by tier
    const allNfts = await nftPoolRepository.getAllNFTs();
    
    const counts = {
      total: allNfts.length,
      byTier: {
        standard: allNfts.filter(nft => nft.tier === 'standard').length,
        premium: allNfts.filter(nft => nft.tier === 'premium').length,
        luxury: allNfts.filter(nft => nft.tier === 'luxury').length,
        ultra: allNfts.filter(nft => nft.tier === 'ultra').length
      }
    };
    
    return res.json({
      success: true,
      counts
    });
  } catch (error) {
    logger.error('Error fetching NFT counts:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch NFT counts'
    });
  }
});

export default router;