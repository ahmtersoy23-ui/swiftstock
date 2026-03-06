// ============================================
// VIRTUAL SHIPMENT ROUTES — Module 6
// Sevkiyat, boxes, box contents
// Coupling: 2/10 — pilot module (easiest to extract)
// ============================================

import { Router } from 'express';
import * as shipmentController from '../controllers/shipment.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import {
  createShipmentSchema,
  createBoxSchema,
  addItemToBoxSchema,
  updateBoxDestinationSchema,
  shipShipmentSchema,
  shipmentIdParamSchema,
  boxIdParamSchema,
  barcodeParamSchema,
} from '../validators/schemas';

const router = Router();

// ── Shipments ─────────────────────────────────────────────────────────────
router.get('/shipments', authenticateToken, shipmentController.getAllShipments);
router.get('/shipments/:shipment_id', authenticateToken, validateParams(shipmentIdParamSchema), shipmentController.getShipmentById);
router.post('/shipments', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(createShipmentSchema), shipmentController.createShipment);
router.get('/shipments/:shipment_id/boxes', authenticateToken, validateParams(shipmentIdParamSchema), shipmentController.getShipmentBoxes);
router.post('/shipments/:shipment_id/boxes', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateParams(shipmentIdParamSchema), validateBody(createBoxSchema), shipmentController.createBox);
router.post('/shipments/:shipment_id/close', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateParams(shipmentIdParamSchema), shipmentController.closeShipment);
router.post('/shipments/:shipment_id/ship', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateParams(shipmentIdParamSchema), validateBody(shipShipmentSchema), shipmentController.shipShipment);

// ── Boxes ─────────────────────────────────────────────────────────────────
router.get('/boxes/:barcode', authenticateToken, validateParams(barcodeParamSchema), shipmentController.getBoxByBarcode);
router.post('/boxes/:box_id/items', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateParams(boxIdParamSchema), validateBody(addItemToBoxSchema), shipmentController.addItemToBox);
router.delete('/boxes/contents/:content_id', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), shipmentController.removeItemFromBox);
router.post('/boxes/:box_id/close', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateParams(boxIdParamSchema), shipmentController.closeBox);
router.put('/boxes/:box_id/destination', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateParams(boxIdParamSchema), validateBody(updateBoxDestinationSchema), shipmentController.updateBoxDestination);

export default router;
