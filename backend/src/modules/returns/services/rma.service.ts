// ============================================
// RMA SERVICE — Module 7
// İade Yönetimi iş mantığı. Controller sadece req/res yönetir,
// tüm business logic burada.
// Tablolar: wms_rma_requests, wms_rma_items, wms_rma_history, return_receipts
// Coupling: 3/10 — ikinci en kolay modül
// ============================================

import pool from '../../../config/database';

// ── Domain Error ──────────────────────────────────────────────────────────────

export class RmaError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'RmaError';
  }
}

// ── Input Types ───────────────────────────────────────────────────────────────

export interface RMAFilters {
  warehouse_id?: string;
  status?: string;
  limit?: string | number;
  offset?: string | number;
}

export interface RMAItem {
  product_sku: string;
  quantity_requested: number;
  unit_price?: number;
  action: string;
}

export interface CreateRMAInput {
  warehouse_id: string | number;
  customer_name?: string;
  customer_email?: string;
  order_number?: string;
  reason: string;
  priority?: string;
  notes?: string;
  items: RMAItem[];
}

export interface ReceiveReturnInput {
  quantity_received: number;
  condition: string;
  location_id?: string | number;
  notes?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

class RmaService {
  async getAllRMAs(filters: RMAFilters) {
    const { warehouse_id, status, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        r.*,
        w.name as warehouse_name,
        w.code as warehouse_code,
        COUNT(DISTINCT i.item_id) as total_items,
        SUM(i.quantity_requested) as total_quantity
      FROM wms_rma_requests r
      JOIN wms_warehouses w ON r.warehouse_id = w.warehouse_id
      LEFT JOIN wms_rma_items i ON r.rma_id = i.rma_id
      WHERE 1=1
    `;
    const params: (string | number | null)[] = [];
    let paramIndex = 1;

    if (warehouse_id) {
      query += ` AND r.warehouse_id = $${paramIndex++}`;
      params.push(warehouse_id as string);
    }

    if (status) {
      query += ` AND r.status = $${paramIndex++}`;
      params.push(status as string);
    }

    query += `
      GROUP BY r.rma_id, w.name, w.code
      ORDER BY r.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    return {
      data: result.rows,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: result.rows.length,
      },
    };
  }

  async getRMAById(rmaId: string) {
    const rmaResult = await pool.query(
      `SELECT r.*, w.name as warehouse_name, w.code as warehouse_code
       FROM wms_rma_requests r
       JOIN wms_warehouses w ON r.warehouse_id = w.warehouse_id
       WHERE r.rma_id = $1`,
      [rmaId],
    );

    if (rmaResult.rows.length === 0) {
      throw new RmaError(404, 'RMA bulunamadı');
    }

    const itemsResult = await pool.query(
      `SELECT i.*, p.name AS product_name
       FROM wms_rma_items i
       JOIN products p ON i.product_sku = p.product_sku
       WHERE i.rma_id = $1`,
      [rmaId],
    );

    const historyResult = await pool.query(
      'SELECT * FROM wms_rma_history WHERE rma_id = $1 ORDER BY created_at DESC',
      [rmaId],
    );

    return {
      rma: rmaResult.rows[0],
      items: itemsResult.rows,
      history: historyResult.rows,
    };
  }

  async createRMA(data: CreateRMAInput, performedBy: string) {
    const {
      warehouse_id,
      customer_name,
      customer_email,
      order_number,
      reason,
      priority,
      notes,
      items,
    } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const rmaNumber = `RMA-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

      const rmaResult = await client.query(
        `INSERT INTO wms_rma_requests
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
          performedBy,
        ],
      );

      const rma = rmaResult.rows[0];

      const valuesClauses: string[] = [];
      const insertParams: (string | number | null)[] = [];
      items.forEach((item, idx) => {
        const base = idx * 5;
        valuesClauses.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`);
        insertParams.push(
          rma.rma_id,
          item.product_sku,
          item.quantity_requested,
          item.unit_price ?? null,
          item.action,
        );
      });
      await client.query(
        `INSERT INTO wms_rma_items (rma_id, product_sku, quantity_requested, unit_price, action)
         VALUES ${valuesClauses.join(', ')}`,
        insertParams,
      );

      await client.query(
        `INSERT INTO wms_rma_history (rma_id, action, new_status, performed_by)
         VALUES ($1, $2, $3, $4)`,
        [rma.rma_id, 'CREATED', 'PENDING', performedBy],
      );

      await client.query('COMMIT');
      return rma;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async approveRMA(rmaId: string, notes: string | undefined, performedBy: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE wms_rma_requests
         SET status = 'APPROVED',
             approved_date = CURRENT_TIMESTAMP,
             approved_by = $2,
             internal_notes = COALESCE(internal_notes || E'\\n\\n', '') || $3
         WHERE rma_id = $1 AND status = 'PENDING'
         RETURNING *`,
        [rmaId, performedBy, notes || 'Onaylandı'],
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new RmaError(404, 'RMA bulunamadı veya zaten onaylanmış');
      }

      await client.query(
        `INSERT INTO wms_rma_history (rma_id, action, old_status, new_status, performed_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [rmaId, 'APPROVED', 'PENDING', 'APPROVED', performedBy, notes],
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async receiveReturn(itemId: string, data: ReceiveReturnInput, performedBy: string) {
    const { quantity_received, condition, location_id, notes } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const itemResult = await client.query(
        'SELECT * FROM wms_rma_items WHERE item_id = $1',
        [itemId],
      );

      if (itemResult.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new RmaError(404, 'RMA kalemi bulunamadı');
      }

      const item = itemResult.rows[0];

      await client.query(
        `INSERT INTO return_receipts
          (rma_id, item_id, product_sku, quantity_received, condition, location_id, received_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          item.rma_id,
          itemId,
          item.product_sku,
          quantity_received,
          condition,
          location_id ?? null,
          performedBy,
          notes ?? null,
        ],
      );

      await client.query(
        `UPDATE wms_rma_items
         SET quantity_received = quantity_received + $1,
             condition = $2,
             updated_at = CURRENT_TIMESTAMP
         WHERE item_id = $3`,
        [quantity_received, condition, itemId],
      );

      await client.query(
        `UPDATE wms_rma_requests
         SET status = 'IN_PROCESS'
         WHERE rma_id = $1 AND status = 'APPROVED'`,
        [item.rma_id],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async completeRMA(rmaId: string, notes: string | undefined, performedBy: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE wms_rma_requests
         SET status = 'COMPLETED',
             completed_date = CURRENT_TIMESTAMP,
             internal_notes = COALESCE(internal_notes || E'\\n\\n', '') || $2
         WHERE rma_id = $1 AND status != 'COMPLETED'
         RETURNING *`,
        [rmaId, notes || 'Tamamlandı'],
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        throw new RmaError(404, 'RMA bulunamadı veya zaten tamamlanmış');
      }

      await client.query(
        `INSERT INTO wms_rma_history (rma_id, action, new_status, performed_by, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [rmaId, 'COMPLETED', 'COMPLETED', performedBy, notes],
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const rmaService = new RmaService();

// Re-export for module barrel
export default rmaService;
