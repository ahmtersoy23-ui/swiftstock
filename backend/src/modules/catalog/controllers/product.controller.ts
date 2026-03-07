// ============================================
// PRODUCT CONTROLLER — Module 1 (Catalog, thin wrapper)
// Ürün HTTP endpoint'leri. İş mantığı → shared/productService
// ============================================

import { Request, Response } from 'express';
import logger from '../../../config/logger';
import { productService } from '../../shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  logger.error(`[ProductController] ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '100', search = '', category_id = '' } = req.query;

    const result = await productService.getAllProducts({
      page: parseInt(page as string),
      limit: parseInt(limit as string),
      search: search as string,
      category: category_id as string,
    });

    res.json({
      success: true,
      data: result.products,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: result.total,
        totalPages: Math.ceil(result.total / parseInt(limit as string)),
      },
    });
  } catch (error) {
    handleError(res, error, 'getAllProducts');
  }
};

export const getProductBySku = async (req: Request, res: Response) => {
  try {
    const { product_sku } = req.params;
    const data = await productService.getProductBySku(product_sku);

    if (!data) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getProductBySku');
  }
};

export const searchProducts = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;

    if (!query) {
      res.status(400).json({ success: false, error: 'Query parameter is required' });
      return;
    }

    const data = await productService.searchProducts(query as string);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'searchProducts');
  }
};

// Products are managed from PriceLab — these endpoints are intentionally disabled.

export const createProduct = (_req: Request, res: Response) => {
  res.status(403).json({
    success: false,
    error: 'Product creation is disabled. Please manage products from PriceLab.',
  });
};

export const updateProduct = (_req: Request, res: Response) => {
  res.status(403).json({
    success: false,
    error: 'Product updates are disabled. Please manage products from PriceLab.',
  });
};

export const deleteProduct = (_req: Request, res: Response) => {
  res.status(403).json({
    success: false,
    error: 'Product deletion is disabled. Please manage products from PriceLab.',
  });
};
