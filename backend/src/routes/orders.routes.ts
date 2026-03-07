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

export default router;
