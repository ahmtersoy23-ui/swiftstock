import { Request, Response } from 'express';
import pool from '../config/database';
import logger from '../config/logger';
import { ApiResponse } from '../index';

// ============================================
// OPERATION MODES
// ============================================

export const getAllOperationModes = async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM operation_modes WHERE is_active = true ORDER BY mode_type, mode_code'
    );

    const response: ApiResponse = {
      success: true,
      data: result.rows,
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error getting operation modes:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getOperationModeByCode = async (req: Request, res: Response) => {
  try {
    const { mode_code } = req.params;

    const result = await pool.query(
      'SELECT * FROM operation_modes WHERE mode_code = $1',
      [mode_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Operation mode not found',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error getting operation mode:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// SCAN SESSIONS
// ============================================

// Generate session code: SESSION-YYYYMM-00001
const generateSessionCode = async (): Promise<string> => {
  const now = new Date();
  const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Get count of sessions this month
  const result = await pool.query(
    `SELECT COUNT(*) as count FROM scan_sessions
     WHERE session_code LIKE $1`,
    [`SESSION-${yearMonth}-%`]
  );

  const count = parseInt(result.rows[0].count) + 1;
  const sessionNumber = String(count).padStart(5, '0');

  return `SESSION-${yearMonth}-${sessionNumber}`;
};

export const createScanSession = async (req: Request, res: Response) => {
  try {
    const { warehouse_code, user_name, mode_type, notes } = req.body;

    // Validate required fields
    if (!warehouse_code || !user_name || !mode_type) {
      return res.status(400).json({
        success: false,
        error: 'warehouse_code, user_name, and mode_type are required',
      });
    }

    // Validate mode_type
    const validModes = ['RECEIVING', 'PICKING', 'TRANSFER', 'COUNT'];
    if (!validModes.includes(mode_type)) {
      return res.status(400).json({
        success: false,
        error: `mode_type must be one of: ${validModes.join(', ')}`,
      });
    }

    // Get warehouse_id
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

    // Check if user has active session
    const activeSessionCheck = await pool.query(
      `SELECT session_id, session_code FROM scan_sessions
       WHERE user_name = $1 AND status = 'ACTIVE'`,
      [user_name]
    );

    if (activeSessionCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: `User already has an active session: ${activeSessionCheck.rows[0].session_code}`,
        data: activeSessionCheck.rows[0],
      });
    }

    // Generate session code
    const session_code = await generateSessionCode();

    // Create session
    const result = await pool.query(
      `INSERT INTO scan_sessions (session_code, warehouse_id, user_name, mode_type, notes)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [session_code, warehouse_id, user_name, mode_type, notes]
    );

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      message: 'Scan session created successfully',
    };

    res.status(201).json(response);
  } catch (error: any) {
    logger.error('Error creating scan session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getScanSession = async (req: Request, res: Response) => {
  try {
    const { session_id } = req.params;

    const result = await pool.query(
      `SELECT s.*, w.code as warehouse_code, w.name as warehouse_name
       FROM scan_sessions s
       JOIN wms_warehouses w ON s.warehouse_id = w.warehouse_id
       WHERE s.session_id = $1`,
      [session_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error getting scan session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getActiveScanSession = async (req: Request, res: Response) => {
  try {
    const { user_name } = req.query;

    if (!user_name) {
      return res.status(400).json({
        success: false,
        error: 'user_name is required',
      });
    }

    const result = await pool.query(
      `SELECT s.*, w.code as warehouse_code, w.name as warehouse_name
       FROM scan_sessions s
       JOIN wms_warehouses w ON s.warehouse_id = w.warehouse_id
       WHERE s.user_name = $1 AND s.status = 'ACTIVE'
       ORDER BY s.started_at DESC
       LIMIT 1`,
      [user_name]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No active session found for user',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error getting active scan session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const completeScanSession = async (req: Request, res: Response) => {
  try {
    const { session_id } = req.params;
    const { notes } = req.body;

    const result = await pool.query(
      `UPDATE scan_sessions
       SET status = 'COMPLETED', completed_at = NOW(), notes = COALESCE($2, notes)
       WHERE session_id = $1 AND status = 'ACTIVE'
       RETURNING *`,
      [session_id, notes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Active session not found',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      message: 'Session completed successfully',
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error completing scan session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const cancelScanSession = async (req: Request, res: Response) => {
  try {
    const { session_id } = req.params;
    const { notes } = req.body;

    const result = await pool.query(
      `UPDATE scan_sessions
       SET status = 'CANCELLED', completed_at = NOW(), notes = COALESCE($2, notes)
       WHERE session_id = $1 AND status = 'ACTIVE'
       RETURNING *`,
      [session_id, notes]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Active session not found',
      });
    }

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      message: 'Session cancelled successfully',
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error cancelling scan session:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// SCAN OPERATIONS
// ============================================

export const addScanOperation = async (req: Request, res: Response) => {
  try {
    const {
      session_id,
      operation_type,
      product_sku,
      location_id,
      from_location_id,
      to_location_id,
      quantity,
      unit_type,
      notes,
    } = req.body;

    // Validate required fields
    if (!session_id || !operation_type) {
      return res.status(400).json({
        success: false,
        error: 'session_id and operation_type are required',
      });
    }

    // Verify session is active
    const sessionCheck = await pool.query(
      'SELECT status FROM scan_sessions WHERE session_id = $1',
      [session_id]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    if (sessionCheck.rows[0].status !== 'ACTIVE') {
      return res.status(400).json({
        success: false,
        error: 'Session is not active',
      });
    }

    // Insert operation
    const result = await pool.query(
      `INSERT INTO scan_operations (
        session_id, operation_type, product_sku, location_id,
        from_location_id, to_location_id, quantity, unit_type, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        session_id,
        operation_type,
        product_sku,
        location_id,
        from_location_id,
        to_location_id,
        quantity,
        unit_type,
        notes,
      ]
    );

    const response: ApiResponse = {
      success: true,
      data: result.rows[0],
      message: 'Scan operation added successfully',
    };

    res.status(201).json(response);
  } catch (error: any) {
    logger.error('Error adding scan operation:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

export const getSessionOperations = async (req: Request, res: Response) => {
  try {
    const { session_id } = req.params;

    const result = await pool.query(
      `SELECT
        so.*,
        p.product_name,
        p.barcode,
        l.location_code,
        fl.location_code as from_location_code,
        tl.location_code as to_location_code
       FROM scan_operations so
       LEFT JOIN products p ON so.product_sku = p.sku_code
       LEFT JOIN wms_locations l ON so.location_id = l.location_id
       LEFT JOIN wms_locations fl ON so.from_location_id = fl.location_id
       LEFT JOIN wms_locations tl ON so.to_location_id = tl.location_id
       WHERE so.session_id = $1
       ORDER BY so.scanned_at DESC`,
      [session_id]
    );

    const response: ApiResponse = {
      success: true,
      data: result.rows,
      message: `Found ${result.rows.length} operations`,
    };

    res.json(response);
  } catch (error: any) {
    logger.error('Error getting session operations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
