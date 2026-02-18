import { Request, Response } from 'express';
import pool from '../config/database';
import { ApiResponse } from '../types';

/**
 * Get inventory summary by warehouse
 */
export const getInventorySummary = async (req: Request, res: Response) => {
  try {
    const { warehouse_code, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    const params: any[] = [];
    if (warehouse_code) {
      whereClause = ' WHERE warehouse_code = $1';
      params.push(warehouse_code);
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM v_inventory_summary${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const query = `
      SELECT * FROM v_inventory_summary${whereClause}
      ORDER BY warehouse_code, product_name
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await pool.query(query, [...params, limitNum, offset]);

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Get inventory summary error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};

/**
 * Get inventory by SKU
 */
export const getInventoryBySku = async (req: Request, res: Response) => {
  try {
    const { product_sku } = req.params;

    const result = await pool.query(
      `SELECT 
        i.*,
        p.product_name,
        p.barcode,
        p.units_per_box,
        p.boxes_per_pallet,
        w.code as warehouse_code,
        w.name as warehouse_name,
        l.qr_code as location_code
       FROM inventory i
       JOIN products p ON i.product_sku = p.sku_code
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       LEFT JOIN wms_locations l ON i.location_id = l.location_id
       WHERE i.product_sku = $1 AND i.quantity_each > 0
       ORDER BY w.code`,
      [product_sku]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No inventory found for this SKU',
      } as ApiResponse);
    }

    // Calculate totals
    const totalEach = result.rows.reduce((sum, row) => sum + row.quantity_each, 0);
    const unitsPerBox = result.rows[0].units_per_box;
    const boxesPerPallet = result.rows[0].boxes_per_pallet;

    return res.json({
      success: true,
      data: {
        product_sku,
        product_name: result.rows[0].product_name,
        barcode: result.rows[0].barcode,
        locations: result.rows,
        totals: {
          each: totalEach,
          boxes: Math.floor(totalEach / unitsPerBox),
          pallets: Math.floor(totalEach / (unitsPerBox * boxesPerPallet)),
        },
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Get inventory by SKU error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};

/**
 * Get low stock items
 */
export const getLowStock = async (req: Request, res: Response) => {
  try {
    const { warehouse_code, threshold = 10, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE i.quantity_each <= $1 AND i.quantity_each > 0';
    const countParams: any[] = [threshold];

    if (warehouse_code) {
      whereClause += ' AND w.code = $2';
      countParams.push(warehouse_code);
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM inventory i
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       ${whereClause}`,
      countParams
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const query = `
      SELECT
        i.*,
        p.product_name,
        p.barcode,
        w.code as warehouse_code,
        l.qr_code as location_code
      FROM inventory i
      JOIN products p ON i.product_sku = p.sku_code
      JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
      LEFT JOIN wms_locations l ON i.location_id = l.location_id
      ${whereClause}
      ORDER BY i.quantity_each ASC
      LIMIT $${countParams.length + 1} OFFSET $${countParams.length + 2}
    `;

    const result = await pool.query(query, [...countParams, limitNum, offset]);

    return res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Get low stock error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};

/**
 * Search inventory by product name or SKU
 */
export const searchInventory = async (req: Request, res: Response) => {
  try {
    const { query, warehouse_code } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required',
      } as ApiResponse);
    }

    let sql = `
      SELECT * FROM v_inventory_summary
      WHERE (
        LOWER(product_name) LIKE LOWER($1)
        OR LOWER(product_sku) LIKE LOWER($1)
        OR barcode LIKE $1
      )
    `;

    const params: any[] = [`%${query}%`];

    if (warehouse_code) {
      sql += ' AND warehouse_code = $2';
      params.push(warehouse_code);
    }

    sql += ' ORDER BY product_name LIMIT 50';

    const result = await pool.query(sql, params);

    return res.json({
      success: true,
      data: result.rows,
    } as ApiResponse);

  } catch (error) {
    console.error('Search inventory error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};
