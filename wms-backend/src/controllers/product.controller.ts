import { Request, Response } from 'express';
import pool from '../config/database';
import { ApiResponse } from '../types';

/**
 * Product interface matching pricelab_db schema
 * Note: SwiftStock has READ-ONLY access to products table
 */
interface Product {
  id: string;  // UUID in pricelab_db
  product_sku: string;
  product_name: string;  // Aliased from 'name' field
  category?: string;
  base_cost?: number;
  created_at?: Date;
  updated_at?: Date;
}

/**
 * Get all products with pagination and search
 * READ-ONLY from pricelab products table
 */
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const {
      page = '1',
      limit = '100',
      search = '',
      category_id = ''
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    const searchTerm = search as string;
    const categoryFilter = category_id as string;

    // Only select products with product_sku (required for WMS)
    let query = 'SELECT id, product_sku, name AS product_name, category, base_cost, created_at FROM products WHERE product_sku IS NOT NULL';
    let countQuery = 'SELECT COUNT(*) FROM products WHERE product_sku IS NOT NULL';
    const params: any[] = [];

    // Add category filter if provided
    if (categoryFilter) {
      query += ` AND LOWER(category) = LOWER($${params.length + 1})`;
      countQuery += ` AND LOWER(category) = LOWER($${params.length + 1})`;
      params.push(categoryFilter);
    }

    // Add search filter if provided
    if (searchTerm) {
      query += ` AND (
        LOWER(name) LIKE LOWER($${params.length + 1})
        OR LOWER(product_sku) LIKE LOWER($${params.length + 1})
        OR LOWER(category) LIKE LOWER($${params.length + 1})
      )`;
      countQuery += ` AND (
        LOWER(name) LIKE LOWER($${params.length + 1})
        OR LOWER(product_sku) LIKE LOWER($${params.length + 1})
        OR LOWER(category) LIKE LOWER($${params.length + 1})
      )`;
      params.push(`%${searchTerm}%`);
    }

    query += ` ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limitNum, offset);

    // Get total count
    const countResult = await pool.query(countQuery, params.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const result = await pool.query(query, params);

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });

  } catch (error) {
    console.error('Get all products error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};

/**
 * Get product by SKU
 * READ-ONLY from pricelab products table
 */
export const getProductBySku = async (req: Request, res: Response) => {
  try {
    const { product_sku } = req.params;

    const result = await pool.query(
      'SELECT id, product_sku, name AS product_name, category, base_cost, created_at FROM products WHERE product_sku = $1',
      [product_sku]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: result.rows[0],
    } as ApiResponse<Product>);

  } catch (error) {
    console.error('Get product by SKU error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};

/**
 * Search products
 * READ-ONLY from pricelab products table
 */
export const searchProducts = async (req: Request, res: Response) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
      } as ApiResponse);
    }

    const result = await pool.query(
      `SELECT id, product_sku, name AS product_name, category, base_cost, created_at
       FROM products
       WHERE product_sku IS NOT NULL
         AND (
           LOWER(name) LIKE LOWER($1)
           OR LOWER(product_sku) LIKE LOWER($1)
           OR LOWER(category) LIKE LOWER($1)
         )
       ORDER BY name
       LIMIT 50`,
      [`%${query}%`]
    );

    return res.json({
      success: true,
      data: result.rows,
    } as ApiResponse<Product[]>);

  } catch (error) {
    console.error('Search products error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};

/**
 * Create new product
 * DISABLED: SwiftStock has READ-ONLY access to products table
 * Products should be managed from PriceLab
 */
export const createProduct = async (req: Request, res: Response) => {
  return res.status(403).json({
    success: false,
    error: 'Product creation is disabled. Please manage products from PriceLab.',
  } as ApiResponse);
};

/**
 * Update product
 * DISABLED: SwiftStock has READ-ONLY access to products table
 * Products should be managed from PriceLab
 */
export const updateProduct = async (req: Request, res: Response) => {
  return res.status(403).json({
    success: false,
    error: 'Product updates are disabled. Please manage products from PriceLab.',
  } as ApiResponse);
};

/**
 * Delete (deactivate) product
 * DISABLED: SwiftStock has READ-ONLY access to products table
 * Products should be managed from PriceLab
 */
export const deleteProduct = async (req: Request, res: Response) => {
  return res.status(403).json({
    success: false,
    error: 'Product deletion is disabled. Please manage products from PriceLab.',
  } as ApiResponse);
};
