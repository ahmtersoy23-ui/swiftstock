// ============================================
// ANALYTICS ROUTES — Faz 3
// Unified stock dashboard, dead stock, turnover/DOS,
// performance metrics, slotting, replenishment
// ============================================

import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/database';
import { getPricelabPool } from '../config/database';
import logger from '../config/logger';

const router = Router();

// Ensure marketplace stock table exists (for non-FBA sources: Wayfair CG, Takealot, etc.)
const ensureMarketplaceTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wms_marketplace_stock (
      id SERIAL PRIMARY KEY,
      product_sku VARCHAR(100) NOT NULL,
      source VARCHAR(50) NOT NULL,
      depot_name VARCHAR(100) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0,
      reserved INTEGER NOT NULL DEFAULT 0,
      inbound INTEGER NOT NULL DEFAULT 0,
      last_synced_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(product_sku, source, depot_name)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_wms_marketplace_stock_sku ON wms_marketplace_stock (product_sku)`);
};
ensureMarketplaceTables().catch(err => logger.error('[Analytics] Marketplace table creation failed:', err));

// ────────────────────────────────────────────────────────────────────────────
// MARKETPLACE STOCK PUSH API (DataBridge → SwiftStock)
// POST /analytics/marketplace-stock — bulk upsert
// ────────────────────────────────────────────────────────────────────────────

router.post('/analytics/marketplace-stock', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { source, items } = req.body;

    if (!source || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ success: false, error: 'source (string) ve items (array) gerekli' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      let upserted = 0;
      for (const item of items) {
        if (!item.product_sku || !item.depot_name) continue;
        await client.query(
          `INSERT INTO wms_marketplace_stock (product_sku, source, depot_name, quantity, reserved, inbound, last_synced_at)
           VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
           ON CONFLICT (product_sku, source, depot_name)
           DO UPDATE SET quantity = $4, reserved = $5, inbound = $6, last_synced_at = CURRENT_TIMESTAMP`,
          [item.product_sku, source, item.depot_name, item.quantity || 0, item.reserved || 0, item.inbound || 0],
        );
        upserted++;
      }

      await client.query('COMMIT');
      res.json({ success: true, upserted });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('[Analytics] marketplace-stock push error:', error);
    res.status(500).json({ success: false, error: 'Failed to update marketplace stock' });
  }
});

// GET /analytics/marketplace-stock — list all marketplace stock
router.get('/analytics/marketplace-stock', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const source = req.query.source as string | undefined;
    const product_sku = req.query.product_sku as string | undefined;

    let where = 'WHERE 1=1';
    const params: string[] = [];
    let idx = 1;
    if (source) { where += ` AND source = $${idx++}`; params.push(source); }
    if (product_sku) { where += ` AND product_sku = $${idx++}`; params.push(product_sku); }

    const result = await pool.query(
      `SELECT * FROM wms_marketplace_stock ${where} ORDER BY source, product_sku`,
      params,
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[Analytics] marketplace-stock list error:', error);
    res.status(500).json({ success: false, error: 'Failed to load marketplace stock' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 1. UNIFIED IWASKU STOCK DASHBOARD
// GET /analytics/unified-stock?search=&category=&page=&limit=
// Combines: WMS physical + transit + marketplace (FBA) stock per IWASKU
// ────────────────────────────────────────────────────────────────────────────

router.get('/analytics/unified-stock', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const category = req.query.category as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, parseInt(req.query.limit as string) || 50);
    const offset = (page - 1) * limit;

    // Build product filter
    let prodFilter = 'WHERE 1=1';
    const prodParams: string[] = [];
    let paramIdx = 1;

    if (search) {
      prodFilter += ` AND (p.product_sku ILIKE $${paramIdx} OR p.name ILIKE $${paramIdx})`;
      prodParams.push(`%${search}%`);
      paramIdx++;
    }
    if (category) {
      prodFilter += ` AND p.category = $${paramIdx}`;
      prodParams.push(category);
      paramIdx++;
    }

    // 1. Get products (from pricelab_db via products table — already available in swiftstock scope)
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM products p ${prodFilter}`,
      prodParams,
    );
    const total = parseInt(countResult.rows[0].count);

    const productsResult = await pool.query(
      `SELECT p.product_sku, p.name AS product_name, p.category
       FROM products p
       ${prodFilter}
       ORDER BY p.product_sku
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...prodParams, limit, offset],
    );

    // 2. Get WMS physical stock (grouped by SKU + warehouse)
    const skus = productsResult.rows.map((p: { product_sku: string }) => p.product_sku);

    if (skus.length === 0) {
      res.json({ success: true, data: [], pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
      return;
    }

    const physicalResult = await pool.query(
      `SELECT i.product_sku, w.code AS warehouse_code, SUM(i.quantity) AS quantity
       FROM wms_inventory i
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       WHERE i.product_sku = ANY($1) AND i.quantity > 0
       GROUP BY i.product_sku, w.code`,
      [skus],
    );

    // 3. Get transit stock (in virtual shipments)
    const transitResult = await pool.query(
      `SELECT sbc.product_sku, SUM(sbc.quantity) AS quantity
       FROM shipment_box_contents sbc
       JOIN shipment_boxes sb ON sbc.box_id = sb.box_id
       JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id
       WHERE vs.status IN ('OPEN', 'CLOSED')
         AND sbc.product_sku = ANY($1)
       GROUP BY sbc.product_sku`,
      [skus],
    );

    // 4. Get reserved stock
    const reservedResult = await pool.query(
      `SELECT product_sku, SUM(quantity) AS quantity
       FROM wms_reservations
       WHERE product_sku = ANY($1) AND status = 'ACTIVE'
       GROUP BY product_sku`,
      [skus],
    );

    // 5. Get marketplace stock — Amazon FBA from pricelab_db
    type FbaRow = { iwasku: string; warehouse: string; fulfillable_quantity: number; total_reserved_quantity: number; total_unfulfillable_quantity: number; inbound_shipped_quantity: number };
    let fbaRows: FbaRow[] = [];
    try {
      const sp = getPricelabPool();
      const fbaResult = await sp.query(
        `SELECT iwasku, warehouse,
                COALESCE(fulfillable_quantity, 0) AS fulfillable_quantity,
                COALESCE(total_reserved_quantity, 0) AS total_reserved_quantity,
                COALESCE(total_unfulfillable_quantity, 0) AS total_unfulfillable_quantity,
                COALESCE(inbound_shipped_quantity, 0) AS inbound_shipped_quantity
         FROM fba_inventory
         WHERE iwasku = ANY($1) AND iwasku IS NOT NULL`,
        [skus],
      );
      fbaRows = fbaResult.rows;
    } catch {
      logger.warn('[Analytics] Could not read fba_inventory from pricelab_db');
    }

    // 6. Get non-FBA marketplace stock (Wayfair CG, Takealot, etc.) from swiftstock_db
    const otherMarketplaceResult = await pool.query(
      `SELECT product_sku, source, depot_name, quantity, reserved, inbound
       FROM wms_marketplace_stock
       WHERE product_sku = ANY($1) AND quantity > 0`,
      [skus],
    );

    // Build maps
    const physicalMap = new Map<string, Record<string, number>>();
    for (const row of physicalResult.rows) {
      if (!physicalMap.has(row.product_sku)) physicalMap.set(row.product_sku, {});
      physicalMap.get(row.product_sku)![row.warehouse_code] = parseInt(row.quantity);
    }

    const transitMap = new Map<string, number>();
    for (const row of transitResult.rows) {
      transitMap.set(row.product_sku, parseInt(row.quantity));
    }

    const reservedMap = new Map<string, number>();
    for (const row of reservedResult.rows) {
      reservedMap.set(row.product_sku, parseInt(row.quantity));
    }

    type MarketplaceDepot = { source: string; depot: string; fulfillable: number; reserved: number; unfulfillable: number; inbound: number };
    const marketplaceMap = new Map<string, MarketplaceDepot[]>();

    // Amazon FBA depots
    for (const row of fbaRows) {
      if (!marketplaceMap.has(row.iwasku)) marketplaceMap.set(row.iwasku, []);
      marketplaceMap.get(row.iwasku)!.push({
        source: 'AMAZON_FBA',
        depot: `FBA_${row.warehouse}`,
        fulfillable: row.fulfillable_quantity,
        reserved: row.total_reserved_quantity,
        unfulfillable: row.total_unfulfillable_quantity,
        inbound: row.inbound_shipped_quantity,
      });
    }

    // Other marketplace depots (Wayfair CG, Takealot, etc.)
    for (const row of otherMarketplaceResult.rows) {
      if (!marketplaceMap.has(row.product_sku)) marketplaceMap.set(row.product_sku, []);
      marketplaceMap.get(row.product_sku)!.push({
        source: row.source,
        depot: row.depot_name,
        fulfillable: parseInt(row.quantity),
        reserved: parseInt(row.reserved),
        unfulfillable: 0,
        inbound: parseInt(row.inbound),
      });
    }

    // Assemble unified data
    const data = productsResult.rows.map((p: { product_sku: string; product_name: string; category: string }) => {
      const physical = physicalMap.get(p.product_sku) || {};
      const physicalTotal = Object.values(physical).reduce((s, v) => s + v, 0);
      const transit = transitMap.get(p.product_sku) || 0;
      const reserved = reservedMap.get(p.product_sku) || 0;
      const marketplace = marketplaceMap.get(p.product_sku) || [];
      const marketplaceTotal = marketplace.reduce((s, m) => s + m.fulfillable, 0);

      return {
        product_sku: p.product_sku,
        product_name: p.product_name,
        category: p.category,
        physical: { warehouses: physical, total: physicalTotal },
        transit,
        reserved,
        available: physicalTotal - reserved,
        marketplace: { depots: marketplace, total_fulfillable: marketplaceTotal },
        grand_total: physicalTotal + transit + marketplaceTotal,
      };
    });

    res.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    logger.error('[Analytics] unified-stock error:', error);
    res.status(500).json({ success: false, error: 'Failed to load unified stock' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 2. DEAD STOCK (son X gün hareketsiz ürünler)
// GET /analytics/dead-stock?days=90&warehouse_code=&limit=
// ────────────────────────────────────────────────────────────────────────────

router.get('/analytics/dead-stock', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const warehouseCode = req.query.warehouse_code as string | undefined;
    const limit = Math.min(500, parseInt(req.query.limit as string) || 100);

    let whFilter = '';
    const params: (string | number)[] = [days, limit];
    if (warehouseCode) {
      whFilter = 'AND w.code = $3';
      params.push(warehouseCode);
    }

    const result = await pool.query(
      `SELECT
         i.product_sku, p.name AS product_name, p.category,
         w.code AS warehouse_code,
         SUM(i.quantity) AS quantity,
         MAX(t.created_at) AS last_movement,
         CURRENT_DATE - MAX(t.created_at)::date AS days_idle
       FROM wms_inventory i
       JOIN products p ON i.product_sku = p.product_sku
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       LEFT JOIN (
         SELECT DISTINCT ON (ti.product_sku, w2.code)
           ti.product_sku, w2.code AS warehouse_code, t2.created_at
         FROM wms_transaction_items ti
         JOIN wms_transactions t2 ON ti.transaction_id = t2.transaction_id
         JOIN wms_warehouses w2 ON t2.warehouse_id = w2.warehouse_id
         ORDER BY ti.product_sku, w2.code, t2.created_at DESC
       ) t ON i.product_sku = t.product_sku AND w.code = t.warehouse_code
       WHERE i.quantity > 0
         AND (t.created_at IS NULL OR t.created_at < CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL)
         ${whFilter}
       GROUP BY i.product_sku, p.name, p.category, w.code
       ORDER BY days_idle DESC NULLS FIRST, quantity DESC
       LIMIT $2`,
      params,
    );

    res.json({ success: true, data: result.rows, filters: { days, warehouse_code: warehouseCode } });
  } catch (error) {
    logger.error('[Analytics] dead-stock error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dead stock' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 3. INVENTORY TURNOVER / DAYS OF SUPPLY (DOS)
// GET /analytics/turnover?days=30&warehouse_code=&limit=
// ────────────────────────────────────────────────────────────────────────────

router.get('/analytics/turnover', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const warehouseCode = req.query.warehouse_code as string | undefined;
    const limit = Math.min(500, parseInt(req.query.limit as string) || 100);

    let whFilter = '';
    let whFilterTx = '';
    const params: (string | number)[] = [days, limit];
    if (warehouseCode) {
      whFilter = 'AND w.code = $3';
      whFilterTx = 'AND t.warehouse_id = (SELECT warehouse_id FROM wms_warehouses WHERE code = $3)';
      params.push(warehouseCode);
    }

    const result = await pool.query(
      `WITH outbound AS (
         SELECT
           ti.product_sku,
           SUM(ti.quantity) AS total_out
         FROM wms_transaction_items ti
         JOIN wms_transactions t ON ti.transaction_id = t.transaction_id
         WHERE t.transaction_type = 'OUT'
           AND t.created_at >= CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
           ${whFilterTx}
         GROUP BY ti.product_sku
       ),
       current_stock AS (
         SELECT
           i.product_sku,
           SUM(i.quantity) AS stock
         FROM wms_inventory i
         JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
         WHERE i.quantity > 0
           ${whFilter}
         GROUP BY i.product_sku
       )
       SELECT
         cs.product_sku,
         p.name AS product_name,
         p.category,
         cs.stock AS current_stock,
         COALESCE(ob.total_out, 0) AS total_out_period,
         CASE
           WHEN COALESCE(ob.total_out, 0) = 0 THEN 0
           ELSE ROUND(COALESCE(ob.total_out, 0)::NUMERIC / $1, 2)
         END AS avg_daily_out,
         CASE
           WHEN COALESCE(ob.total_out, 0) = 0 THEN 9999
           ELSE ROUND(cs.stock::NUMERIC / (COALESCE(ob.total_out, 0)::NUMERIC / $1), 0)
         END AS days_of_supply,
         CASE
           WHEN cs.stock = 0 THEN 0
           WHEN COALESCE(ob.total_out, 0) = 0 THEN 0
           ELSE ROUND(COALESCE(ob.total_out, 0)::NUMERIC / cs.stock::NUMERIC, 2)
         END AS turnover_ratio
       FROM current_stock cs
       JOIN products p ON cs.product_sku = p.product_sku
       LEFT JOIN outbound ob ON cs.product_sku = ob.product_sku
       ORDER BY days_of_supply ASC
       LIMIT $2`,
      params,
    );

    res.json({ success: true, data: result.rows, filters: { days, warehouse_code: warehouseCode } });
  } catch (error) {
    logger.error('[Analytics] turnover error:', error);
    res.status(500).json({ success: false, error: 'Failed to load turnover data' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 4. WAREHOUSE PERFORMANCE METRICS
// GET /analytics/performance?days=30&warehouse_code=
// ────────────────────────────────────────────────────────────────────────────

router.get('/analytics/performance', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 30;
    const warehouseCode = req.query.warehouse_code as string | undefined;

    const whFilter = warehouseCode ? 'AND t.warehouse_id = (SELECT warehouse_id FROM wms_warehouses WHERE code = $2)' : '';
    const params: (string | number)[] = [days];
    if (warehouseCode) params.push(warehouseCode);

    // Transaction volume by type
    const volumeResult = await pool.query(
      `SELECT
         t.transaction_type,
         COUNT(*) AS count,
         SUM(COALESCE(ti.total_items, 0)) AS total_items
       FROM wms_transactions t
       LEFT JOIN (
         SELECT transaction_id, SUM(quantity) AS total_items
         FROM wms_transaction_items
         GROUP BY transaction_id
       ) ti ON t.transaction_id = ti.transaction_id
       WHERE t.created_at >= CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
       ${whFilter}
       GROUP BY t.transaction_type`,
      params,
    );

    // Picker performance (shipment_orders may not exist yet)
    let pickerResult = { rows: [] as Record<string, unknown>[] };
    try {
      pickerResult = await pool.query(
        `SELECT
           u.username, u.full_name,
           COUNT(DISTINCT so.order_id) AS orders_picked,
           AVG(EXTRACT(EPOCH FROM (so.picking_completed_at - so.picking_started_at)) / 60)::DECIMAL(10,1) AS avg_pick_minutes
         FROM shipment_orders so
         JOIN wms_users u ON so.assigned_picker_id = u.user_id
         WHERE so.status IN ('PICKED', 'SHIPPED')
           AND so.picking_completed_at >= CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
         GROUP BY u.username, u.full_name
         ORDER BY orders_picked DESC`,
        [days],
      );
    } catch { /* table may not exist */ }

    // Cycle count accuracy
    const accuracyResult = await pool.query(
      `SELECT
         COUNT(*) AS total_sessions,
         AVG(CASE WHEN total_variance = 0 THEN 100
             ELSE GREATEST(0, 100 - ABS(total_variance::NUMERIC / NULLIF(total_expected, 0) * 100))
         END)::DECIMAL(5,1) AS avg_accuracy_pct
       FROM (
         SELECT
           cs.session_id,
           COALESCE(SUM(ci.expected_quantity), 0) AS total_expected,
           COALESCE(SUM(ci.variance), 0) AS total_variance
         FROM wms_cycle_count_sessions cs
         LEFT JOIN wms_cycle_count_items ci ON cs.session_id = ci.session_id
         WHERE cs.status = 'COMPLETED'
           AND cs.completed_at >= CURRENT_TIMESTAMP - ($1 || ' days')::INTERVAL
         GROUP BY cs.session_id
       ) sub`,
      [days],
    );

    // Daily transaction trend
    const trendResult = await pool.query(
      `SELECT
         d.day::date AS date,
         COALESCE(tx.in_count, 0) AS in_count,
         COALESCE(tx.out_count, 0) AS out_count,
         COALESCE(tx.transfer_count, 0) AS transfer_count
       FROM generate_series(
         CURRENT_DATE - (($1 - 1) || ' days')::INTERVAL,
         CURRENT_DATE,
         '1 day'
       ) AS d(day)
       LEFT JOIN (
         SELECT
           created_at::date AS day,
           SUM(CASE WHEN transaction_type = 'IN' THEN 1 ELSE 0 END) AS in_count,
           SUM(CASE WHEN transaction_type = 'OUT' THEN 1 ELSE 0 END) AS out_count,
           SUM(CASE WHEN transaction_type = 'TRANSFER' THEN 1 ELSE 0 END) AS transfer_count
         FROM wms_transactions t
         WHERE created_at >= CURRENT_DATE - (($1 - 1) || ' days')::INTERVAL
         ${whFilter}
         GROUP BY created_at::date
       ) tx ON d.day::date = tx.day
       ORDER BY d.day`,
      params,
    );

    res.json({
      success: true,
      data: {
        period_days: days,
        warehouse: warehouseCode || 'ALL',
        volume: volumeResult.rows,
        pickers: pickerResult.rows,
        accuracy: accuracyResult.rows[0],
        trend: trendResult.rows,
      },
    });
  } catch (error) {
    logger.error('[Analytics] performance error:', error);
    res.status(500).json({ success: false, error: 'Failed to load performance data' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 5. SLOTTING OPTIMIZATION (yüksek hızlı ürünleri prime lokasyona öner)
// GET /analytics/slotting?warehouse_code=&days=30
// ────────────────────────────────────────────────────────────────────────────

router.get('/analytics/slotting', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const warehouseCode = req.query.warehouse_code as string;
    const days = parseInt(req.query.days as string) || 30;

    if (!warehouseCode) {
      res.status(400).json({ success: false, error: 'warehouse_code gerekli' });
      return;
    }

    // High velocity items not in prime locations (first aisle)
    const result = await pool.query(
      `WITH velocity AS (
         SELECT
           ti.product_sku,
           COUNT(*) AS movement_count
         FROM wms_transaction_items ti
         JOIN wms_transactions t ON ti.transaction_id = t.transaction_id
         WHERE t.warehouse_id = (SELECT warehouse_id FROM wms_warehouses WHERE code = $1)
           AND t.created_at >= CURRENT_TIMESTAMP - ($2 || ' days')::INTERVAL
         GROUP BY ti.product_sku
       ),
       current_loc AS (
         SELECT
           i.product_sku,
           l.location_code, l.aisle, l.bay, l.level
         FROM wms_inventory i
         JOIN wms_locations l ON i.location_id = l.location_id
         JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
         WHERE w.code = $1 AND i.quantity > 0
       )
       SELECT
         v.product_sku,
         p.name AS product_name,
         v.movement_count,
         cl.location_code AS current_location,
         cl.aisle AS current_aisle,
         CASE
           WHEN cl.aisle IS NOT NULL AND cl.aisle <= 'B' THEN 'OPTIMAL'
           WHEN v.movement_count >= 20 THEN 'MOVE_TO_PRIME'
           ELSE 'OK'
         END AS recommendation
       FROM velocity v
       JOIN products p ON v.product_sku = p.product_sku
       LEFT JOIN current_loc cl ON v.product_sku = cl.product_sku
       ORDER BY v.movement_count DESC
       LIMIT 50`,
      [warehouseCode, days],
    );

    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[Analytics] slotting error:', error);
    res.status(500).json({ success: false, error: 'Failed to load slotting data' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 6. REPLENISHMENT RULES (min/max seviye kontrol)
// GET /analytics/replenishment?warehouse_code=
// ────────────────────────────────────────────────────────────────────────────

router.get('/analytics/replenishment', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const warehouseCode = req.query.warehouse_code as string;
    if (!warehouseCode) {
      res.status(400).json({ success: false, error: 'warehouse_code gerekli' });
      return;
    }

    // Products below minimum threshold (default: 5 units)
    const minThreshold = parseInt(req.query.min_threshold as string) || 5;

    const result = await pool.query(
      `SELECT
         i.product_sku,
         p.name AS product_name,
         p.category,
         SUM(i.quantity) AS current_stock,
         $2::integer AS min_threshold,
         CASE
           WHEN SUM(i.quantity) <= 0 THEN 'OUT_OF_STOCK'
           WHEN SUM(i.quantity) <= $2::integer THEN 'BELOW_MIN'
           ELSE 'OK'
         END AS status,
         $2::integer - SUM(i.quantity) AS replenish_quantity
       FROM wms_inventory i
       JOIN products p ON i.product_sku = p.product_sku
       JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       WHERE w.code = $1
       GROUP BY i.product_sku, p.name, p.category
       HAVING SUM(i.quantity) <= $2::integer
       ORDER BY SUM(i.quantity) ASC
       LIMIT 200`,
      [warehouseCode, minThreshold],
    );

    res.json({ success: true, data: result.rows, filters: { warehouse_code: warehouseCode, min_threshold: minThreshold } });
  } catch (error) {
    logger.error('[Analytics] replenishment error:', error);
    res.status(500).json({ success: false, error: 'Failed to load replenishment data' });
  }
});

export default router;
