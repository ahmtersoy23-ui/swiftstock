// ============================================
// REPORT SERVICE — Module 5 (Quality)
// Count report iş mantığı.
// Tablolar: count_reports, count_report_locations, count_report_items
// Coupling: 3/10 — düşük (inventory READ)
// ============================================

import pool from '../../../config/database';

// ── Domain Error ──────────────────────────────────────────────────────────────

export class ReportError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ReportError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GetReportsFilters {
  warehouse_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: string | number;
  offset?: string | number;
}

export interface CountLocation {
  location?: {
    location_id?: string;
    location_code?: string;
    qr_code?: string;
  };
  totalExpected?: number;
  totalCounted?: number;
  totalVariance?: number;
  items?: Array<{
    product_sku: string;
    product_name?: string;
    expected_quantity?: number;
    counted_quantity?: number;
    variance?: number;
    scanned_barcodes?: string[];
  }>;
  unexpectedItems?: Array<{
    product_sku: string;
    product_name?: string;
    counted_quantity?: number;
    scanned_barcodes?: string[];
  }>;
}

export interface SaveCountReportInput {
  warehouse_id: number;
  warehouse_code: string;
  locations: CountLocation[];
  notes?: string;
  createdBy: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

class ReportService {
  async saveCountReport(data: SaveCountReportInput) {
    const { warehouse_id, warehouse_code, locations, notes, createdBy } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let totalExpected = 0;
      let totalCounted = 0;
      locations.forEach((loc) => {
        totalExpected += loc.totalExpected ?? 0;
        totalCounted += loc.totalCounted ?? 0;
      });
      const totalVariance = totalCounted - totalExpected;
      const variancePct =
        totalExpected > 0 ? ((totalVariance / totalExpected) * 100).toFixed(2) : '0.00';

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countResult = await client.query(
        `SELECT COUNT(*) as count FROM count_reports WHERE report_date = CURRENT_DATE`,
      );
      const nextNum = parseInt(countResult.rows[0].count) + 1;
      const reportNumber = `SAY-${today}-${String(nextNum).padStart(4, '0')}`;

      const reportResult = await client.query(
        `INSERT INTO count_reports
          (report_number, warehouse_id, warehouse_code, report_date, total_locations,
           total_expected, total_counted, total_variance, variance_percentage, created_by, notes)
         VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [
          reportNumber,
          warehouse_id,
          warehouse_code,
          locations.length,
          totalExpected,
          totalCounted,
          totalVariance,
          variancePct,
          createdBy,
          notes ?? null,
        ],
      );

      const report = reportResult.rows[0];

      if (locations.length > 0) {
        const locValuesClauses: string[] = [];
        const locParams: (string | number | boolean | null)[] = [];
        locations.forEach((loc, idx) => {
          const offset = idx * 8;
          locValuesClauses.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8})`,
          );
          locParams.push(
            report.report_id,
            (loc.location?.location_id as string) ?? null,
            (loc.location?.location_code as string) ?? (loc.location?.qr_code as string) ?? 'Unknown',
            (loc.location?.qr_code as string) ?? null,
            loc.totalExpected ?? 0,
            loc.totalCounted ?? 0,
            loc.totalVariance ?? 0,
            loc.unexpectedItems?.length ?? 0,
          );
        });

        const locInsertResult = await client.query(
          `INSERT INTO count_report_locations
            (report_id, location_id, location_code, location_qr, total_expected, total_counted,
             total_variance, unexpected_count)
           VALUES ${locValuesClauses.join(', ')}
           RETURNING report_location_id`,
          locParams,
        );

        const allItemValuesClauses: string[] = [];
        const allItemParams: (string | number | boolean | null | string[])[] = [];
        let itemParamOffset = 0;

        locations.forEach((loc, locIdx) => {
          const reportLocationId = locInsertResult.rows[locIdx].report_location_id;

          if (loc.items && Array.isArray(loc.items)) {
            for (const item of loc.items) {
              const offset = itemParamOffset * 9;
              allItemValuesClauses.push(
                `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`,
              );
              allItemParams.push(
                report.report_id,
                reportLocationId,
                item.product_sku,
                item.product_name ?? null,
                item.expected_quantity ?? 0,
                item.counted_quantity ?? 0,
                item.variance ?? 0,
                false,
                item.scanned_barcodes ?? [],
              );
              itemParamOffset++;
            }
          }

          if (loc.unexpectedItems && Array.isArray(loc.unexpectedItems)) {
            for (const item of loc.unexpectedItems) {
              const offset = itemParamOffset * 9;
              allItemValuesClauses.push(
                `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9})`,
              );
              allItemParams.push(
                report.report_id,
                reportLocationId,
                item.product_sku,
                item.product_name ?? null,
                0,
                item.counted_quantity ?? 0,
                item.counted_quantity ?? 0,
                true,
                item.scanned_barcodes ?? [],
              );
              itemParamOffset++;
            }
          }
        });

        if (allItemValuesClauses.length > 0) {
          await client.query(
            `INSERT INTO count_report_items
              (report_id, report_location_id, product_sku, product_name, expected_quantity,
               counted_quantity, variance, is_unexpected, scanned_barcodes)
             VALUES ${allItemValuesClauses.join(', ')}`,
            allItemParams,
          );
        }
      }

      await client.query('COMMIT');

      return {
        report_id: report.report_id,
        report_number: reportNumber,
        report_date: report.report_date,
        total_locations: locations.length,
        total_expected: totalExpected,
        total_counted: totalCounted,
        total_variance: totalVariance,
        variance_percentage: variancePct,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getAllCountReports(filters: GetReportsFilters) {
    const { warehouse_id, start_date, end_date, limit = 50, offset = 0 } = filters;

    let query = `
      SELECT cr.*, w.name as warehouse_name
      FROM count_reports cr
      JOIN wms_warehouses w ON cr.warehouse_id = w.warehouse_id
      WHERE 1=1
    `;
    const params: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (warehouse_id) {
      query += ` AND cr.warehouse_id = $${paramIndex++}`;
      params.push(warehouse_id);
    }
    if (start_date) {
      query += ` AND cr.report_date >= $${paramIndex++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND cr.report_date <= $${paramIndex++}`;
      params.push(end_date);
    }

    query += ` ORDER BY cr.report_date DESC, cr.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(Number(limit), Number(offset));

    const result = await pool.query(query, params);

    let countQuery = `SELECT COUNT(*) as total FROM count_reports cr WHERE 1=1`;
    const countParams: (string | number | boolean | null)[] = [];
    let countParamIndex = 1;

    if (warehouse_id) {
      countQuery += ` AND cr.warehouse_id = $${countParamIndex++}`;
      countParams.push(warehouse_id);
    }
    if (start_date) {
      countQuery += ` AND cr.report_date >= $${countParamIndex++}`;
      countParams.push(start_date);
    }
    if (end_date) {
      countQuery += ` AND cr.report_date <= $${countParamIndex++}`;
      countParams.push(end_date);
    }

    const countResult = await pool.query(countQuery, countParams);

    return {
      rows: result.rows,
      total: parseInt(countResult.rows[0].total),
      limit: Number(limit),
      offset: Number(offset),
    };
  }

  async getCountReportById(report_id: string) {
    const reportResult = await pool.query(
      `SELECT cr.*, w.name as warehouse_name
       FROM count_reports cr
       JOIN wms_warehouses w ON cr.warehouse_id = w.warehouse_id
       WHERE cr.report_id = $1`,
      [report_id],
    );

    if (reportResult.rows.length === 0) {
      throw new ReportError(404, 'Rapor bulunamadı');
    }

    const locationsResult = await pool.query(
      `SELECT * FROM count_report_locations WHERE report_id = $1 ORDER BY report_location_id`,
      [report_id],
    );

    const locationsWithItems = await Promise.all(
      locationsResult.rows.map(async (loc) => {
        const itemsResult = await pool.query(
          `SELECT * FROM count_report_items
           WHERE report_location_id = $1
           ORDER BY is_unexpected, sku_code`,
          [loc.report_location_id],
        );
        return {
          ...loc,
          items: itemsResult.rows.filter((i) => !i.is_unexpected),
          unexpectedItems: itemsResult.rows.filter((i) => i.is_unexpected),
        };
      }),
    );

    return { report: reportResult.rows[0], locations: locationsWithItems };
  }

  async getInventoryReport(warehouse_id: string, group_by: string = 'product') {
    const warehouseResult = await pool.query(
      `SELECT * FROM wms_warehouses WHERE warehouse_id = $1`,
      [warehouse_id],
    );

    if (warehouseResult.rows.length === 0) {
      throw new ReportError(404, 'Depo bulunamadı');
    }

    const warehouse = warehouseResult.rows[0];

    let query: string;

    if (group_by === 'location') {
      query = `
        SELECT
          l.location_id,
          l.location_code,
          l.qr_code,
          p.product_sku,
          p.product_name,
          p.barcode,
          COALESCE(i.quantity_on_hand, 0) as quantity,
          p.units_per_box,
          p.boxes_per_pallet
        FROM inventory i
        JOIN products p ON i.product_sku = p.sku_code
        LEFT JOIN wms_locations l ON i.location_id = l.location_id
        WHERE i.warehouse_id = $1 AND i.quantity_on_hand > 0
        ORDER BY l.location_code NULLS LAST, p.product_name
      `;
    } else {
      query = `
        SELECT
          p.product_sku,
          p.product_name,
          p.barcode,
          SUM(COALESCE(i.quantity_on_hand, 0)) as quantity,
          p.units_per_box,
          p.boxes_per_pallet,
          COUNT(DISTINCT i.location_id) as location_count
        FROM products p
        LEFT JOIN inventory i ON p.product_sku = i.sku_code AND i.warehouse_id = $1
        WHERE i.quantity_on_hand > 0
        GROUP BY p.product_sku, p.product_name, p.barcode, p.units_per_box, p.boxes_per_pallet
        HAVING SUM(COALESCE(i.quantity_on_hand, 0)) > 0
        ORDER BY p.product_name
      `;
    }

    const result = await pool.query(query, [warehouse_id]);

    const totalQuantity = result.rows.reduce(
      (sum, row) => sum + parseInt(row.quantity || 0),
      0,
    );
    const totalProducts =
      group_by === 'location'
        ? new Set(result.rows.map((r) => r.sku_code)).size
        : result.rows.length;

    return {
      warehouse: {
        warehouse_id: warehouse.warehouse_id,
        code: warehouse.code,
        name: warehouse.name,
      },
      report_date: new Date().toISOString().slice(0, 10),
      summary: { total_products: totalProducts, total_quantity: totalQuantity, total_items: result.rows.length },
      items: result.rows,
    };
  }

  async deleteCountReport(report_id: string) {
    const result = await pool.query(
      `DELETE FROM count_reports WHERE report_id = $1 RETURNING report_id`,
      [report_id],
    );

    if (result.rows.length === 0) {
      throw new ReportError(404, 'Rapor bulunamadı');
    }
  }
}

export const reportService = new ReportService();
export default reportService;
