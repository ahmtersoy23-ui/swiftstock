// ============================================
// SERIAL NUMBER CONTROLLER
// ============================================

import { Request, Response } from 'express';
import pool from '../config/database';

interface SerialNumber {
  serial_id: number;
  sku_code: string;
  serial_no: string;
  full_barcode: string;
  status: 'AVAILABLE' | 'IN_STOCK' | 'SHIPPED' | 'USED';
  warehouse_id?: number;
  location_id?: number;
  created_at: Date;
  last_scanned_at?: Date;
}

// Generate serial numbers for a product (for label printing)
export const generateSerialNumbers = async (req: Request, res: Response) => {
  const { product_sku, quantity } = req.body;

  if (!product_sku || !quantity || quantity < 1) {
    return res.status(400).json({
      success: false,
      error: 'sku_code and quantity (>= 1) are required',
    });
  }

  if (quantity > 1000) {
    return res.status(400).json({
      success: false,
      error: 'Maximum 1000 serial numbers per request',
    });
  }

  try {
    // Verify product exists
    const productCheck = await pool.query(
      'SELECT product_sku, product_name FROM products WHERE product_sku = $1',
      [product_sku]
    );

    if (productCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const product = productCheck.rows[0];
    const generatedSerials: SerialNumber[] = [];

    // Generate serial numbers in a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (let i = 0; i < quantity; i++) {
        // Get next serial number using database function
        const serialResult = await client.query(
          'SELECT get_next_serial($1) as serial_no',
          [product_sku]
        );
        const serial_no = serialResult.rows[0].serial_no;
        const full_barcode = `${product_sku}-${serial_no}`;

        // Insert serial number record
        const insertResult = await client.query(
          `INSERT INTO serial_numbers (product_sku, serial_no, full_barcode, status)
           VALUES ($1, $2, $3, 'AVAILABLE')
           RETURNING *`,
          [product_sku, serial_no, full_barcode]
        );

        generatedSerials.push(insertResult.rows[0]);
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      data: {
        product_name: product.product_name,
        sku_code: product_sku,
        count: generatedSerials.length,
        serials: generatedSerials.map((s) => ({
          serial_no: s.serial_no,
          full_barcode: s.full_barcode,
        })),
      },
    });
  } catch (error: any) {
    console.error('Generate serial numbers error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Get serial numbers for a product
export const getSerialNumbers = async (req: Request, res: Response) => {
  const { product_sku } = req.params;
  const { status, limit = 100, offset = 0 } = req.query;

  try {
    let query = `
      SELECT sn.*, p.product_name, w.code as warehouse_code, l.qr_code as location_code
      FROM serial_numbers sn
      JOIN products p ON p.product_sku = sn.sku_code
      LEFT JOIN wms_warehouses w ON w.warehouse_id = sn.warehouse_id
      LEFT JOIN wms_locations l ON l.location_id = sn.location_id
      WHERE sn.product_sku = $1
    `;
    const params: any[] = [product_sku];

    if (status) {
      query += ` AND sn.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY sn.serial_id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM serial_numbers WHERE product_sku = $1 ${status ? 'AND status = $2' : ''}`,
      status ? [product_sku, status] : [product_sku]
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (error: any) {
    console.error('Get serial numbers error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Lookup a serial number by full barcode
export const lookupSerialBarcode = async (req: Request, res: Response) => {
  const { barcode } = req.params;

  try {
    const result = await pool.query(
      `SELECT sn.*, p.product_name, p.base_unit, p.units_per_box,
              w.code as warehouse_code, l.qr_code as location_code
       FROM serial_numbers sn
       JOIN products p ON p.product_sku = sn.sku_code
       LEFT JOIN wms_warehouses w ON w.warehouse_id = sn.warehouse_id
       LEFT JOIN wms_locations l ON l.location_id = sn.location_id
       WHERE sn.full_barcode = $1`,
      [barcode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Serial number not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Lookup serial barcode error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Update serial number status (used during IN/OUT transactions)
export const updateSerialStatus = async (req: Request, res: Response) => {
  const { barcode } = req.params;
  const { status, warehouse_id, location_id, transaction_id } = req.body;

  const validStatuses = ['AVAILABLE', 'IN_STOCK', 'SHIPPED', 'USED'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
  }

  try {
    const result = await pool.query(
      `UPDATE serial_numbers
       SET status = $1,
           warehouse_id = $2,
           location_id = $3,
           last_transaction_id = $4,
           last_scanned_at = CURRENT_TIMESTAMP
       WHERE full_barcode = $5
       RETURNING *`,
      [status, warehouse_id || null, location_id || null, transaction_id || null, barcode]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Serial number not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error: any) {
    console.error('Update serial status error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Get serial number statistics for a product
export const getSerialStats = async (req: Request, res: Response) => {
  const { product_sku } = req.params;

  try {
    const result = await pool.query(
      `SELECT
         status,
         COUNT(*) as count
       FROM serial_numbers
       WHERE product_sku = $1
       GROUP BY status`,
      [product_sku]
    );

    const stats: Record<string, number> = {
      AVAILABLE: 0,
      IN_STOCK: 0,
      SHIPPED: 0,
      USED: 0,
      total: 0,
    };

    result.rows.forEach((row) => {
      stats[row.status] = parseInt(row.count);
      stats.total += parseInt(row.count);
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Get serial stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Parse SKU-SERIAL barcode format
export const parseSerialBarcode = (barcode: string): { sku_code: string; serial_no: string } | null => {
  // Format: SKU-SERIAL (e.g., IWA-12345-000001)
  // Last 6 characters after final dash are serial number
  const lastDashIndex = barcode.lastIndexOf('-');
  if (lastDashIndex === -1) return null;

  const potentialSerial = barcode.substring(lastDashIndex + 1);

  // Serial number should be 6 digits
  if (!/^\d{6}$/.test(potentialSerial)) return null;

  return {
    sku_code: barcode.substring(0, lastDashIndex),
    serial_no: potentialSerial,
  };
};

// Get serial number history (all operations/events)
export const getSerialHistory = async (req: Request, res: Response) => {
  const { barcode } = req.params;

  try {
    // First get the serial number info
    const serialResult = await pool.query(
      `SELECT sn.*, p.product_name
       FROM serial_numbers sn
       JOIN products p ON p.product_sku = sn.sku_code
       WHERE sn.full_barcode = $1`,
      [barcode]
    );

    if (serialResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Serial number not found',
      });
    }

    const serialInfo = serialResult.rows[0];

    // Get history from serial_history table
    const historyResult = await pool.query(
      `SELECT
         sh.history_id,
         sh.event_type,
         sh.from_status,
         sh.to_status,
         sh.notes,
         sh.created_at,
         fl.location_code as from_location,
         tl.location_code as to_location,
         fw.code as from_warehouse,
         tw.code as to_warehouse,
         u.username as performed_by,
         ss.mode_type as session_mode
       FROM serial_history sh
       LEFT JOIN wms_locations fl ON fl.location_id = sh.from_location_id
       LEFT JOIN wms_locations tl ON tl.location_id = sh.to_location_id
       LEFT JOIN wms_warehouses fw ON fw.warehouse_id = sh.from_warehouse_id
       LEFT JOIN wms_warehouses tw ON tw.warehouse_id = sh.to_warehouse_id
       LEFT JOIN wms_users u ON u.user_id = sh.user_id
       LEFT JOIN scan_sessions ss ON ss.session_id = sh.session_id
       WHERE sh.full_barcode = $1
       ORDER BY sh.created_at DESC`,
      [barcode]
    );

    // Also get related scan operations for additional context
    const scanOpsResult = await pool.query(
      `SELECT
         so.operation_id,
         so.operation_type,
         so.quantity,
         so.unit_type,
         so.scanned_at,
         so.notes,
         ss.mode_type,
         ss.session_code,
         ss.user_name,
         l.location_code
       FROM scan_operations so
       JOIN scan_sessions ss ON ss.session_id = so.session_id
       LEFT JOIN wms_locations l ON l.location_code = so.location_code
       WHERE so.product_sku = $1
       ORDER BY so.scanned_at DESC
       LIMIT 50`,
      [serialInfo.sku_code]
    );

    res.json({
      success: true,
      data: {
        serial: {
          serial_id: serialInfo.serial_id,
          full_barcode: serialInfo.full_barcode,
          sku_code: serialInfo.product_sku,
          serial_no: serialInfo.serial_no,
          product_name: serialInfo.product_name,
          status: serialInfo.status,
          created_at: serialInfo.created_at,
          last_scanned_at: serialInfo.last_scanned_at,
        },
        history: historyResult.rows,
        scan_operations: scanOpsResult.rows,
      },
    });
  } catch (error: any) {
    console.error('Get serial history error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Add a history entry for serial number
export const addSerialHistoryEntry = async (
  serial_id: number,
  full_barcode: string,
  event_type: string,
  options: {
    from_status?: string;
    to_status?: string;
    from_location_id?: number;
    to_location_id?: number;
    from_warehouse_id?: number;
    to_warehouse_id?: number;
    session_id?: number;
    transaction_id?: number;
    user_id?: number;
    notes?: string;
  }
) => {
  try {
    await pool.query(
      `INSERT INTO serial_history
       (serial_id, full_barcode, event_type, from_status, to_status,
        from_location_id, to_location_id, from_warehouse_id, to_warehouse_id,
        session_id, transaction_id, user_id, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        serial_id,
        full_barcode,
        event_type,
        options.from_status || null,
        options.to_status || null,
        options.from_location_id || null,
        options.to_location_id || null,
        options.from_warehouse_id || null,
        options.to_warehouse_id || null,
        options.session_id || null,
        options.transaction_id || null,
        options.user_id || null,
        options.notes || null,
      ]
    );
    return true;
  } catch (error) {
    console.error('Failed to add serial history entry:', error);
    return false;
  }
};
