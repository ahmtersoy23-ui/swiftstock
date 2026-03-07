// ============================================
// CYCLECOUNT SERVICE — Module 5 (Quality)
// Cycle count session iş mantığı.
// Tablolar: cycle_count_sessions, cycle_count_items, cycle_count_adjustments
// Coupling: 6/10 — orta (auto_adjust → eventBus ile decoupled)
// ============================================

import pool from '../../../config/database';
import { eventBus } from '../../shared/events/event-bus';

// ── Domain Error ──────────────────────────────────────────────────────────────

export class CycleCountError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'CycleCountError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GetSessionsFilters {
  warehouse_id?: string;
  status?: string;
  limit?: string | number;
  offset?: string | number;
}

export interface CreateSessionInput {
  warehouse_id: number;
  count_type: string;
  scheduled_date?: string;
  assigned_to?: string;
  notes?: string;
  items?: Array<{
    product_sku: string;
    location_id?: string | null;
    expected_quantity?: number;
  }>;
  createdBy: string;
}

export interface RecordCountInput {
  counted_quantity: number;
  notes?: string;
  countedBy: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

class CycleCountService {
  async getAllSessions(filters: GetSessionsFilters) {
    const { warehouse_id, status, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT
        s.*,
        w.name as warehouse_name,
        w.code as warehouse_code,
        COUNT(DISTINCT i.item_id) as total_items,
        COUNT(DISTINCT CASE WHEN i.status = 'COUNTED' THEN i.item_id END) as counted_items
      FROM cycle_count_sessions s
      JOIN wms_warehouses w ON s.warehouse_id = w.warehouse_id
      LEFT JOIN cycle_count_items i ON s.session_id = i.session_id
      WHERE 1=1
    `;
    const params: (string | number | boolean | null)[] = [];
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
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);
    return { rows: result.rows, limit: Number(limit), offset: Number(offset) };
  }

  async getSessionById(session_id: string) {
    const sessionResult = await pool.query(
      `SELECT
        s.*,
        w.name as warehouse_name,
        w.code as warehouse_code
       FROM cycle_count_sessions s
       JOIN wms_warehouses w ON s.warehouse_id = w.warehouse_id
       WHERE s.session_id = $1`,
      [session_id],
    );

    if (sessionResult.rows.length === 0) {
      throw new CycleCountError(404, 'Sayım oturumu bulunamadı');
    }

    const itemsResult = await pool.query(
      `SELECT
        i.*,
        p.product_name,
        l.location_code
       FROM cycle_count_items i
       JOIN products p ON i.product_sku = p.sku_code
       LEFT JOIN wms_locations l ON i.location_id = l.location_id
       WHERE i.session_id = $1
       ORDER BY i.created_at ASC`,
      [session_id],
    );

    return { session: sessionResult.rows[0], items: itemsResult.rows };
  }

  async createSession(data: CreateSessionInput) {
    const { warehouse_id, count_type, scheduled_date, assigned_to, notes, items, createdBy } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sessionNumber = `CC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;

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
          scheduled_date ?? null,
          assigned_to ?? null,
          notes ?? null,
          createdBy,
        ],
      );

      const session = sessionResult.rows[0];

      if (items && Array.isArray(items) && items.length > 0) {
        const skuList = items.map((item) => item.product_sku);
        const invResult = await client.query(
          `SELECT product_sku, quantity_on_hand FROM inventory
           WHERE product_sku = ANY($1) AND warehouse_id = $2`,
          [skuList, warehouse_id],
        );
        const invMap = new Map<string, number>();
        invResult.rows.forEach((row: { product_sku: string; quantity_on_hand: number }) => {
          invMap.set(row.product_sku, row.quantity_on_hand);
        });

        const valuesClauses: string[] = [];
        const insertParams: (string | number | boolean | null)[] = [];
        items.forEach((item, idx) => {
          const expectedQty = item.expected_quantity ?? invMap.get(item.product_sku) ?? 0;
          const offset = idx * 5;
          valuesClauses.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`,
          );
          insertParams.push(
            session.session_id,
            item.product_sku,
            item.location_id ?? null,
            expectedQty,
            'PENDING',
          );
        });

        await client.query(
          `INSERT INTO cycle_count_items
            (session_id, product_sku, location_id, expected_quantity, status)
           VALUES ${valuesClauses.join(', ')}`,
          insertParams,
        );
      }

      await client.query('COMMIT');
      return session;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async startSession(session_id: string) {
    const result = await pool.query(
      `UPDATE cycle_count_sessions
       SET status = 'IN_PROGRESS', started_at = CURRENT_TIMESTAMP
       WHERE session_id = $1 AND status = 'PLANNED'
       RETURNING *`,
      [session_id],
    );

    if (result.rows.length === 0) {
      throw new CycleCountError(404, 'Sayım oturumu bulunamadı veya zaten başlatılmış');
    }

    return result.rows[0];
  }

  async recordCount(item_id: string, data: RecordCountInput) {
    const { counted_quantity, notes, countedBy } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const itemResult = await client.query(
        `SELECT * FROM cycle_count_items WHERE item_id = $1`,
        [item_id],
      );

      if (itemResult.rows.length === 0) {
        throw new CycleCountError(404, 'Sayım kalemi bulunamadı');
      }

      const item = itemResult.rows[0];
      const variance = counted_quantity - (item.expected_quantity || 0);
      const variancePct =
        item.expected_quantity > 0
          ? ((variance / item.expected_quantity) * 100).toFixed(2)
          : '0.00';

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
        [counted_quantity, variance, variancePct, countedBy, notes ?? null, item_id],
      );

      await client.query('COMMIT');
      return updateResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async completeSession(
    session_id: string,
    auto_adjust: boolean,
    completedByUserId: number,
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const sessionResult = await client.query(
        `SELECT * FROM cycle_count_sessions WHERE session_id = $1`,
        [session_id],
      );

      if (sessionResult.rows.length === 0) {
        throw new CycleCountError(404, 'Sayım oturumu bulunamadı');
      }

      const session = sessionResult.rows[0];

      const itemsResult = await client.query(
        `SELECT * FROM cycle_count_items
         WHERE session_id = $1 AND status = 'COUNTED' AND variance != 0`,
        [session_id],
      );

      type AdjustmentRow = {
        productSku: string;
        locationId: number;
        systemQty: number;
        countedQty: number;
        delta: number;
      };
      let adjustments: AdjustmentRow[] = [];

      if (itemsResult.rows.length > 0) {
        // Batch insert adjustment records
        const adjustValuesClauses: string[] = [];
        const adjustParams: (string | number | boolean | null)[] = [];
        const adjustedBy = `user:${completedByUserId}`;

        itemsResult.rows.forEach((item: Record<string, unknown>, idx: number) => {
          const adjustmentType = (item.variance as number) > 0 ? 'INCREASE' : 'DECREASE';
          const offset = idx * 9;
          adjustValuesClauses.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`,
          );
          adjustParams.push(
            item.item_id as number,
            Number(session_id),
            item.product_sku as string,
            (item.location_id as number) ?? null,
            item.expected_quantity as number,
            item.counted_quantity as number,
            item.variance as number,
            adjustmentType,
            adjustedBy,
          );
        });

        await client.query(
          `INSERT INTO cycle_count_adjustments
            (item_id, session_id, product_sku, location_id, old_quantity, new_quantity, variance, adjustment_type, adjusted_by)
           VALUES ${adjustValuesClauses.join(', ')}`,
          adjustParams,
        );

        if (auto_adjust) {
          adjustments = itemsResult.rows.map((item: Record<string, unknown>) => ({
            productSku: item.product_sku as string,
            locationId: (item.location_id as number) ?? 0,
            systemQty: item.expected_quantity as number,
            countedQty: item.counted_quantity as number,
            delta: item.variance as number,
          }));

          const itemIds = itemsResult.rows.map((item: Record<string, unknown>) => item.item_id);
          await client.query(
            `UPDATE cycle_count_items SET status = 'ADJUSTED' WHERE item_id = ANY($1)`,
            [itemIds],
          );
        }
      }

      // Mark session COMPLETED
      await client.query(
        `UPDATE cycle_count_sessions
         SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP
         WHERE session_id = $1`,
        [session_id],
      );

      await client.query('COMMIT');

      // Emit AFTER commit — Modül 4 (Inventory Core) will apply inventory adjustments
      if (auto_adjust && adjustments.length > 0) {
        eventBus.emit('cyclecount:completed', {
          sessionId: Number(session_id),
          warehouseId: session.warehouse_id as number,
          adjustments,
          completedByUserId,
        });
      }

      return { adjustments_count: itemsResult.rows.length, auto_adjusted: auto_adjust };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const cycleCountService = new CycleCountService();
export default cycleCountService;
