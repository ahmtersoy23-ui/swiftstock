// ============================================
// ALERTS ROUTES — Notification System
// ============================================

import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/database';
import logger from '../config/logger';

const router = Router();

// Ensure alerts table exists (idempotent)
const ensureTable = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wms_alerts (
      alert_id SERIAL PRIMARY KEY,
      alert_type VARCHAR(50) NOT NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'INFO',
      title VARCHAR(200) NOT NULL,
      message TEXT,
      resource_type VARCHAR(50),
      resource_id VARCHAR(100),
      warehouse_code VARCHAR(20),
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wms_alerts_unread ON wms_alerts (is_read, created_at DESC)`);
};
ensureTable().catch(err => logger.error('[Alerts] Table creation failed:', err));

// GET /alerts — list alerts (unread first, recent)
router.get('/alerts', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
    const unreadOnly = req.query.unread_only === 'true';

    const whereClause = unreadOnly ? 'WHERE is_read = FALSE' : '';

    const result = await pool.query(
      `SELECT * FROM wms_alerts ${whereClause}
       ORDER BY is_read ASC, created_at DESC
       LIMIT $1`,
      [limit],
    );

    const unreadCount = await pool.query(
      'SELECT COUNT(*) as count FROM wms_alerts WHERE is_read = FALSE',
    );

    res.json({
      success: true,
      data: result.rows,
      unread_count: parseInt(unreadCount.rows[0].count),
    });
  } catch (error) {
    logger.error('[Alerts] list error:', error);
    res.status(500).json({ success: false, error: 'Failed to load alerts' });
  }
});

// POST /alerts/:alert_id/read — mark as read
router.post('/alerts/:alert_id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query(
      'UPDATE wms_alerts SET is_read = TRUE WHERE alert_id = $1',
      [req.params.alert_id],
    );
    res.json({ success: true });
  } catch (error) {
    logger.error('[Alerts] mark read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark alert as read' });
  }
});

// POST /alerts/read-all — mark all as read
router.post('/alerts/read-all', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    await pool.query('UPDATE wms_alerts SET is_read = TRUE WHERE is_read = FALSE');
    res.json({ success: true });
  } catch (error) {
    logger.error('[Alerts] mark all read error:', error);
    res.status(500).json({ success: false, error: 'Failed to mark all as read' });
  }
});

// POST /alerts/generate — generate system alerts (called periodically or on-demand)
router.post('/alerts/generate', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const warehouseCode = req.query.warehouse_code as string | undefined;
    let generated = 0;

    // 1. Low stock alerts (quantity <= 3 and > 0)
    let lowStockQuery = `
      SELECT i.product_sku, p.name AS product_name, i.quantity, w.code AS warehouse_code
      FROM wms_inventory i
      JOIN products p ON i.product_sku = p.product_sku
      JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
      WHERE i.quantity <= 3 AND i.quantity > 0
    `;
    const lowParams: string[] = [];
    if (warehouseCode) {
      lowStockQuery += ' AND w.code = $1';
      lowParams.push(warehouseCode);
    }

    const lowStock = await pool.query(lowStockQuery, lowParams);

    for (const item of lowStock.rows) {
      // Avoid duplicate alerts for same SKU+warehouse in last 24h
      const existing = await pool.query(
        `SELECT alert_id FROM wms_alerts
         WHERE alert_type = 'LOW_STOCK' AND resource_id = $1 AND warehouse_code = $2
         AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
        [item.product_sku, item.warehouse_code],
      );

      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO wms_alerts (alert_type, severity, title, message, resource_type, resource_id, warehouse_code)
           VALUES ('LOW_STOCK', 'WARNING', $1, $2, 'product', $3, $4)`,
          [
            `Düşük stok: ${item.product_sku}`,
            `${item.product_name} — ${item.warehouse_code} deposunda ${item.quantity} adet kaldı`,
            item.product_sku,
            item.warehouse_code,
          ],
        );
        generated++;
      }
    }

    // 2. Pending orders (older than 2 days)
    const oldOrders = await pool.query(
      `SELECT order_id, order_number, customer_name
       FROM shipment_orders
       WHERE status = 'PENDING' AND order_date < CURRENT_TIMESTAMP - INTERVAL '2 days'`,
    );

    for (const order of oldOrders.rows) {
      const existing = await pool.query(
        `SELECT alert_id FROM wms_alerts
         WHERE alert_type = 'STALE_ORDER' AND resource_id = $1
         AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
        [order.order_id.toString()],
      );

      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO wms_alerts (alert_type, severity, title, message, resource_type, resource_id)
           VALUES ('STALE_ORDER', 'WARNING', $1, $2, 'order', $3)`,
          [
            `Bekleyen sipariş: ${order.order_number}`,
            `${order.customer_name} — 2+ gündür bekliyor`,
            order.order_id.toString(),
          ],
        );
        generated++;
      }
    }

    // 3. Pending RMAs (older than 3 days)
    const oldRmas = await pool.query(
      `SELECT rma_id, rma_number, customer_name
       FROM wms_rma_requests
       WHERE status = 'PENDING' AND created_at < CURRENT_TIMESTAMP - INTERVAL '3 days'`,
    );

    for (const rma of oldRmas.rows) {
      const existing = await pool.query(
        `SELECT alert_id FROM wms_alerts
         WHERE alert_type = 'STALE_RMA' AND resource_id = $1
         AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'`,
        [rma.rma_id.toString()],
      );

      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO wms_alerts (alert_type, severity, title, message, resource_type, resource_id)
           VALUES ('STALE_RMA', 'INFO', $1, $2, 'rma', $3)`,
          [
            `Bekleyen RMA: ${rma.rma_number}`,
            `${rma.customer_name || 'Bilinmiyor'} — 3+ gündür bekliyor`,
            rma.rma_id.toString(),
          ],
        );
        generated++;
      }
    }

    res.json({ success: true, generated });
  } catch (error) {
    logger.error('[Alerts] generate error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate alerts' });
  }
});

export default router;
