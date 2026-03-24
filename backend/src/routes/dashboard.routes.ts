// ============================================
// DASHBOARD ROUTES — KPI & Stats
// ============================================

import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/database';
import logger from '../config/logger';

const router = Router();

router.get('/dashboard/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const warehouseCode = req.query.warehouse_code as string | undefined;

    // Build warehouse filter
    let whFilter = '';
    let whFilterTx = '';
    const params: (string | number)[] = [];
    if (warehouseCode) {
      whFilter = `AND w.code = $1`;
      whFilterTx = `AND t.warehouse_code = $1`;
      params.push(warehouseCode);
    }

    // 1. Today's transactions by type
    const todayTxResult = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN t.transaction_type = 'IN' THEN 1 ELSE 0 END), 0) AS today_in,
         COALESCE(SUM(CASE WHEN t.transaction_type = 'OUT' THEN 1 ELSE 0 END), 0) AS today_out,
         COALESCE(SUM(CASE WHEN t.transaction_type = 'TRANSFER' THEN 1 ELSE 0 END), 0) AS today_transfer,
         COALESCE(SUM(CASE WHEN t.transaction_type = 'ADJUST' THEN 1 ELSE 0 END), 0) AS today_adjust,
         COUNT(*) AS today_total
       FROM wms_transactions t
       WHERE t.created_at::date = CURRENT_DATE
       ${whFilterTx}`,
      params,
    );

    // 2. Pending orders
    const pendingOrdersResult = await pool.query(
      `SELECT COUNT(*) AS pending_orders
       FROM shipment_orders
       WHERE status IN ('PENDING', 'READY_TO_PICK', 'PICKING')`,
    );

    // 3. Active shipments
    const activeShipmentsResult = await pool.query(
      `SELECT COUNT(*) AS active_shipments
       FROM virtual_shipments
       WHERE status IN ('OPEN', 'CLOSED')`,
    );

    // 4. Low stock items
    const lowStockResult = await pool.query(
      `SELECT COUNT(DISTINCT i.product_sku) AS low_stock_items
       FROM wms_inventory i
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       WHERE i.quantity <= 3 AND i.quantity > 0
       ${whFilter}`,
      params,
    );

    // 5. Active cycle count sessions
    const activeCycleResult = await pool.query(
      `SELECT COUNT(*) AS active_counts
       FROM wms_cycle_count_sessions
       WHERE status IN ('PLANNED', 'IN_PROGRESS')`,
    );

    // 6. Pending RMAs
    const pendingRmaResult = await pool.query(
      `SELECT COUNT(*) AS pending_rmas
       FROM wms_rma_requests
       WHERE status IN ('PENDING', 'APPROVED', 'IN_PROCESS')`,
    );

    // 7. Total SKUs in stock
    const totalSkuResult = await pool.query(
      `SELECT
         COUNT(DISTINCT i.product_sku) AS total_skus,
         COALESCE(SUM(i.quantity), 0) AS total_units
       FROM wms_inventory i
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       WHERE i.quantity > 0
       ${whFilter}`,
      params,
    );

    // 8. Last 7 days transaction trend
    const trendResult = await pool.query(
      `SELECT
         d.day::date AS date,
         COALESCE(tx.count, 0) AS count
       FROM generate_series(
         CURRENT_DATE - INTERVAL '6 days',
         CURRENT_DATE,
         '1 day'
       ) AS d(day)
       LEFT JOIN (
         SELECT created_at::date AS day, COUNT(*) AS count
         FROM wms_transactions t
         WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
         ${whFilterTx}
         GROUP BY created_at::date
       ) tx ON d.day::date = tx.day
       ORDER BY d.day`,
      params,
    );

    const today = todayTxResult.rows[0];

    res.json({
      success: true,
      data: {
        today: {
          in: parseInt(today.today_in),
          out: parseInt(today.today_out),
          transfer: parseInt(today.today_transfer),
          adjust: parseInt(today.today_adjust),
          total: parseInt(today.today_total),
        },
        pending_orders: parseInt(pendingOrdersResult.rows[0].pending_orders),
        active_shipments: parseInt(activeShipmentsResult.rows[0].active_shipments),
        low_stock_items: parseInt(lowStockResult.rows[0].low_stock_items),
        active_counts: parseInt(activeCycleResult.rows[0].active_counts),
        pending_rmas: parseInt(pendingRmaResult.rows[0].pending_rmas),
        total_skus: parseInt(totalSkuResult.rows[0].total_skus),
        total_units: parseInt(totalSkuResult.rows[0].total_units),
        trend: trendResult.rows.map(r => ({
          date: r.date,
          count: parseInt(r.count),
        })),
      },
    });
  } catch (error) {
    logger.error('[Dashboard] stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dashboard stats' });
  }
});

export default router;
