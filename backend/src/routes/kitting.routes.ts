// ============================================
// KITTING / ASSEMBLY ROUTES
// Kit tanımlama ve kit oluşturma (combo ürünler)
// ============================================

import { Router, Response } from 'express';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth.middleware';
import pool from '../config/database';
import logger from '../config/logger';

const router = Router();

// Ensure tables
const ensureTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wms_kit_definitions (
      kit_id SERIAL PRIMARY KEY,
      kit_sku VARCHAR(100) NOT NULL UNIQUE,
      kit_name VARCHAR(300),
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_by VARCHAR(100),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wms_kit_components (
      component_id SERIAL PRIMARY KEY,
      kit_id INTEGER NOT NULL REFERENCES wms_kit_definitions(kit_id),
      product_sku VARCHAR(100) NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS wms_kit_builds (
      build_id SERIAL PRIMARY KEY,
      kit_id INTEGER NOT NULL REFERENCES wms_kit_definitions(kit_id),
      warehouse_code VARCHAR(20) NOT NULL,
      quantity_built INTEGER NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
      built_by VARCHAR(100),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
};
ensureTables().catch(err => logger.error('[Kitting] Table creation failed:', err));

// ── Kit Definitions ───────────────────────────────────────────────────────

// GET /kits — List all kit definitions
router.get('/kits', authenticateToken, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT kd.*,
              json_agg(json_build_object(
                'product_sku', kc.product_sku,
                'quantity', kc.quantity,
                'product_name', p.name
              )) AS components
       FROM wms_kit_definitions kd
       LEFT JOIN wms_kit_components kc ON kd.kit_id = kc.kit_id
       LEFT JOIN products p ON kc.product_sku = p.product_sku
       GROUP BY kd.kit_id
       ORDER BY kd.created_at DESC`,
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('[Kitting] list error:', error);
    res.status(500).json({ success: false, error: 'Failed to list kits' });
  }
});

// POST /kits — Create kit definition
router.post('/kits', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  try {
    const { kit_sku, kit_name, components } = req.body;

    if (!kit_sku || !components || components.length === 0) {
      res.status(400).json({ success: false, error: 'kit_sku ve components (array) gerekli' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const kitResult = await client.query(
        `INSERT INTO wms_kit_definitions (kit_sku, kit_name, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [kit_sku, kit_name || kit_sku, req.user?.username || 'SYSTEM'],
      );
      const kit = kitResult.rows[0];

      for (const comp of components) {
        await client.query(
          'INSERT INTO wms_kit_components (kit_id, product_sku, quantity) VALUES ($1, $2, $3)',
          [kit.kit_id, comp.product_sku, comp.quantity || 1],
        );
      }

      await client.query('COMMIT');
      res.status(201).json({ success: true, data: kit });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('[Kitting] create error:', error);
    res.status(500).json({ success: false, error: 'Failed to create kit' });
  }
});

// POST /kits/:kit_id/build — Build kit (consume components, produce kit SKU)
router.post('/kits/:kit_id/build', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), async (req: AuthRequest, res: Response) => {
  try {
    const kitId = parseInt(req.params.kit_id);
    const { warehouse_code, quantity = 1 } = req.body;

    if (!warehouse_code || isNaN(kitId)) {
      res.status(400).json({ success: false, error: 'warehouse_code gerekli' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get kit + components
      const kitResult = await client.query('SELECT * FROM wms_kit_definitions WHERE kit_id = $1', [kitId]);
      if (kitResult.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ success: false, error: 'Kit bulunamadı' });
        return;
      }

      const componentsResult = await client.query(
        'SELECT * FROM wms_kit_components WHERE kit_id = $1',
        [kitId],
      );

      // Check component stock
      const warehouseResult = await client.query(
        'SELECT warehouse_id FROM wms_warehouses WHERE code = $1',
        [warehouse_code],
      );
      if (warehouseResult.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ success: false, error: 'Depo bulunamadı' });
        return;
      }
      const warehouseId = warehouseResult.rows[0].warehouse_id;

      for (const comp of componentsResult.rows) {
        const stockResult = await client.query(
          'SELECT COALESCE(SUM(quantity), 0) AS stock FROM wms_inventory WHERE product_sku = $1 AND warehouse_id = $2',
          [comp.product_sku, warehouseId],
        );
        const available = parseInt(stockResult.rows[0].stock);
        const needed = comp.quantity * quantity;

        if (available < needed) {
          await client.query('ROLLBACK');
          res.status(409).json({
            success: false,
            error: `Yetersiz stok: ${comp.product_sku} — Gerekli: ${needed}, Mevcut: ${available}`,
          });
          return;
        }
      }

      // Consume components (reduce inventory)
      for (const comp of componentsResult.rows) {
        await client.query(
          `UPDATE wms_inventory
           SET quantity = quantity - $1
           WHERE product_sku = $2 AND warehouse_id = $3 AND quantity >= $1`,
          [comp.quantity * quantity, comp.product_sku, warehouseId],
        );
      }

      // Produce kit SKU (add to inventory)
      const existingKit = await client.query(
        'SELECT inventory_id FROM wms_inventory WHERE product_sku = $1 AND warehouse_id = $2 LIMIT 1',
        [kitResult.rows[0].kit_sku, warehouseId],
      );

      if (existingKit.rows.length > 0) {
        await client.query(
          'UPDATE wms_inventory SET quantity = quantity + $1 WHERE inventory_id = $2',
          [quantity, existingKit.rows[0].inventory_id],
        );
      } else {
        await client.query(
          'INSERT INTO wms_inventory (product_sku, warehouse_id, quantity) VALUES ($1, $2, $3)',
          [kitResult.rows[0].kit_sku, warehouseId, quantity],
        );
      }

      // Log build
      await client.query(
        `INSERT INTO wms_kit_builds (kit_id, warehouse_code, quantity_built, built_by)
         VALUES ($1, $2, $3, $4)`,
        [kitId, warehouse_code, quantity, req.user?.username || 'SYSTEM'],
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        data: { kit_sku: kitResult.rows[0].kit_sku, quantity_built: quantity },
        message: `${quantity}x ${kitResult.rows[0].kit_sku} üretildi`,
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('[Kitting] build error:', error);
    res.status(500).json({ success: false, error: 'Failed to build kit' });
  }
});

export default router;
