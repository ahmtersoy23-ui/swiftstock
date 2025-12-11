// ============================================
// REPORT CONTROLLER
// ============================================

import { Response } from 'express';
import pool from '../config/database';
import { AuthRequest } from '../middleware/auth.middleware';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants';

/**
 * Save count report from Operations page
 * Stores the complete count results with location and item details
 */
export const saveCountReport = async (req: AuthRequest, res: Response) => {
  const client = await pool.connect();
  try {
    const {
      warehouse_id,
      warehouse_code,
      locations, // Array of CountLocationResult
      notes,
    } = req.body;

    if (!warehouse_id || !warehouse_code || !locations || locations.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'warehouse_id, warehouse_code ve locations gerekli',
      });
      return;
    }

    await client.query('BEGIN');

    // Calculate totals
    let totalExpected = 0;
    let totalCounted = 0;
    locations.forEach((loc: any) => {
      totalExpected += loc.totalExpected || 0;
      totalCounted += loc.totalCounted || 0;
    });
    const totalVariance = totalCounted - totalExpected;
    const variancePct = totalExpected > 0 ? ((totalVariance / totalExpected) * 100).toFixed(2) : '0.00';

    // Generate report number: SAY-YYYYMMDD-XXXX
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM count_reports WHERE report_date = CURRENT_DATE`
    );
    const nextNum = parseInt(countResult.rows[0].count) + 1;
    const reportNumber = `SAY-${today}-${String(nextNum).padStart(4, '0')}`;

    // Create report
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
        req.user?.username || 'system',
        notes || null,
      ]
    );

    const report = reportResult.rows[0];

    // Add location details
    for (const loc of locations) {
      const locResult = await client.query(
        `INSERT INTO count_report_locations
          (report_id, location_id, location_code, location_qr, total_expected, total_counted,
           total_variance, unexpected_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING report_location_id`,
        [
          report.report_id,
          loc.location?.location_id || null,
          loc.location?.location_code || loc.location?.qr_code || 'Unknown',
          loc.location?.qr_code || null,
          loc.totalExpected || 0,
          loc.totalCounted || 0,
          loc.totalVariance || 0,
          loc.unexpectedItems?.length || 0,
        ]
      );

      const reportLocationId = locResult.rows[0].report_location_id;

      // Add expected items
      if (loc.items && Array.isArray(loc.items)) {
        for (const item of loc.items) {
          await client.query(
            `INSERT INTO count_report_items
              (report_id, report_location_id, sku_code, product_name, expected_quantity,
               counted_quantity, variance, is_unexpected, scanned_barcodes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              report.report_id,
              reportLocationId,
              item.sku_code,
              item.product_name || null,
              item.expected_quantity || 0,
              item.counted_quantity || 0,
              item.variance || 0,
              false,
              item.scanned_barcodes || [],
            ]
          );
        }
      }

      // Add unexpected items
      if (loc.unexpectedItems && Array.isArray(loc.unexpectedItems)) {
        for (const item of loc.unexpectedItems) {
          await client.query(
            `INSERT INTO count_report_items
              (report_id, report_location_id, sku_code, product_name, expected_quantity,
               counted_quantity, variance, is_unexpected, scanned_barcodes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              report.report_id,
              reportLocationId,
              item.sku_code,
              item.product_name || null,
              0, // unexpected items have no expected quantity
              item.counted_quantity || 0,
              item.counted_quantity || 0, // variance = counted for unexpected
              true,
              item.scanned_barcodes || [],
            ]
          );
        }
      }
    }

    await client.query('COMMIT');

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: {
        report_id: report.report_id,
        report_number: reportNumber,
        report_date: report.report_date,
        total_locations: locations.length,
        total_expected: totalExpected,
        total_counted: totalCounted,
        total_variance: totalVariance,
        variance_percentage: variancePct,
      },
      message: `Sayım raporu kaydedildi: ${reportNumber}`,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Save count report error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Get all count reports
 */
export const getAllCountReports = async (req: AuthRequest, res: Response) => {
  try {
    const { warehouse_id, start_date, end_date, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        cr.*,
        w.name as warehouse_name
      FROM count_reports cr
      JOIN warehouses w ON cr.warehouse_id = w.warehouse_id
      WHERE 1=1
    `;
    const params: any[] = [];
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

    query += `
      ORDER BY cr.report_date DESC, cr.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count for pagination
    let countQuery = `SELECT COUNT(*) as total FROM count_reports cr WHERE 1=1`;
    const countParams: any[] = [];
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

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        limit: Number(limit),
        offset: Number(offset),
        total: parseInt(countResult.rows[0].total),
      },
    });
  } catch (error) {
    console.error('Get count reports error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Get count report by ID with full details
 */
export const getCountReportById = async (req: AuthRequest, res: Response) => {
  try {
    const { report_id } = req.params;

    // Get report
    const reportResult = await pool.query(
      `SELECT cr.*, w.name as warehouse_name
       FROM count_reports cr
       JOIN warehouses w ON cr.warehouse_id = w.warehouse_id
       WHERE cr.report_id = $1`,
      [report_id]
    );

    if (reportResult.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Rapor bulunamadı',
      });
      return;
    }

    // Get locations
    const locationsResult = await pool.query(
      `SELECT * FROM count_report_locations
       WHERE report_id = $1
       ORDER BY report_location_id`,
      [report_id]
    );

    // Get items for each location
    const locationsWithItems = await Promise.all(
      locationsResult.rows.map(async (loc) => {
        const itemsResult = await pool.query(
          `SELECT * FROM count_report_items
           WHERE report_location_id = $1
           ORDER BY is_unexpected, sku_code`,
          [loc.report_location_id]
        );
        return {
          ...loc,
          items: itemsResult.rows.filter((i) => !i.is_unexpected),
          unexpectedItems: itemsResult.rows.filter((i) => i.is_unexpected),
        };
      })
    );

    res.json({
      success: true,
      data: {
        report: reportResult.rows[0],
        locations: locationsWithItems,
      },
    });
  } catch (error) {
    console.error('Get count report error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Get inventory report by warehouse
 * Returns current stock for all products in a warehouse
 */
export const getInventoryReport = async (req: AuthRequest, res: Response) => {
  try {
    const { warehouse_id } = req.params;
    const { group_by = 'product' } = req.query;

    if (!warehouse_id) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'warehouse_id gerekli',
      });
      return;
    }

    // Verify warehouse exists
    const warehouseResult = await pool.query(
      `SELECT * FROM warehouses WHERE warehouse_id = $1`,
      [warehouse_id]
    );

    if (warehouseResult.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Depo bulunamadı',
      });
      return;
    }

    const warehouse = warehouseResult.rows[0];

    let query: string;

    if (group_by === 'location') {
      // Group by location
      query = `
        SELECT
          l.location_id,
          l.location_code,
          l.qr_code,
          p.sku_code,
          p.product_name,
          p.barcode,
          COALESCE(i.quantity_on_hand, 0) as quantity,
          p.units_per_box,
          p.boxes_per_pallet
        FROM inventory i
        JOIN products p ON i.sku_code = p.sku_code
        LEFT JOIN locations l ON i.location_id = l.location_id
        WHERE i.warehouse_id = $1 AND i.quantity_on_hand > 0
        ORDER BY l.location_code NULLS LAST, p.product_name
      `;
    } else {
      // Group by product (default)
      query = `
        SELECT
          p.sku_code,
          p.product_name,
          p.barcode,
          SUM(COALESCE(i.quantity_on_hand, 0)) as quantity,
          p.units_per_box,
          p.boxes_per_pallet,
          COUNT(DISTINCT i.location_id) as location_count
        FROM products p
        LEFT JOIN inventory i ON p.sku_code = i.sku_code AND i.warehouse_id = $1
        WHERE i.quantity_on_hand > 0 OR i.quantity_on_hand IS NULL
        GROUP BY p.sku_code, p.product_name, p.barcode, p.units_per_box, p.boxes_per_pallet
        HAVING SUM(COALESCE(i.quantity_on_hand, 0)) > 0
        ORDER BY p.product_name
      `;
    }

    const result = await pool.query(query, [warehouse_id]);

    // Calculate totals
    const totalQuantity = result.rows.reduce((sum, row) => sum + parseInt(row.quantity || 0), 0);
    const totalProducts = group_by === 'location'
      ? new Set(result.rows.map(r => r.sku_code)).size
      : result.rows.length;

    res.json({
      success: true,
      data: {
        warehouse: {
          warehouse_id: warehouse.warehouse_id,
          code: warehouse.code,
          name: warehouse.name,
        },
        report_date: new Date().toISOString().slice(0, 10),
        summary: {
          total_products: totalProducts,
          total_quantity: totalQuantity,
          total_items: result.rows.length,
        },
        items: result.rows,
      },
    });
  } catch (error) {
    console.error('Get inventory report error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Delete count report
 */
export const deleteCountReport = async (req: AuthRequest, res: Response) => {
  try {
    const { report_id } = req.params;

    const result = await pool.query(
      `DELETE FROM count_reports WHERE report_id = $1 RETURNING *`,
      [report_id]
    );

    if (result.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Rapor bulunamadı',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Rapor silindi',
    });
  } catch (error) {
    console.error('Delete count report error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};
