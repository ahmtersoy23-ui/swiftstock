// ============================================
// WAREHOUSE PLACEMENT + LOCATION + CONTAINER ROUTES — Module 2
// Rack layout, boxing, palletizing, location management
// ============================================

import { Router } from 'express';
import * as warehouseController from '../modules/warehouse/controllers/warehouse.controller';
import * as locationController from '../modules/warehouse/controllers/location.controller';
import * as containerController from '../modules/warehouse/controllers/container.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import {
  createLocationSchema,
  updateLocationSchema,
  createContainerSchema,
  openContainerSchema,
  barcodeParamSchema,
} from '../validators/schemas';

const router = Router();

// ── Warehouses (READ-ONLY config — public, no auth needed for list) ───────
router.get('/warehouses', warehouseController.getAllWarehouses);
router.get('/warehouses/:warehouse_id', authenticateToken, warehouseController.getWarehouseById);
router.get('/warehouses/code/:warehouse_code', authenticateToken, warehouseController.getWarehouseByCode);

// ── Locations ─────────────────────────────────────────────────────────────
router.get('/locations', authenticateToken, locationController.getAllLocations);
router.get('/locations/:location_id', authenticateToken, locationController.getLocationById);
router.get('/locations/code/:location_code', authenticateToken, locationController.getLocationByCode);
router.post('/locations', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(createLocationSchema), locationController.createLocation);
router.put('/locations/:location_id', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(updateLocationSchema), locationController.updateLocation);
router.delete('/locations/:location_id', authenticateToken, requireRole('ADMIN'), locationController.deleteLocation);
router.get('/locations/:location_id/inventory', authenticateToken, locationController.getLocationInventory);

// ── Containers (Koli/Palet) ───────────────────────────────────────────────
router.post('/containers', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(createContainerSchema), containerController.createContainer);
router.get('/containers', authenticateToken, containerController.getAllContainers);
router.get('/containers/:barcode', authenticateToken, validateParams(barcodeParamSchema), containerController.getContainerByBarcode);
router.post('/containers/:barcode/open', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateParams(barcodeParamSchema), validateBody(openContainerSchema), containerController.openContainer);
router.patch('/containers/:container_id/shipment', authenticateToken, requireRole('ADMIN', 'MANAGER'), containerController.linkContainerToShipment);

export default router;
