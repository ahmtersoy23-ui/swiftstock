// ============================================
// SERIAL SERVICE — Module 1 (Catalog)
// Seri numarası iş mantığı. Controller sadece req/res yönetir.
// Tablolar: serial_numbers, serial_history, serial_counters
// ============================================

import pool from '../../../config/database';
import logger from '../../../config/logger';

// ── Domain Error ──────────────────────────────────────────────────────────────

export class CatalogError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'CatalogError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SerialFilters {
  status?: string;
  limit?: string | number;
  offset?: string | number;
}

export interface UpdateSerialInput {
  status: string;
  warehouse_id?: number | null;
  location_id?: number | null;
  transaction_id?: number | null;
}

export interface SerialHistoryOptions {
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

// ── Utility (exported — used by scan.service) ──────────────────────────────

export const parseSerialBarcode = (
  barcode: string,
): { sku_code: string; serial_no: string } | null => {
  // Format: SKU-SERIAL (e.g., IWA-12345-000001)
  // Last 6 characters after final dash are serial number
  const lastDashIndex = barcode.lastIndexOf('-');
  if (lastDashIndex === -1) return null;

  const potentialSerial = barcode.substring(lastDashIndex + 1);
  if (!/^\d{6}$/.test(potentialSerial)) return null;

  return {
    sku_code: barcode.substring(0, lastDashIndex),
    serial_no: potentialSerial,
  };
};

// ── Service ───────────────────────────────────────────────────────────────────

class SerialService {
  async generateSerialNumbers(product_sku: string, quantity: number) {
    const productCheck = await pool.query(
      'SELECT product_sku, product_name FROM products WHERE product_sku = $1',
      [product_sku],
    );

    if (productCheck.rows.length === 0) {
      throw new CatalogError(404, 'Product not found');
    }

    const product = productCheck.rows[0];
    const generatedSerials: Array<{ serial_no: string; full_barcode: string }> = [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (let i = 0; i < quantity; i++) {
        const serialResult = await client.query(
          'SELECT get_next_serial($1) as serial_no',
          [product_sku],
        );
        const serial_no = serialResult.rows[0].serial_no;
        const full_barcode = `${product_sku}-${serial_no}`;

        const insertResult = await client.query(
          `INSERT INTO serial_numbers (product_sku, serial_no, full_barcode, status)
           VALUES ($1, $2, $3, 'AVAILABLE')
           RETURNING serial_no, full_barcode`,
          [product_sku, serial_no, full_barcode],
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

    return {
      product_name: product.product_name,
      sku_code: product_sku,
      count: generatedSerials.length,
      serials: generatedSerials,
    };
  }

  async getSerialNumbers(product_sku: string, filters: SerialFilters) {
    const { status, limit = 100, offset = 0 } = filters;

    let query = `
      SELECT sn.*, p.product_name, w.code as warehouse_code, l.qr_code as location_code
      FROM serial_numbers sn
      JOIN products p ON p.product_sku = sn.sku_code
      LEFT JOIN wms_warehouses w ON w.warehouse_id = sn.warehouse_id
      LEFT JOIN wms_locations l ON l.location_id = sn.location_id
      WHERE sn.product_sku = $1
    `;
    const params: (string | number | boolean | null)[] = [product_sku];

    if (status) {
      query += ` AND sn.status = $${params.length + 1}`;
      params.push(status);
    }

    query += ` ORDER BY sn.serial_id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit as string | number, offset as string | number);

    const result = await pool.query(query, params);

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM serial_numbers WHERE product_sku = $1 ${status ? 'AND status = $2' : ''}`,
      status ? [product_sku, status] : [product_sku],
    );

    return {
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: Number(limit),
        offset: Number(offset),
      },
    };
  }

  async lookupSerialBarcode(barcode: string) {
    const result = await pool.query(
      `SELECT sn.*, p.product_name, p.base_unit, p.units_per_box,
              w.code as warehouse_code, l.qr_code as location_code
       FROM serial_numbers sn
       JOIN products p ON p.product_sku = sn.sku_code
       LEFT JOIN wms_warehouses w ON w.warehouse_id = sn.warehouse_id
       LEFT JOIN wms_locations l ON l.location_id = sn.location_id
       WHERE sn.full_barcode = $1`,
      [barcode],
    );

    if (result.rows.length === 0) {
      throw new CatalogError(404, 'Serial number not found');
    }

    return result.rows[0];
  }

  async updateSerialStatus(barcode: string, data: UpdateSerialInput) {
    const { status, warehouse_id, location_id, transaction_id } = data;

    const result = await pool.query(
      `UPDATE serial_numbers
       SET status = $1,
           warehouse_id = $2,
           location_id = $3,
           last_transaction_id = $4,
           last_scanned_at = CURRENT_TIMESTAMP
       WHERE full_barcode = $5
       RETURNING *`,
      [status, warehouse_id ?? null, location_id ?? null, transaction_id ?? null, barcode],
    );

    if (result.rows.length === 0) {
      throw new CatalogError(404, 'Serial number not found');
    }

    return result.rows[0];
  }

  async getSerialStats(product_sku: string) {
    const result = await pool.query(
      `SELECT status, COUNT(*) as count
       FROM serial_numbers
       WHERE product_sku = $1
       GROUP BY status`,
      [product_sku],
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

    return stats;
  }

  async getSerialHistory(barcode: string) {
    const serialResult = await pool.query(
      `SELECT sn.*, p.product_name
       FROM serial_numbers sn
       JOIN products p ON p.product_sku = sn.sku_code
       WHERE sn.full_barcode = $1`,
      [barcode],
    );

    if (serialResult.rows.length === 0) {
      throw new CatalogError(404, 'Serial number not found');
    }

    const serialInfo = serialResult.rows[0];

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
      [barcode],
    );

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
      [serialInfo.sku_code],
    );

    return {
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
    };
  }

  async addSerialHistoryEntry(
    serial_id: number,
    full_barcode: string,
    event_type: string,
    options: SerialHistoryOptions,
  ) {
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
          options.from_status ?? null,
          options.to_status ?? null,
          options.from_location_id ?? null,
          options.to_location_id ?? null,
          options.from_warehouse_id ?? null,
          options.to_warehouse_id ?? null,
          options.session_id ?? null,
          options.transaction_id ?? null,
          options.user_id ?? null,
          options.notes ?? null,
        ],
      );
      return true;
    } catch (error) {
      logger.error('Failed to add serial history entry:', error);
      return false;
    }
  }
}

export const serialService = new SerialService();
export default serialService;
