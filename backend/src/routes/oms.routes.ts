// ============================================
// OMS INTEGRATION ROUTES
// OMS ↔ WMS entegrasyon API'leri
// Stok kontrol, rezervasyon, picking talimatı, webhook bildirimleri
// ============================================

import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/database';
import logger from '../config/logger';

const router = Router();

// ────────────────────────────────────────────────────────────────────────────
// ENSURE TABLES (idempotent)
// ────────────────────────────────────────────────────────────────────────────

const ensureTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wms_reservations (
      reservation_id SERIAL PRIMARY KEY,
      product_sku VARCHAR(100) NOT NULL,
      warehouse_code VARCHAR(20) NOT NULL,
      quantity INTEGER NOT NULL,
      order_reference VARCHAR(200),
      reserved_by VARCHAR(100),
      status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
      expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      released_at TIMESTAMP
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wms_reservations_active ON wms_reservations (product_sku, warehouse_code) WHERE status = 'ACTIVE'`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wms_webhooks (
      webhook_id SERIAL PRIMARY KEY,
      url VARCHAR(500) NOT NULL,
      event_type VARCHAR(50) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      secret_key VARCHAR(200),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS wms_webhook_logs (
      log_id SERIAL PRIMARY KEY,
      webhook_id INTEGER REFERENCES wms_webhooks(webhook_id),
      event_type VARCHAR(50) NOT NULL,
      payload JSONB,
      response_status INTEGER,
      response_body TEXT,
      attempt INTEGER NOT NULL DEFAULT 1,
      success BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};
ensureTables().catch(err => logger.error('[OMS] Table creation failed:', err));

// ────────────────────────────────────────────────────────────────────────────
// 1. STOK KONTROL API (OMS → WMS)
// GET /oms/stock?sku=X&warehouse_code=Y
// ────────────────────────────────────────────────────────────────────────────

router.get('/oms/stock', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { sku, warehouse_code } = req.query;

    if (!sku) {
      res.status(400).json({ success: false, error: 'sku parametresi gerekli' });
      return;
    }

    let whereClause = 'WHERE i.product_sku = $1 AND i.quantity > 0';
    const params: (string | number)[] = [sku as string];

    if (warehouse_code) {
      whereClause += ' AND w.code = $2';
      params.push(warehouse_code as string);
    }

    // Physical stock
    const physicalResult = await pool.query(
      `SELECT
         w.code AS warehouse_code,
         w.name AS warehouse_name,
         SUM(i.quantity) AS physical_stock
       FROM wms_inventory i
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       ${whereClause}
       GROUP BY w.code, w.name
       ORDER BY w.code`,
      params,
    );

    // Reserved stock
    const reservedResult = await pool.query(
      `SELECT
         warehouse_code,
         SUM(quantity) AS reserved_stock
       FROM wms_reservations
       WHERE product_sku = $1 AND status = 'ACTIVE'
       ${warehouse_code ? 'AND warehouse_code = $2' : ''}
       GROUP BY warehouse_code`,
      warehouse_code ? [sku, warehouse_code] : [sku],
    );

    const reservedMap = new Map(
      reservedResult.rows.map((r: { warehouse_code: string; reserved_stock: string }) => [r.warehouse_code, parseInt(r.reserved_stock)])
    );

    const warehouses = physicalResult.rows.map((row: { warehouse_code: string; warehouse_name: string; physical_stock: string }) => {
      const physical = parseInt(row.physical_stock);
      const reserved = reservedMap.get(row.warehouse_code) || 0;
      return {
        warehouse_code: row.warehouse_code,
        warehouse_name: row.warehouse_name,
        physical_stock: physical,
        reserved_stock: reserved,
        available_stock: physical - reserved,
      };
    });

    const totals = warehouses.reduce(
      (acc: { physical: number; reserved: number; available: number }, w: { physical_stock: number; reserved_stock: number; available_stock: number }) => ({
        physical: acc.physical + w.physical_stock,
        reserved: acc.reserved + w.reserved_stock,
        available: acc.available + w.available_stock,
      }),
      { physical: 0, reserved: 0, available: 0 },
    );

    res.json({
      success: true,
      data: {
        product_sku: sku,
        warehouses,
        totals,
      },
    });
  } catch (error) {
    logger.error('[OMS] stock query error:', error);
    res.status(500).json({ success: false, error: 'Failed to query stock' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 2. STOK REZERVASYON API (OMS → WMS)
// POST /oms/reserve — Sipariş için stok rezerve et
// DELETE /oms/reserve/:reservation_id — Rezervasyon iptal
// GET /oms/reservations — Aktif rezervasyonları listele
// ────────────────────────────────────────────────────────────────────────────

router.post('/oms/reserve', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { product_sku, warehouse_code, quantity, order_reference, expires_hours } = req.body;

    if (!product_sku || !warehouse_code || !quantity || quantity <= 0) {
      res.status(400).json({ success: false, error: 'product_sku, warehouse_code ve quantity (>0) gerekli' });
      return;
    }

    // Check available stock
    const stockResult = await pool.query(
      `SELECT COALESCE(SUM(i.quantity), 0) AS physical
       FROM wms_inventory i
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       WHERE i.product_sku = $1 AND w.code = $2 AND i.quantity > 0`,
      [product_sku, warehouse_code],
    );
    const physical = parseInt(stockResult.rows[0].physical);

    const reservedResult = await pool.query(
      `SELECT COALESCE(SUM(quantity), 0) AS reserved
       FROM wms_reservations
       WHERE product_sku = $1 AND warehouse_code = $2 AND status = 'ACTIVE'`,
      [product_sku, warehouse_code],
    );
    const reserved = parseInt(reservedResult.rows[0].reserved);
    const available = physical - reserved;

    if (quantity > available) {
      res.status(409).json({
        success: false,
        error: `Yetersiz stok. Kullanılabilir: ${available}, İstenen: ${quantity}`,
        data: { physical, reserved, available },
      });
      return;
    }

    const expiresAt = expires_hours
      ? new Date(Date.now() + expires_hours * 3600000).toISOString()
      : null;

    const result = await pool.query(
      `INSERT INTO wms_reservations (product_sku, warehouse_code, quantity, order_reference, reserved_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [product_sku, warehouse_code, quantity, order_reference || null, req.user?.username || 'OMS', expiresAt],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('[OMS] reserve error:', error);
    res.status(500).json({ success: false, error: 'Failed to create reservation' });
  }
});

router.delete('/oms/reserve/:reservation_id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `UPDATE wms_reservations
       SET status = 'RELEASED', released_at = CURRENT_TIMESTAMP
       WHERE reservation_id = $1 AND status = 'ACTIVE'
       RETURNING *`,
      [req.params.reservation_id],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Aktif rezervasyon bulunamadı' });
      return;
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('[OMS] release reservation error:', error);
    res.status(500).json({ success: false, error: 'Failed to release reservation' });
  }
});

router.get('/oms/reservations', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { product_sku, warehouse_code, status = 'ACTIVE' } = req.query;
    let where = 'WHERE 1=1';
    const params: string[] = [];
    let idx = 1;

    if (product_sku) { where += ` AND product_sku = $${idx++}`; params.push(product_sku as string); }
    if (warehouse_code) { where += ` AND warehouse_code = $${idx++}`; params.push(warehouse_code as string); }
    if (status) { where += ` AND status = $${idx++}`; params.push(status as string); }

    const result = await pool.query(
      `SELECT * FROM wms_reservations ${where} ORDER BY created_at DESC LIMIT 200`,
      params,
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[OMS] list reservations error:', error);
    res.status(500).json({ success: false, error: 'Failed to list reservations' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 3. PICKING TALIMATI API (OMS → WMS)
// POST /oms/pick-request — Sipariş bazlı picking talimatı oluştur
// ────────────────────────────────────────────────────────────────────────────

router.post('/oms/pick-request', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { order_number, warehouse_code, customer_name, priority, items } = req.body;

    if (!order_number || !warehouse_code || !items || items.length === 0) {
      res.status(400).json({ success: false, error: 'order_number, warehouse_code ve items gerekli' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check duplicate
      const existing = await client.query(
        'SELECT order_id FROM shipment_orders WHERE order_number = $1',
        [order_number],
      );
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(409).json({ success: false, error: 'Bu sipariş numarası zaten mevcut' });
        return;
      }

      // Create order
      const orderResult = await client.query(
        `INSERT INTO shipment_orders (order_number, warehouse_code, customer_name, priority, status, created_by)
         VALUES ($1, $2, $3, $4, 'PENDING', $5)
         RETURNING *`,
        [order_number, warehouse_code, customer_name || 'OMS Customer', priority || 'NORMAL', req.user?.username || 'OMS'],
      );
      const order = orderResult.rows[0];

      // Insert items with location suggestion (pick path optimized: aisle → bay → level)
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const sku = item.product_sku || item.sku_code;
        const qty = item.quantity || 1;

        // Find best location (most stock, sorted by aisle/bay/level for pick path)
        const locResult = await client.query(
          `SELECT i.location_id, l.location_code, l.aisle, l.bay, l.level, i.quantity
           FROM wms_inventory i
           JOIN wms_locations l ON i.location_id = l.location_id
           WHERE i.product_sku = $1
             AND l.warehouse_id = (SELECT warehouse_id FROM wms_warehouses WHERE code = $2)
             AND i.quantity >= $3
           ORDER BY l.aisle, l.bay, l.level, i.quantity DESC
           LIMIT 1`,
          [sku, warehouse_code, qty],
        );

        const loc = locResult.rows[0];

        // Get product name
        const prodResult = await client.query(
          'SELECT name FROM products WHERE product_sku = $1',
          [sku],
        );

        await client.query(
          `INSERT INTO shipment_order_items (order_id, line_number, product_sku, product_name, quantity_ordered, location_id, location_code)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [order.order_id, i + 1, sku, prodResult.rows[0]?.name || sku, qty, loc?.location_id || null, loc?.location_code || null],
        );
      }

      await client.query('COMMIT');

      // Return created order with items
      const fullOrder = await pool.query(
        `SELECT so.*, json_agg(json_build_object(
           'line_number', soi.line_number, 'product_sku', soi.product_sku,
           'product_name', soi.product_name, 'quantity_ordered', soi.quantity_ordered,
           'location_code', soi.location_code
         ) ORDER BY soi.line_number) AS items
         FROM shipment_orders so
         LEFT JOIN shipment_order_items soi ON so.order_id = soi.order_id
         WHERE so.order_id = $1
         GROUP BY so.order_id`,
        [order.order_id],
      );

      res.status(201).json({ success: true, data: fullOrder.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('[OMS] pick-request error:', error);
    res.status(500).json({ success: false, error: 'Failed to create pick request' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 4. WEBHOOK YÖNETİMİ (WMS → OMS bildirimler)
// ────────────────────────────────────────────────────────────────────────────

// Register webhook
router.post('/oms/webhooks', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { url, event_type, secret_key } = req.body;

    if (!url || !event_type) {
      res.status(400).json({ success: false, error: 'url ve event_type gerekli' });
      return;
    }

    const validEvents = ['STOCK_CHANGE', 'SHIPMENT_STATUS', 'ORDER_STATUS', 'ALL'];
    if (!validEvents.includes(event_type)) {
      res.status(400).json({ success: false, error: `Geçersiz event_type. Geçerli: ${validEvents.join(', ')}` });
      return;
    }

    const result = await pool.query(
      `INSERT INTO wms_webhooks (url, event_type, secret_key)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [url, event_type, secret_key || null],
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('[OMS] create webhook error:', error);
    res.status(500).json({ success: false, error: 'Failed to create webhook' });
  }
});

// List webhooks
router.get('/oms/webhooks', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT webhook_id, url, event_type, is_active, created_at FROM wms_webhooks ORDER BY created_at DESC',
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[OMS] list webhooks error:', error);
    res.status(500).json({ success: false, error: 'Failed to list webhooks' });
  }
});

// Delete webhook
router.delete('/oms/webhooks/:webhook_id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    await pool.query('DELETE FROM wms_webhooks WHERE webhook_id = $1', [req.params.webhook_id]);
    res.json({ success: true });
  } catch (error) {
    logger.error('[OMS] delete webhook error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete webhook' });
  }
});

// Webhook logs
router.get('/oms/webhook-logs', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
    const result = await pool.query(
      `SELECT wl.*, wh.url, wh.event_type AS webhook_event
       FROM wms_webhook_logs wl
       JOIN wms_webhooks wh ON wl.webhook_id = wh.webhook_id
       ORDER BY wl.created_at DESC
       LIMIT $1`,
      [limit],
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[OMS] webhook logs error:', error);
    res.status(500).json({ success: false, error: 'Failed to load webhook logs' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 5. WEBHOOK DISPATCH (internal utility — called by event listeners)
// ────────────────────────────────────────────────────────────────────────────

export async function dispatchWebhook(eventType: string, payload: Record<string, unknown>) {
  try {
    const webhooks = await pool.query(
      `SELECT * FROM wms_webhooks WHERE is_active = TRUE AND (event_type = $1 OR event_type = 'ALL')`,
      [eventType],
    );

    for (const webhook of webhooks.rows) {
      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(webhook.secret_key ? { 'X-Webhook-Secret': webhook.secret_key } : {}),
            },
            body: JSON.stringify({ event: eventType, timestamp: new Date().toISOString(), data: payload }),
            signal: AbortSignal.timeout(10000),
          });

          await pool.query(
            `INSERT INTO wms_webhook_logs (webhook_id, event_type, payload, response_status, response_body, attempt, success)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [webhook.webhook_id, eventType, JSON.stringify(payload), response.status, (await response.text()).substring(0, 500), attempt, response.ok],
          );

          if (response.ok) break;
        } catch (err) {
          await pool.query(
            `INSERT INTO wms_webhook_logs (webhook_id, event_type, payload, response_status, response_body, attempt, success)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [webhook.webhook_id, eventType, JSON.stringify(payload), 0, String(err).substring(0, 500), attempt, false],
          );

          // Exponential backoff: 1s, 2s, 4s
          if (attempt < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
          }
        }
      }
    }
  } catch (error) {
    logger.error(`[OMS] dispatchWebhook ${eventType} error:`, error);
  }
}

// ── Manual webhook test ───────────────────────────────────────────────────
router.post('/oms/webhooks/test', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { event_type, payload } = req.body;
    await dispatchWebhook(event_type || 'TEST', payload || { test: true });
    res.json({ success: true, message: 'Webhook dispatched' });
  } catch (error) {
    logger.error('[OMS] webhook test error:', error);
    res.status(500).json({ success: false, error: 'Failed to dispatch test webhook' });
  }
});

export default router;
