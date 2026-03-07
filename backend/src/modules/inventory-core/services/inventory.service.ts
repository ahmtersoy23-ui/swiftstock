// ============================================
// INVENTORY SERVICE — Module 4 (Inventory Core)
// Inventory sorgulama ve stok ayarlama iş mantığı.
// HTTP ve event listener (cyclecount:completed) tarafından kullanılır.
// Tablolar: wms_inventory, v_inventory_summary
// Coupling: 2/10 — düşük
// ============================================

import pool from '../../../config/database';
import logger from '../../../config/logger';

// ── Domain Error ──────────────────────────────────────────────────────────────

export class InventoryError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'InventoryError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InventorySummaryFilters {
  warehouse_code?: string;
  page?: string | number;
  limit?: string | number;
}

export interface LowStockFilters {
  warehouse_code?: string;
  threshold?: string | number;
  page?: string | number;
  limit?: string | number;
}

export interface StockAdjustment {
  productSku: string;
  warehouseId: number;
  locationId: number;
  delta: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

class InventoryService {
  async getInventorySummary(filters: InventorySummaryFilters) {
    const { warehouse_code } = filters;
    const pageNum = Math.max(1, parseInt(String(filters.page ?? '1')) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(String(filters.limit ?? '50')) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = '';
    const params: (string | number | boolean | null)[] = [];
    if (warehouse_code) {
      whereClause = ' WHERE warehouse_code = $1';
      params.push(warehouse_code as string);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM v_inventory_summary${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT * FROM v_inventory_summary${whereClause}
       ORDER BY warehouse_code, product_name
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limitNum, offset],
    );

    return {
      data: result.rows,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    };
  }

  async getInventoryBySku(product_sku: string) {
    const result = await pool.query(
      `SELECT
         i.*,
         p.name AS product_name,
         w.code as warehouse_code, w.name as warehouse_name,
         l.qr_code as location_code
       FROM wms_inventory i
       JOIN products p ON i.product_sku = p.product_sku
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       LEFT JOIN wms_locations l ON i.location_id = l.location_id
       WHERE i.product_sku = $1 AND i.quantity > 0
       ORDER BY w.code`,
      [product_sku],
    );

    if (result.rows.length === 0) {
      throw new InventoryError(404, 'No inventory found for this SKU');
    }

    const totalEach = result.rows.reduce((sum, row) => sum + row.quantity, 0);
    const units_per_box = 1;
    const boxes_per_pallet = 1;

    return {
      product_sku,
      product_name: result.rows[0].product_name,
      locations: result.rows,
      totals: {
        each: totalEach,
        boxes: Math.floor(totalEach / units_per_box),
        pallets: Math.floor(totalEach / (units_per_box * boxes_per_pallet)),
      },
    };
  }

  async getLowStock(filters: LowStockFilters) {
    const { warehouse_code } = filters;
    const threshold = filters.threshold ?? 10;
    const pageNum = Math.max(1, parseInt(String(filters.page ?? '1')) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(String(filters.limit ?? '50')) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = 'WHERE i.quantity <= $1 AND i.quantity > 0';
    const countParams: (string | number | boolean | null)[] = [threshold as string | number];

    if (warehouse_code) {
      whereClause += ' AND w.code = $2';
      countParams.push(warehouse_code as string);
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM wms_inventory i
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       ${whereClause}`,
      countParams,
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT
         i.*,
         p.name AS product_name,
         w.code as warehouse_code,
         l.qr_code as location_code
       FROM wms_inventory i
       JOIN products p ON i.product_sku = p.product_sku
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       LEFT JOIN wms_locations l ON i.location_id = l.location_id
       ${whereClause}
       ORDER BY i.quantity ASC
       LIMIT $${countParams.length + 1} OFFSET $${countParams.length + 2}`,
      [...countParams, limitNum, offset],
    );

    return {
      data: result.rows,
      pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) },
    };
  }

  async searchInventory(query: string, warehouse_code?: string) {
    let sql = `
      SELECT * FROM v_inventory_summary
      WHERE (
        LOWER(product_name) LIKE LOWER($1)
        OR LOWER(product_sku) LIKE LOWER($1)
      )
    `;
    const params: (string | number | boolean | null)[] = [`%${query}%`];

    if (warehouse_code) {
      sql += ' AND warehouse_code = $2';
      params.push(warehouse_code);
    }
    sql += ' ORDER BY product_name LIMIT 50';

    const result = await pool.query(sql, params);
    return result.rows;
  }

  // Called by cyclecount:completed event listener
  async adjustStock(adjustments: StockAdjustment[]): Promise<void> {
    if (adjustments.length === 0) return;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const adj of adjustments) {
        if (adj.delta === 0) continue;

        const existing = await client.query(
          `SELECT inventory_id FROM wms_inventory
           WHERE product_sku = $1 AND warehouse_id = $2 AND location_id = $3
           FOR UPDATE`,
          [adj.productSku, adj.warehouseId, adj.locationId],
        );

        if (existing.rows.length > 0) {
          await client.query(
            `UPDATE wms_inventory
             SET quantity = GREATEST(0, quantity + $1), last_updated_at = NOW()
             WHERE inventory_id = $2`,
            [adj.delta, existing.rows[0].inventory_id],
          );
        } else if (adj.delta > 0) {
          await client.query(
            `INSERT INTO wms_inventory (product_sku, warehouse_id, location_id, quantity)
             VALUES ($1, $2, $3, $4)`,
            [adj.productSku, adj.warehouseId, adj.locationId, adj.delta],
          );
        }
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('[InventoryService] adjustStock error:', error);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const inventoryService = new InventoryService();
