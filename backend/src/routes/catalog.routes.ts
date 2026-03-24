// ============================================
// CATALOG + BARCODING ROUTES — Module 1
// Products (READ-ONLY facade), Serials, Scan
// ============================================

import { Router, Request, Response } from 'express';
import * as productController from '../modules/catalog/controllers/product.controller';
import * as serialController from '../modules/catalog/controllers/serial.controller';
import * as scanController from '../modules/catalog/controllers/scan.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import pool from '../config/database';
import logger from '../config/logger';
import { validateBody } from '../middleware/validate.middleware';
import {
  createProductSchema,
  updateProductSchema,
  scanSchema,
  generateSerialsSchema,
  updateSerialStatusSchema,
} from '../validators/schemas';
import { productService } from '../modules/shared/services/product.service';

const router = Router();

// ── Products (READ-ONLY from pricelab_db) ─────────────────────────────────
router.get('/products', authenticateToken, productController.getAllProducts);
router.get('/products/search', authenticateToken, productController.searchProducts); // BEFORE /:sku_code
router.get('/products/:sku_code', authenticateToken, productController.getProductBySku);
// createProduct / updateProduct / deleteProduct → returns 403 DISABLED (managed from PriceLab)
router.post('/products', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(createProductSchema), productController.createProduct);
router.put('/products/:sku_code', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(updateProductSchema), productController.updateProduct);
router.delete('/products/:sku_code', authenticateToken, requireRole('ADMIN'), productController.deleteProduct);

// ── Scan ──────────────────────────────────────────────────────────────────
router.post('/scan', authenticateToken, validateBody(scanSchema), scanController.scanCode);
router.get('/lookup', authenticateToken, scanController.lookupBySku);

// ── Category → Zone suggestion ────────────────────────────────────────────
// GET /catalog/category-zone?product_sku=XXX&warehouse_code=FACTORY
router.get('/category-zone', authenticateToken, async (req: Request, res: Response) => {
  const { product_sku, warehouse_code } = req.query as { product_sku?: string; warehouse_code?: string };
  if (!product_sku || !warehouse_code) {
    res.status(400).json({ success: false, error: 'product_sku and warehouse_code are required' });
    return;
  }
  try {
    const data = await productService.getCategoryZone(product_sku, warehouse_code);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /putaway-suggest?product_sku=XXX&warehouse_code=YYY
// Returns suggested location based on: same SKU already stored there (co-location),
// then zone match, then least utilized location
router.get('/putaway-suggest', authenticateToken, async (req: Request, res: Response) => {
  const { product_sku, warehouse_code } = req.query as { product_sku?: string; warehouse_code?: string };
  if (!product_sku || !warehouse_code) {
    res.status(400).json({ success: false, error: 'product_sku and warehouse_code required' });
    return;
  }
  try {
    // 1. Best: location where this SKU already has stock (co-locate)
    const coLocResult = await pool.query(
      `SELECT l.location_id, l.location_code, l.zone, l.aisle, l.bay, l.level, i.quantity
       FROM wms_inventory i
       JOIN wms_locations l ON i.location_id = l.location_id
       WHERE i.product_sku = $1
         AND l.warehouse_id = (SELECT warehouse_id FROM wms_warehouses WHERE code = $2)
         AND i.quantity > 0 AND l.is_active = TRUE
       ORDER BY i.quantity DESC
       LIMIT 1`,
      [product_sku, warehouse_code],
    );

    if (coLocResult.rows.length > 0) {
      res.json({ success: true, data: { ...coLocResult.rows[0], strategy: 'CO_LOCATE' } });
      return;
    }

    // 2. Get product category for zone matching
    const prodResult = await pool.query('SELECT category FROM products WHERE product_sku = $1', [product_sku]);
    const category = prodResult.rows[0]?.category;

    // 3. Zone match: find location in matching zone with least stock
    if (category) {
      const zoneResult = await pool.query(
        `SELECT l.location_id, l.location_code, l.zone, l.aisle, l.bay, l.level,
                COALESCE(SUM(i.quantity), 0) AS current_stock
         FROM wms_locations l
         LEFT JOIN wms_inventory i ON l.location_id = i.location_id
         WHERE l.warehouse_id = (SELECT warehouse_id FROM wms_warehouses WHERE code = $1)
           AND l.zone = $2 AND l.is_active = TRUE AND l.location_type IN ('RACK', 'FLOOR')
         GROUP BY l.location_id
         ORDER BY current_stock ASC, l.aisle, l.bay, l.level
         LIMIT 1`,
        [warehouse_code, category],
      );

      if (zoneResult.rows.length > 0) {
        res.json({ success: true, data: { ...zoneResult.rows[0], strategy: 'ZONE_MATCH' } });
        return;
      }
    }

    // 4. Fallback: least utilized active location
    const fallbackResult = await pool.query(
      `SELECT l.location_id, l.location_code, l.zone, l.aisle, l.bay, l.level,
              COALESCE(SUM(i.quantity), 0) AS current_stock
       FROM wms_locations l
       LEFT JOIN wms_inventory i ON l.location_id = i.location_id
       WHERE l.warehouse_id = (SELECT warehouse_id FROM wms_warehouses WHERE code = $1)
         AND l.is_active = TRUE AND l.location_type IN ('RACK', 'FLOOR')
       GROUP BY l.location_id
       ORDER BY current_stock ASC, l.aisle, l.bay, l.level
       LIMIT 1`,
      [warehouse_code],
    );

    if (fallbackResult.rows.length > 0) {
      res.json({ success: true, data: { ...fallbackResult.rows[0], strategy: 'LEAST_UTILIZED' } });
      return;
    }

    res.json({ success: true, data: null, message: 'Uygun lokasyon bulunamadı' });
  } catch (err) {
    logger.error('[Catalog] putaway-suggest error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// ── QC Inspection ──────────────────────────────────────────────────────────
// POST /qc/inspect — Mark a serial/product as QC_PENDING, QC_PASSED, or QC_FAILED
router.post('/qc/inspect', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), async (req: Request, res: Response) => {
  try {
    const { barcode, qc_status, notes } = req.body;

    if (!barcode || !qc_status) {
      res.status(400).json({ success: false, error: 'barcode ve qc_status gerekli' });
      return;
    }

    const validStatuses = ['QC_PENDING', 'QC_PASSED', 'QC_FAILED'];
    if (!validStatuses.includes(qc_status)) {
      res.status(400).json({ success: false, error: `Geçersiz qc_status. Geçerli: ${validStatuses.join(', ')}` });
      return;
    }

    // Update serial status
    const result = await pool.query(
      `UPDATE wms_serial_numbers SET status = $1 WHERE full_barcode = $2 RETURNING *`,
      [qc_status, barcode],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ success: false, error: 'Seri numarası bulunamadı' });
      return;
    }

    // Log history
    const user = (req as unknown as { user?: { username?: string } }).user;
    await pool.query(
      `INSERT INTO serial_history (serial_id, event_type, from_status, to_status, performed_by, notes)
       VALUES ($1, 'QC_INSPECTION', $2, $3, $4, $5)`,
      [result.rows[0].serial_id, result.rows[0].status, qc_status, user?.username || 'SYSTEM', notes || null],
    );

    res.json({ success: true, data: result.rows[0], message: `QC durumu: ${qc_status}` });
  } catch (err) {
    logger.error('[QC] inspect error:', err);
    res.status(500).json({ success: false, error: 'QC inspection failed' });
  }
});

// GET /qc/pending — List items pending QC
router.get('/qc/pending', authenticateToken, async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT sn.*, p.name AS product_name
       FROM wms_serial_numbers sn
       JOIN products p ON sn.sku_code = p.product_sku
       WHERE sn.status = 'QC_PENDING'
       ORDER BY sn.created_at DESC
       LIMIT 200`,
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    logger.error('[QC] pending list error:', err);
    res.status(500).json({ success: false, error: 'Failed to list QC pending items' });
  }
});

// ── Serial Numbers ─────────────────────────────────────────────────────────
router.post('/serials/generate', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(generateSerialsSchema), serialController.generateSerialNumbers);
router.get('/serials/sku/:sku_code', authenticateToken, serialController.getSerialNumbers);
router.get('/serials/barcode/:barcode', authenticateToken, serialController.lookupSerialBarcode);
router.get('/serials/barcode/:barcode/history', authenticateToken, serialController.getSerialHistory);
router.put('/serials/barcode/:barcode', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(updateSerialStatusSchema), serialController.updateSerialStatus);
router.get('/serials/stats/:sku_code', authenticateToken, serialController.getSerialStats);

export default router;
