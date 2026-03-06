// ============================================
// PRODUCT SERVICE (Shared / READ-ONLY)
// Facade over pricelab_db.products — SwiftStock has READ-ONLY access
// All modules use this service instead of querying products directly
// ============================================

import pool from '../../../config/database';
import logger from '../../../utils/logger';
import { Product } from '../types';

class ProductService {
  /**
   * Get a single product by SKU
   */
  async getProductBySku(sku: string): Promise<Product | null> {
    try {
      const result = await pool.query(
        `SELECT id, product_sku, name AS product_name, category, base_cost, created_at
         FROM products
         WHERE product_sku = $1`,
        [sku]
      );
      return result.rows[0] ?? null;
    } catch (error) {
      logger.error('[ProductService] getProductBySku error:', error);
      throw error;
    }
  }

  /**
   * Check if a product exists (lightweight — no data transfer)
   */
  async productExists(sku: string): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT 1 FROM products WHERE product_sku = $1 LIMIT 1',
        [sku]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('[ProductService] productExists error:', error);
      throw error;
    }
  }

  /**
   * Search products by name, SKU or category
   */
  async searchProducts(query: string, limit = 50): Promise<Product[]> {
    try {
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
         LIMIT $2`,
        [`%${query}%`, limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('[ProductService] searchProducts error:', error);
      throw error;
    }
  }

  /**
   * Get all products with optional filters and pagination
   */
  async getAllProducts(opts: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
  } = {}): Promise<{ products: Product[]; total: number }> {
    const { page = 1, limit = 100, search = '', category = '' } = opts;
    const offset = (page - 1) * limit;

    let query =
      'SELECT id, product_sku, name AS product_name, category, base_cost, created_at FROM products WHERE product_sku IS NOT NULL';
    let countQuery = 'SELECT COUNT(*) FROM products WHERE product_sku IS NOT NULL';
    const params: (string | number)[] = [];

    if (category) {
      query += ` AND LOWER(category) = LOWER($${params.length + 1})`;
      countQuery += ` AND LOWER(category) = LOWER($${params.length + 1})`;
      params.push(category);
    }

    if (search) {
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
      params.push(`%${search}%`);
    }

    query += ` ORDER BY name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    try {
      const [countResult, dataResult] = await Promise.all([
        pool.query(countQuery, params.slice(0, -2)),
        pool.query(query, params),
      ]);

      return {
        products: dataResult.rows,
        total: parseInt(countResult.rows[0].count),
      };
    } catch (error) {
      logger.error('[ProductService] getAllProducts error:', error);
      throw error;
    }
  }
}

export const productService = new ProductService();
