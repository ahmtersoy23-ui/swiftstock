import { Request, Response } from 'express';
import pool from '../config/database';
import { Product, ApiResponse } from '../types';

/**
 * Get all products with pagination and search
 */
export const getAllProducts = async (req: Request, res: Response) => {
  try {
    const {
      is_active = 'true',
      page = '1',
      limit = '100',
      search = '',
      category = ''
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;
    const isActive = is_active === 'true';
    const searchTerm = search as string;
    const categoryFilter = category as string;

    let query = 'SELECT * FROM products WHERE is_active = $1';
    let countQuery = 'SELECT COUNT(*) FROM products WHERE is_active = $1';
    const params: any[] = [isActive];

    // Add category filter if provided
    if (categoryFilter) {
      query += ` AND category = $${params.length + 1}`;
      countQuery += ` AND category = $${params.length + 1}`;
      params.push(categoryFilter);
    }

    // Add search filter if provided
    if (searchTerm) {
      query += ` AND (
        LOWER(product_name) LIKE LOWER($${params.length + 1})
        OR LOWER(sku_code) LIKE LOWER($${params.length + 1})
        OR LOWER(category) LIKE LOWER($${params.length + 1})
        OR barcode LIKE $${params.length + 1}
      )`;
      countQuery += ` AND (
        LOWER(product_name) LIKE LOWER($${params.length + 1})
        OR LOWER(sku_code) LIKE LOWER($${params.length + 1})
        OR LOWER(category) LIKE LOWER($${params.length + 1})
        OR barcode LIKE $${params.length + 1}
      )`;
      params.push(`%${searchTerm}%`);
    }

    query += ` ORDER BY product_name LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
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
 */
export const getProductBySku = async (req: Request, res: Response) => {
  try {
    const { sku_code } = req.params;

    const result = await pool.query(
      'SELECT * FROM products WHERE sku_code = $1',
      [sku_code]
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
 * Create new product
 */
export const createProduct = async (req: Request, res: Response) => {
  try {
    const {
      sku_code,
      product_name,
      description,
      barcode,
      category,
      base_unit,
      units_per_box,
      boxes_per_pallet,
      weight_kg,
      dimensions_cm,
    } = req.body;

    // Validation - only sku_code and product_name are required
    if (!sku_code || !product_name) {
      return res.status(400).json({
        success: false,
        error: 'sku_code and product_name are required',
      } as ApiResponse);
    }

    const result = await pool.query(
      `INSERT INTO products
       (sku_code, product_name, description, barcode, category, base_unit, units_per_box, boxes_per_pallet, weight_kg, dimensions_cm)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        sku_code,
        product_name,
        description,
        barcode || null,
        category,
        base_unit || 'EACH',
        units_per_box || 1,
        boxes_per_pallet || 1,
        weight_kg,
        dimensions_cm,
      ]
    );

    return res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Product created successfully',
    } as ApiResponse<Product>);

  } catch (error: any) {
    console.error('Create product error:', error);

    // Handle unique constraint violations
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        error: 'Product with this SKU or barcode already exists',
      } as ApiResponse);
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};

/**
 * Update product
 */
export const updateProduct = async (req: Request, res: Response) => {
  try {
    const { sku_code } = req.params;
    const {
      product_name,
      description,
      barcode,
      base_unit,
      units_per_box,
      boxes_per_pallet,
      weight_kg,
      dimensions_cm,
    } = req.body;

    const result = await pool.query(
      `UPDATE products 
       SET 
         product_name = COALESCE($2, product_name),
         description = COALESCE($3, description),
         barcode = COALESCE($4, barcode),
         base_unit = COALESCE($5, base_unit),
         units_per_box = COALESCE($6, units_per_box),
         boxes_per_pallet = COALESCE($7, boxes_per_pallet),
         weight_kg = COALESCE($8, weight_kg),
         dimensions_cm = COALESCE($9, dimensions_cm),
         updated_at = CURRENT_TIMESTAMP
       WHERE sku_code = $1
       RETURNING *`,
      [sku_code, product_name, description, barcode, base_unit, units_per_box, boxes_per_pallet, weight_kg, dimensions_cm]
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
      message: 'Product updated successfully',
    } as ApiResponse<Product>);

  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};

/**
 * Delete (deactivate) product
 */
export const deleteProduct = async (req: Request, res: Response) => {
  try {
    const { sku_code } = req.params;

    const result = await pool.query(
      'UPDATE products SET is_active = false WHERE sku_code = $1 RETURNING *',
      [sku_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      message: 'Product deactivated successfully',
    } as ApiResponse);

  } catch (error) {
    console.error('Delete product error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};

/**
 * Search products
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
      `SELECT * FROM products 
       WHERE is_active = true 
         AND (
           LOWER(product_name) LIKE LOWER($1)
           OR LOWER(sku_code) LIKE LOWER($1)
           OR barcode LIKE $1
         )
       ORDER BY product_name
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
