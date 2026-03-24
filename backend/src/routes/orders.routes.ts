// ============================================
// ORDER FULFILLMENT ROUTES — Module 3
// Shipment orders, picking workflow, picker performance
// ============================================

import { Router } from 'express';
import * as orderController from '../modules/orders/controllers/order.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import {
  createOrderSchema,
  assignPickerSchema,
  recordPickSchema,
  cancelOrderSchema,
  orderIdParamSchema,
} from '../validators/schemas';

const router = Router();

// ── Orders ────────────────────────────────────────────────────────────────
router.get('/orders', authenticateToken, orderController.getAllOrders);
router.get('/orders/:order_id', authenticateToken, validateParams(orderIdParamSchema), orderController.getOrderById);
router.post('/orders', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(createOrderSchema), orderController.createOrder);

// ── Picking Workflow ───────────────────────────────────────────────────────
router.post('/orders/:order_id/assign-picker', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateParams(orderIdParamSchema), validateBody(assignPickerSchema), orderController.assignPicker);
router.post('/orders/:order_id/start-picking', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateParams(orderIdParamSchema), orderController.startPicking);
router.post('/orders/:order_id/record-pick', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateParams(orderIdParamSchema), validateBody(recordPickSchema), orderController.recordPick);
router.post('/orders/:order_id/complete-picking', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateParams(orderIdParamSchema), orderController.completePicking);
router.post('/orders/:order_id/cancel', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateParams(orderIdParamSchema), validateBody(cancelOrderSchema), orderController.cancelOrder);

// ── Picker Performance ─────────────────────────────────────────────────────
router.get('/orders/picker/:picker_id/performance', authenticateToken, orderController.getPickerPerformance);

// ── Wave / Batch Picking ──────────────────────────────────────────────────
// POST /orders/wave — Create a pick wave from multiple PENDING/READY_TO_PICK orders
router.post('/orders/wave', authenticateToken, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const pool = (await import('../config/database')).default;
  const logger = (await import('../config/logger')).default;

  try {
    const { order_ids, wave_name } = req.body;

    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      res.status(400).json({ success: false, error: 'order_ids (array) gerekli' });
      return;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Ensure wave table exists
      await client.query(`
        CREATE TABLE IF NOT EXISTS wms_pick_waves (
          wave_id SERIAL PRIMARY KEY,
          wave_name VARCHAR(100),
          status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
          total_orders INTEGER NOT NULL DEFAULT 0,
          total_items INTEGER NOT NULL DEFAULT 0,
          created_by VARCHAR(100),
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          completed_at TIMESTAMP
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS wms_pick_wave_orders (
          wave_order_id SERIAL PRIMARY KEY,
          wave_id INTEGER NOT NULL,
          order_id INTEGER NOT NULL
        )
      `);

      // Validate all orders are in eligible status
      const ordersResult = await client.query(
        `SELECT order_id, order_number, status FROM shipment_orders WHERE order_id = ANY($1)`,
        [order_ids],
      );

      const ineligible = ordersResult.rows.filter(
        (o: { status: string }) => !['PENDING', 'READY_TO_PICK'].includes(o.status)
      );
      if (ineligible.length > 0) {
        await client.query('ROLLBACK');
        res.status(400).json({
          success: false,
          error: `Uygun olmayan siparişler: ${ineligible.map((o: { order_number: string }) => o.order_number).join(', ')}`,
        });
        return;
      }

      // Count total items
      const itemsResult = await client.query(
        `SELECT COUNT(*) AS total FROM shipment_order_items WHERE order_id = ANY($1)`,
        [order_ids],
      );

      // Create wave
      const user = (req as unknown as { user?: { username?: string } }).user;
      const waveResult = await client.query(
        `INSERT INTO wms_pick_waves (wave_name, total_orders, total_items, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          wave_name || `WAVE-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Date.now().toString().slice(-4)}`,
          order_ids.length,
          parseInt(itemsResult.rows[0].total),
          user?.username || 'SYSTEM',
        ],
      );
      const wave = waveResult.rows[0];

      // Link orders to wave
      for (const orderId of order_ids) {
        await client.query(
          'INSERT INTO wms_pick_wave_orders (wave_id, order_id) VALUES ($1, $2)',
          [wave.wave_id, orderId],
        );
      }

      // Update order statuses to READY_TO_PICK
      await client.query(
        `UPDATE shipment_orders SET status = 'READY_TO_PICK', updated_at = CURRENT_TIMESTAMP
         WHERE order_id = ANY($1) AND status = 'PENDING'`,
        [order_ids],
      );

      await client.query('COMMIT');

      // Return wave with consolidated pick list (sorted by location for optimal path)
      const pickList = await pool.query(
        `SELECT soi.product_sku, soi.product_name, soi.location_code,
                l.aisle, l.bay, l.level,
                SUM(soi.quantity_ordered) AS total_quantity,
                COUNT(DISTINCT soi.order_id) AS order_count,
                array_agg(DISTINCT so.order_number) AS order_numbers
         FROM shipment_order_items soi
         JOIN shipment_orders so ON soi.order_id = so.order_id
         LEFT JOIN wms_locations l ON soi.location_id = l.location_id
         WHERE soi.order_id = ANY($1)
         GROUP BY soi.product_sku, soi.product_name, soi.location_code, l.aisle, l.bay, l.level
         ORDER BY l.aisle NULLS LAST, l.bay NULLS LAST, l.level NULLS LAST`,
        [order_ids],
      );

      res.status(201).json({
        success: true,
        data: {
          wave,
          pick_list: pickList.rows,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('[Orders] wave creation error:', error);
    res.status(500).json({ success: false, error: 'Failed to create pick wave' });
  }
});

export default router;
