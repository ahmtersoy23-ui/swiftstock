import { Request, Response } from 'express';
import pool from '../config/database';
import logger from '../config/logger';
import { ApiResponse } from '../types';

// ============================================
// GET ALL LOCATIONS
// ============================================
export const getAllLocations = async (req: Request, res: Response) => {
  try {
    const { warehouse_code, zone, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (warehouse_code) {
      params.push(warehouse_code);
      whereClause += ` AND w.code = $${params.length}`;
    }

    if (zone) {
      params.push(zone);
      whereClause += ` AND l.zone = $${params.length}`;
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM wms_locations l
       JOIN wms_warehouses w ON l.warehouse_id = w.warehouse_id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const query = `
      SELECT l.*, w.code as warehouse_code, w.name as warehouse_name
      FROM wms_locations l
      JOIN wms_warehouses w ON l.warehouse_id = w.warehouse_id
      ${whereClause}
      ORDER BY l.location_code
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await pool.query(query, [...params, limitNum, offset]);

    const response: ApiResponse<any> = {
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error getting locations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// GET LOCATION BY ID
// ============================================
export const getLocationById = async (req: Request, res: Response) => {
  try {
    const { location_id } = req.params;

    const result = await pool.query(
      `SELECT l.*, w.code as warehouse_code, w.name as warehouse_name
       FROM wms_locations l
       JOIN wms_warehouses w ON l.warehouse_id = w.warehouse_id
       WHERE l.location_id = $1`,
      [location_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
      });
    }

    const response: ApiResponse<any> = {
      success: true,
      data: result.rows[0],
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error getting location:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// GET LOCATION BY CODE
// ============================================
export const getLocationByCode = async (req: Request, res: Response) => {
  try {
    const { location_code } = req.params;

    const result = await pool.query(
      `SELECT l.*, w.code as warehouse_code, w.name as warehouse_name
       FROM wms_locations l
       JOIN wms_warehouses w ON l.warehouse_id = w.warehouse_id
       WHERE l.location_code = $1`,
      [location_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
      });
    }

    const response: ApiResponse<any> = {
      success: true,
      data: result.rows[0],
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error getting location:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// CREATE LOCATION
// ============================================
export const createLocation = async (req: Request, res: Response) => {
  try {
    const {
      warehouse_code,
      location_code,
      qr_code,
      description,
      zone,
      aisle,
      bay,
      level,
      location_type,
      capacity_units,
      max_weight_kg,
      notes,
    } = req.body;

    // Validate required fields
    if (!warehouse_code || !location_code || !qr_code) {
      return res.status(400).json({
        success: false,
        error: 'warehouse_code, location_code, and qr_code are required',
      });
    }

    // Get warehouse_id from code
    const warehouseResult = await pool.query(
      'SELECT warehouse_id FROM wms_warehouses WHERE code = $1',
      [warehouse_code]
    );

    if (warehouseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found',
      });
    }

    const warehouse_id = warehouseResult.rows[0].warehouse_id;

    // Insert location
    const result = await pool.query(
      `INSERT INTO wms_locations (
        warehouse_id, location_code, qr_code, description, zone,
        aisle, bay, level, location_type, capacity_units, max_weight_kg, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        warehouse_id,
        location_code,
        qr_code,
        description,
        zone,
        aisle,
        bay,
        level,
        location_type || 'RACK',
        capacity_units,
        max_weight_kg,
        notes,
      ]
    );

    const response: ApiResponse<any> = {
      success: true,
      data: result.rows[0],
      message: 'Location created successfully',
    };

    res.status(201).json(response);
  } catch (error: any) {
    logger.error('Error creating location:', error);
    if (error.code === '23505') {
      // Unique constraint violation
      return res.status(409).json({
        success: false,
        error: 'Location code or QR code already exists',
      });
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// UPDATE LOCATION
// ============================================
export const updateLocation = async (req: Request, res: Response) => {
  try {
    const { location_id } = req.params;
    const updates = req.body;

    // Build dynamic update query
    const fields = Object.keys(updates).filter(
      (key) => !['warehouse_id', 'location_id', 'created_at'].includes(key)
    );

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update',
      });
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [location_id, ...fields.map((field) => updates[field])];

    const result = await pool.query(
      `UPDATE wms_locations SET ${setClause}, updated_at = NOW()
       WHERE location_id = $1 RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
      });
    }

    const response: ApiResponse<any> = {
      success: true,
      data: result.rows[0],
      message: 'Location updated successfully',
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// DELETE LOCATION
// ============================================
export const deleteLocation = async (req: Request, res: Response) => {
  try {
    const { location_id } = req.params;

    // Check if location has inventory
    const inventoryCheck = await pool.query(
      'SELECT COUNT(*) as count FROM location_inventory WHERE location_id = $1',
      [location_id]
    );

    if (parseInt(inventoryCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete location with existing inventory',
      });
    }

    const result = await pool.query(
      'DELETE FROM wms_locations WHERE location_id = $1 RETURNING *',
      [location_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Location not found',
      });
    }

    const response: ApiResponse<any> = {
      success: true,
      message: 'Location deleted successfully',
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error deleting location:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// GET LOCATION INVENTORY
// ============================================
export const getLocationInventory = async (req: Request, res: Response) => {
  try {
    const { location_id } = req.params;

    const result = await pool.query(
      `SELECT
        li.*,
        p.product_name,
        p.barcode,
        p.category,
        l.location_code,
        l.zone
       FROM location_inventory li
       JOIN products p ON li.product_sku = p.sku_code
       JOIN wms_locations l ON li.location_id = l.location_id
       WHERE li.location_id = $1
       ORDER BY p.product_name`,
      [location_id]
    );

    const response: ApiResponse<any> = {
      success: true,
      data: result.rows,
      message: `Found ${result.rows.length} products in location`,
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error getting location inventory:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
