import { Request, Response } from 'express';
import pool from '../config/database';
import { ApiResponse } from '../index';

// ============================================
// WAREHOUSE ROUTES
// ============================================

export const getAllWarehouses = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM wms_warehouses WHERE is_active = true ORDER BY code'
    );

    const response: ApiResponse = {
      success: true,
      data: result.rows,
      message: `Found ${result.rows.length} warehouses`,
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error getting warehouses:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getWarehouseByCode = async (req: Request, res: Response) => {
  try {
    const { warehouse_code } = req.params;

    const result = await pool.query(
      'SELECT * FROM wms_warehouses WHERE code = $1',
      [warehouse_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error getting warehouse:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getWarehouseById = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = req.params;

    const result = await pool.query(
      'SELECT * FROM wms_warehouses WHERE warehouse_id = $1',
      [warehouse_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
    };

    res.json(response);
  } catch (error: any) {
    console.error('Error getting warehouse:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
