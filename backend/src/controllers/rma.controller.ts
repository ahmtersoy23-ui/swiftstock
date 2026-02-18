// ============================================
// RMA (RETURNS) CONTROLLER
// ============================================

import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants';

/**
 * Get all RMA requests
 */
export const getAllRMAs = async (req: AuthRequest, res: Response) => {
  try {
    const { warehouse_id, status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        r.*,
        w.name as warehouse_name,
        w.code as warehouse_code,
        COUNT(DISTINCT i.item_id) as total_items,
        SUM(i.quantity_requested) as total_quantity
      FROM rma_requests r
      JOIN wms_warehouses w ON r.warehouse_id = w.warehouse_id
      LEFT JOIN rma_items i ON r.rma_id = i.rma_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (warehouse_id) {
      query += ` AND r.warehouse_id = $${paramIndex++}`;
      params.push(warehouse_id);
    }

    if (status) {
      query += ` AND r.status = $${paramIndex++}`;
      params.push(status);
    }

    query += `
      GROUP BY r.rma_id, w.name, w.code
      ORDER BY r.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: result.rows.length,
      },
    });
  } catch (error) {
    console.error('Get RMAs error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Get RMA by ID
 */
export const getRMAById = async (req: AuthRequest, res: Response) => {
  try {
    const { rma_id } = req.params;

    const rmaResult = await pool.query(
      `SELECT r.*, w.name as warehouse_name, w.code as warehouse_code
       FROM rma_requests r
       JOIN wms_warehouses w ON r.warehouse_id = w.warehouse_id
       WHERE r.rma_id = $1`,
      [rma_id]
    );

    if (rmaResult.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'RMA bulunamadı',
      });
      return;
    }

    const itemsResult = await pool.query(
      `SELECT i.*, p.product_name
       FROM rma_items i
       JOIN products p ON i.product_sku = p.sku_code
       WHERE i.rma_id = $1`,
      [rma_id]
    );

    const historyResult = await pool.query(
      `SELECT * FROM rma_history WHERE rma_id = $1 ORDER BY created_at DESC`,
      [rma_id]
    );

    res.json({
      success: true,
      data: {
        rma: rmaResult.rows[0],
        items: itemsResult.rows,
        history: historyResult.rows,
      },
    });
  } catch (error) {
    console.error('Get RMA error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Create new RMA request
 */
export const createRMA = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      warehouse_id,
      customer_name,
      customer_email,
      order_number,
      reason,
      priority,
      notes,
      items, // Array of { product_sku, quantity_requested, unit_price?, action }
    } = req.body;

    if (!warehouse_id || !reason || !items || items.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_MESSAGES.INVALID_REQUEST,
      });
      return;
    }

    await client.query('BEGIN');

    // Generate RMA number
    const rmaNumber = `RMA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

    // Create RMA request
    const rmaResult = await client.query(
      `INSERT INTO rma_requests
        (rma_number, warehouse_id, customer_name, customer_email, order_number, status, reason, priority, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        rmaNumber,
        warehouse_id,
        customer_name || null,
        customer_email || null,
        order_number || null,
        'PENDING',
        reason,
        priority || 'NORMAL',
        notes || null,
        req.user?.username || 'system',
      ]
    );

    const rma = rmaResult.rows[0];

    // Add items (batched INSERT)
    if (items.length > 0) {
      const valuesClauses: string[] = [];
      const insertParams: any[] = [];
      items.forEach((item: any, idx: number) => {
        const offset = idx * 5;
        valuesClauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`);
        insertParams.push(rma.rma_id, item.product_sku, item.quantity_requested, item.unit_price || null, item.action);
      });
      await client.query(
        `INSERT INTO rma_items (rma_id, product_sku, quantity_requested, unit_price, action)
         VALUES ${valuesClauses.join(', ')}`,
        insertParams
      );
    }

    // Add history record
    await client.query(
      `INSERT INTO rma_history (rma_id, action, new_status, performed_by)
       VALUES ($1, $2, $3, $4)`,
      [rma.rma_id, 'CREATED', 'PENDING', req.user?.username || 'system']
    );

    await client.query('COMMIT');

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: rma,
      message: 'RMA talebi oluşturuldu',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Create RMA error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Approve RMA request
 */
export const approveRMA = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { rma_id } = req.params;
    const { notes } = req.body;

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE rma_requests
       SET status = 'APPROVED',
           approved_date = CURRENT_TIMESTAMP,
           approved_by = $2,
           internal_notes = COALESCE(internal_notes || E'\\n\\n', '') || $3
       WHERE rma_id = $1 AND status = 'PENDING'
       RETURNING *`,
      [rma_id, req.user?.username || 'system', notes || 'Onaylandı']
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'RMA bulunamadı veya zaten onaylanmış',
      });
      return;
    }

    await client.query(
      `INSERT INTO rma_history (rma_id, action, old_status, new_status, performed_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [rma_id, 'APPROVED', 'PENDING', 'APPROVED', req.user?.username || 'system', notes]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: result.rows[0],
      message: 'RMA onaylandı',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Approve RMA error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Receive returned items
 */
export const receiveReturn = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { item_id } = req.params;
    const { quantity_received, condition, location_id, notes } = req.body;

    if (!quantity_received || !condition) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Alınan miktar ve durum gerekli',
      });
      return;
    }

    await client.query('BEGIN');

    // Get item details
    const itemResult = await client.query(
      `SELECT * FROM rma_items WHERE item_id = $1`,
      [item_id]
    );

    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'RMA kalemi bulunamadı',
      });
      return;
    }

    const item = itemResult.rows[0];

    // Create receipt record
    await client.query(
      `INSERT INTO return_receipts
        (rma_id, item_id, product_sku, quantity_received, condition, location_id, received_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        item.rma_id,
        item_id,
        item.product_sku,
        quantity_received,
        condition,
        location_id || null,
        req.user?.username || 'system',
        notes || null,
      ]
    );

    // Update item quantities
    await client.query(
      `UPDATE rma_items
       SET quantity_received = quantity_received + $1,
           condition = $2,
           updated_at = CURRENT_TIMESTAMP
       WHERE item_id = $3`,
      [quantity_received, condition, item_id]
    );

    // Update RMA status to IN_PROCESS if not already
    await client.query(
      `UPDATE rma_requests
       SET status = 'IN_PROCESS'
       WHERE rma_id = $1 AND status = 'APPROVED'`,
      [item.rma_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'İade alındı',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Receive return error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Complete RMA
 */
export const completeRMA = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { rma_id } = req.params;
    const { notes } = req.body;

    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE rma_requests
       SET status = 'COMPLETED',
           completed_date = CURRENT_TIMESTAMP,
           internal_notes = COALESCE(internal_notes || E'\\n\\n', '') || $2
       WHERE rma_id = $1 AND status != 'COMPLETED'
       RETURNING *`,
      [rma_id, notes || 'Tamamlandı']
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'RMA bulunamadı veya zaten tamamlanmış',
      });
      return;
    }

    await client.query(
      `INSERT INTO rma_history (rma_id, action, new_status, performed_by, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [rma_id, 'COMPLETED', 'COMPLETED', req.user?.username || 'system', notes]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: result.rows[0],
      message: 'RMA tamamlandı',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Complete RMA error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};
