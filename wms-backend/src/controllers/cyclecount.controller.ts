// ============================================
// CYCLE COUNT CONTROLLER
// ============================================

import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants';

/**
 * Get all cycle count sessions
 */
export const getAllSessions = async (req: AuthRequest, res: Response) => {
  try {
    const { warehouse_id, status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        s.*,
        w.name as warehouse_name,
        w.code as warehouse_code,
        COUNT(DISTINCT i.item_id) as total_items,
        COUNT(DISTINCT CASE WHEN i.status = 'COUNTED' THEN i.item_id END) as counted_items
      FROM cycle_count_sessions s
      JOIN warehouses w ON s.warehouse_id = w.warehouse_id
      LEFT JOIN cycle_count_items i ON s.session_id = i.session_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (warehouse_id) {
      query += ` AND s.warehouse_id = $${paramIndex++}`;
      params.push(warehouse_id);
    }

    if (status) {
      query += ` AND s.status = $${paramIndex++}`;
      params.push(status);
    }

    query += `
      GROUP BY s.session_id, w.name, w.code
      ORDER BY s.created_at DESC
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
    console.error('Get cycle count sessions error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Get cycle count session by ID
 */
export const getSessionById = async (req: AuthRequest, res: Response) => {
  try {
    const { session_id } = req.params;

    const sessionResult = await pool.query(
      `SELECT
        s.*,
        w.name as warehouse_name,
        w.code as warehouse_code
      FROM cycle_count_sessions s
      JOIN warehouses w ON s.warehouse_id = w.warehouse_id
      WHERE s.session_id = $1`,
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Sayım oturumu bulunamadı',
      });
      return;
    }

    const itemsResult = await pool.query(
      `SELECT
        i.*,
        p.product_name,
        l.location_code
      FROM cycle_count_items i
      JOIN products p ON i.sku_code = p.sku_code
      LEFT JOIN locations l ON i.location_id = l.location_id
      WHERE i.session_id = $1
      ORDER BY i.created_at ASC`,
      [session_id]
    );

    res.json({
      success: true,
      data: {
        session: sessionResult.rows[0],
        items: itemsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get cycle count session error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Create new cycle count session
 */
export const createSession = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      warehouse_id,
      count_type,
      scheduled_date,
      assigned_to,
      notes,
      items, // Array of { sku_code, location_id?, expected_quantity? }
    } = req.body;

    if (!warehouse_id || !count_type) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: ERROR_MESSAGES.INVALID_REQUEST,
      });
      return;
    }

    await client.query('BEGIN');

    // Generate session number
    const sessionNumber = `CC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

    // Create session
    const sessionResult = await client.query(
      `INSERT INTO cycle_count_sessions
        (session_number, warehouse_id, status, count_type, scheduled_date, assigned_to, notes, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        sessionNumber,
        warehouse_id,
        'PLANNED',
        count_type,
        scheduled_date || null,
        assigned_to || null,
        notes || null,
        req.user?.username || 'system',
      ]
    );

    const session = sessionResult.rows[0];

    // Add items to session if provided
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        // Get current quantity from inventory
        const invResult = await client.query(
          `SELECT quantity_on_hand FROM inventory
           WHERE sku_code = $1 AND warehouse_id = $2`,
          [item.sku_code, warehouse_id]
        );

        const expectedQty = item.expected_quantity ?? invResult.rows[0]?.quantity_on_hand ?? 0;

        await client.query(
          `INSERT INTO cycle_count_items
            (session_id, sku_code, location_id, expected_quantity, status)
          VALUES ($1, $2, $3, $4, $5)`,
          [session.session_id, item.sku_code, item.location_id || null, expectedQty, 'PENDING']
        );
      }
    }

    await client.query('COMMIT');

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: session,
      message: 'Sayım oturumu oluşturuldu',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Create cycle count session error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Start cycle count session
 */
export const startSession = async (req: AuthRequest, res: Response) => {
  try {
    const { session_id } = req.params;

    const result = await pool.query(
      `UPDATE cycle_count_sessions
       SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP
       WHERE session_id = $1 AND status = 'PLANNED'
       RETURNING *`,
      [session_id]
    );

    if (result.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Sayım oturumu bulunamadı veya zaten başlatılmış',
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Sayım başlatıldı',
    });
  } catch (error) {
    console.error('Start cycle count error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Record count for an item
 */
export const recordCount = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { item_id } = req.params;
    const { counted_quantity, notes } = req.body;

    if (counted_quantity === undefined || counted_quantity === null) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Sayılan miktar gerekli',
      });
      return;
    }

    await client.query('BEGIN');

    // Get item details
    const itemResult = await client.query(
      `SELECT * FROM cycle_count_items WHERE item_id = $1`,
      [item_id]
    );

    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Sayım kalemi bulunamadı',
      });
      return;
    }

    const item = itemResult.rows[0];
    const variance = counted_quantity - (item.expected_quantity || 0);
    const variancePct =
      item.expected_quantity > 0 ? ((variance / item.expected_quantity) * 100).toFixed(2) : '0.00';

    // Update item
    const updateResult = await client.query(
      `UPDATE cycle_count_items
       SET counted_quantity = $1,
           variance = $2,
           variance_percentage = $3,
           status = 'COUNTED',
           counted_by = $4,
           counted_at = CURRENT_TIMESTAMP,
           notes = $5
       WHERE item_id = $6
       RETURNING *`,
      [counted_quantity, variance, variancePct, req.user?.username || 'system', notes || null, item_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: updateResult.rows[0],
      message: 'Sayım kaydedildi',
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Record count error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Complete cycle count session and create adjustments
 */
export const completeSession = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const { session_id } = req.params;
    const { auto_adjust = false } = req.body;

    await client.query('BEGIN');

    // Get session
    const sessionResult = await client.query(
      `SELECT * FROM cycle_count_sessions WHERE session_id = $1`,
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Sayım oturumu bulunamadı',
      });
      return;
    }

    // Get all counted items with variance
    const itemsResult = await client.query(
      `SELECT * FROM cycle_count_items
       WHERE session_id = $1 AND status = 'COUNTED' AND variance != 0`,
      [session_id]
    );

    // Create adjustment records
    for (const item of itemsResult.rows) {
      const adjustmentType = item.variance > 0 ? 'INCREASE' : 'DECREASE';

      await client.query(
        `INSERT INTO cycle_count_adjustments
          (item_id, session_id, sku_code, location_id, old_quantity, new_quantity, variance, adjustment_type, adjusted_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          item.item_id,
          session_id,
          item.sku_code,
          item.location_id,
          item.expected_quantity,
          item.counted_quantity,
          item.variance,
          adjustmentType,
          req.user?.username || 'system',
        ]
      );

      // If auto_adjust is true, update inventory
      if (auto_adjust) {
        await client.query(
          `UPDATE inventory
           SET quantity_on_hand = $1, updated_at = CURRENT_TIMESTAMP
           WHERE sku_code = $2 AND warehouse_id = (SELECT warehouse_id FROM cycle_count_sessions WHERE session_id = $3)`,
          [item.counted_quantity, item.sku_code, session_id]
        );

        await client.query(
          `UPDATE cycle_count_items SET status = 'ADJUSTED' WHERE item_id = $1`,
          [item.item_id]
        );
      }
    }

    // Update session status
    await client.query(
      `UPDATE cycle_count_sessions
       SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
       WHERE session_id = $1`,
      [session_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Sayım tamamlandı. ${itemsResult.rows.length} fark kaydı oluşturuldu${auto_adjust ? ' ve envanter güncellendi' : ''}`,
      data: {
        adjustments_count: itemsResult.rows.length,
        auto_adjusted: auto_adjust,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Complete cycle count error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};
