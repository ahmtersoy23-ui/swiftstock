import { Router } from 'express';
import * as scanController from '../controllers/scan.controller';
import * as transactionController from '../controllers/transaction.controller';
import * as inventoryController from '../controllers/inventory.controller';
import * as productController from '../controllers/product.controller';
import * as containerController from '../controllers/container.controller';
import * as locationController from '../controllers/location.controller';
import * as operationController from '../controllers/operation.controller';
import * as warehouseController from '../controllers/warehouse.controller';
import * as authController from '../controllers/auth.controller';
import * as userController from '../controllers/user.controller';
import * as orderController from '../controllers/order.controller';
import * as cyclecountController from '../controllers/cyclecount.controller';
import * as rmaController from '../controllers/rma.controller';
import * as serialController from '../controllers/serial.controller';
import * as reportController from '../controllers/report.controller';
import * as shipmentController from '../controllers/shipment.controller';
import { authenticateToken, optionalAuth, requireRole } from '../middleware/auth.middleware';
import {
  loginRateLimiter,
  passwordRateLimiter,
  refreshTokenRateLimiter,
} from '../middleware/rateLimiter.middleware';
import { validateBody } from '../middleware/validate.middleware';
import {
  loginSchema,
  changePasswordSchema,
  refreshTokenSchema,
  createUserSchema,
  updateUserSchema,
  resetPasswordSchema,
  createProductSchema,
  updateProductSchema,
  createTransactionSchema,
  createLocationSchema,
  updateLocationSchema,
  createContainerSchema,
  openContainerSchema,
  scanSchema,
  createScanSessionSchema,
  addScanOperationSchema,
  generateSerialsSchema,
  updateSerialStatusSchema,
} from '../validators/schemas';

const router = Router();

// ============================================
// AUTHENTICATION ROUTES (Public)
// ============================================
// Local login removed (Phase 3) — SSO-only authentication via Google OAuth
router.post('/auth/google', loginRateLimiter, authController.googleLogin);
router.post('/auth/logout', optionalAuth, authController.logout);
router.post('/auth/refresh', refreshTokenRateLimiter, validateBody(refreshTokenSchema), authController.refreshAccessToken);
router.get('/auth/profile', authenticateToken, authController.getProfile);
router.post('/auth/change-password', authenticateToken, passwordRateLimiter, validateBody(changePasswordSchema), authController.changePassword);

// ============================================
// USER MANAGEMENT ROUTES (Protected)
// ============================================
router.get('/users', authenticateToken, requireRole('ADMIN', 'MANAGER'), userController.getAllUsers);
router.get('/users/:user_id', authenticateToken, requireRole('ADMIN', 'MANAGER'), userController.getUserById);
router.post('/users', authenticateToken, requireRole('ADMIN'), validateBody(createUserSchema), userController.createUser);
router.put('/users/:user_id', authenticateToken, requireRole('ADMIN'), validateBody(updateUserSchema), userController.updateUser);
router.delete('/users/:user_id', authenticateToken, requireRole('ADMIN'), userController.deleteUser);
router.post('/users/:user_id/reset-password', authenticateToken, requireRole('ADMIN'), validateBody(resetPasswordSchema), userController.resetUserPassword);
router.get('/users/:user_id/audit-logs', authenticateToken, requireRole('ADMIN', 'MANAGER'), userController.getUserAuditLogs);

// ============================================
// SHIPMENT ORDERS ROUTES (USA Warehouse)
// ============================================
router.get('/orders', authenticateToken, orderController.getAllOrders);
router.get('/orders/:order_id', authenticateToken, orderController.getOrderById);
router.post('/orders', authenticateToken, requireRole('ADMIN', 'MANAGER'), orderController.createOrder);
router.post('/orders/:order_id/assign-picker', authenticateToken, requireRole('ADMIN', 'MANAGER'), orderController.assignPicker);
router.post('/orders/:order_id/start-picking', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), orderController.startPicking);
router.post('/orders/:order_id/record-pick', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), orderController.recordPick);
router.post('/orders/:order_id/complete-picking', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), orderController.completePicking);
router.post('/orders/:order_id/cancel', authenticateToken, requireRole('ADMIN', 'MANAGER'), orderController.cancelOrder);
router.get('/orders/picker/:picker_id/performance', authenticateToken, orderController.getPickerPerformance);

// ============================================
// SCAN ROUTES
// ============================================
router.post('/scan', authenticateToken, validateBody(scanSchema), scanController.scanCode);
router.get('/lookup', authenticateToken, scanController.lookupBySku);

// ============================================
// TRANSACTION ROUTES
// ============================================
router.post('/transactions', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(createTransactionSchema), transactionController.createTransaction);
router.get('/transactions', authenticateToken, transactionController.getRecentTransactions);
router.get('/transactions/:transaction_id', authenticateToken, transactionController.getTransactionDetails);
router.post('/transactions/:transaction_id/undo', authenticateToken, requireRole('ADMIN', 'MANAGER'), transactionController.undoTransaction);

// ============================================
// INVENTORY ROUTES
// ============================================
router.get('/inventory', authenticateToken, inventoryController.getInventorySummary);
router.get('/inventory/sku/:sku_code', authenticateToken, inventoryController.getInventoryBySku);
router.get('/inventory/low-stock', authenticateToken, inventoryController.getLowStock);
router.get('/inventory/search', authenticateToken, inventoryController.searchInventory);

// ============================================
// PRODUCT ROUTES
// ============================================
router.get('/products', authenticateToken, productController.getAllProducts);
router.get('/products/search', authenticateToken, productController.searchProducts);  // ← search, /:sku_code'dan ÖNCE olmalı
router.get('/products/:sku_code', authenticateToken, productController.getProductBySku);
router.post('/products', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(createProductSchema), productController.createProduct);
router.put('/products/:sku_code', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(updateProductSchema), productController.updateProduct);
router.delete('/products/:sku_code', authenticateToken, requireRole('ADMIN'), productController.deleteProduct);

// ============================================
// CONTAINER ROUTES (Koli/Palet)
// ============================================
router.post('/containers', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(createContainerSchema), containerController.createContainer);
router.get('/containers', authenticateToken, containerController.getAllContainers);
router.get('/containers/:barcode', authenticateToken, containerController.getContainerByBarcode);
router.post('/containers/:barcode/open', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(openContainerSchema), containerController.openContainer);

// ============================================
// WAREHOUSE ROUTES
// ============================================
router.get('/warehouses', authenticateToken, warehouseController.getAllWarehouses);
router.get('/warehouses/:warehouse_id', authenticateToken, warehouseController.getWarehouseById);
router.get('/warehouses/code/:warehouse_code', authenticateToken, warehouseController.getWarehouseByCode);

// ============================================
// LOCATION ROUTES
// ============================================
router.get('/locations', authenticateToken, locationController.getAllLocations);
router.get('/locations/:location_id', authenticateToken, locationController.getLocationById);
router.get('/locations/code/:location_code', authenticateToken, locationController.getLocationByCode);
router.post('/locations', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(createLocationSchema), locationController.createLocation);
router.put('/locations/:location_id', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(updateLocationSchema), locationController.updateLocation);
router.delete('/locations/:location_id', authenticateToken, requireRole('ADMIN'), locationController.deleteLocation);
router.get('/locations/:location_id/inventory', authenticateToken, locationController.getLocationInventory);

// ============================================
// OPERATION MODE ROUTES
// ============================================
router.get('/operation-modes', authenticateToken, operationController.getAllOperationModes);
router.get('/operation-modes/:mode_code', authenticateToken, operationController.getOperationModeByCode);

// ============================================
// SCAN SESSION ROUTES
// ============================================
router.post('/scan-sessions', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(createScanSessionSchema), operationController.createScanSession);
router.get('/scan-sessions/active', authenticateToken, operationController.getActiveScanSession);
router.get('/scan-sessions/:session_id', authenticateToken, operationController.getScanSession);
router.post('/scan-sessions/:session_id/complete', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), operationController.completeScanSession);
router.post('/scan-sessions/:session_id/cancel', authenticateToken, requireRole('ADMIN', 'MANAGER'), operationController.cancelScanSession);
router.get('/scan-sessions/:session_id/operations', authenticateToken, operationController.getSessionOperations);

// ============================================
// SCAN OPERATION ROUTES
// ============================================
router.post('/scan-operations', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(addScanOperationSchema), operationController.addScanOperation);

// ============================================
// CYCLE COUNT ROUTES
// ============================================
router.get('/cycle-counts', authenticateToken, cyclecountController.getAllSessions);
router.get('/cycle-counts/:session_id', authenticateToken, cyclecountController.getSessionById);
router.post('/cycle-counts', authenticateToken, requireRole('ADMIN', 'MANAGER'), cyclecountController.createSession);
router.post('/cycle-counts/:session_id/start', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), cyclecountController.startSession);
router.post('/cycle-counts/items/:item_id/count', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), cyclecountController.recordCount);
router.post('/cycle-counts/:session_id/complete', authenticateToken, requireRole('ADMIN', 'MANAGER'), cyclecountController.completeSession);

// ============================================
// RETURNS/RMA ROUTES
// ============================================
router.get('/rma', authenticateToken, rmaController.getAllRMAs);
router.get('/rma/:rma_id', authenticateToken, rmaController.getRMAById);
router.post('/rma', authenticateToken, requireRole('ADMIN', 'MANAGER'), rmaController.createRMA);
router.post('/rma/:rma_id/approve', authenticateToken, requireRole('ADMIN', 'MANAGER'), rmaController.approveRMA);
router.post('/rma/items/:item_id/receive', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), rmaController.receiveReturn);
router.post('/rma/:rma_id/complete', authenticateToken, requireRole('ADMIN', 'MANAGER'), rmaController.completeRMA);

// ============================================
// SERIAL NUMBER ROUTES
// ============================================
router.post('/serials/generate', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(generateSerialsSchema), serialController.generateSerialNumbers);
router.get('/serials/sku/:sku_code', authenticateToken, serialController.getSerialNumbers);
router.get('/serials/barcode/:barcode', authenticateToken, serialController.lookupSerialBarcode);
router.get('/serials/barcode/:barcode/history', authenticateToken, serialController.getSerialHistory);
router.put('/serials/barcode/:barcode', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(updateSerialStatusSchema), serialController.updateSerialStatus);
router.get('/serials/stats/:sku_code', authenticateToken, serialController.getSerialStats);

// ============================================
// REPORT ROUTES
// ============================================
router.post('/reports/count', authenticateToken, reportController.saveCountReport);
router.get('/reports/count', authenticateToken, reportController.getAllCountReports);
router.get('/reports/count/:report_id', authenticateToken, reportController.getCountReportById);
router.delete('/reports/count/:report_id', authenticateToken, requireRole('ADMIN', 'MANAGER'), reportController.deleteCountReport);
router.get('/reports/inventory/:warehouse_id', authenticateToken, reportController.getInventoryReport);

// ============================================
// VIRTUAL SHIPMENT ROUTES (Sevkiyat)
// ============================================
router.get('/shipments', authenticateToken, shipmentController.getAllShipments);
router.get('/shipments/:shipment_id', authenticateToken, shipmentController.getShipmentById);
router.post('/shipments', authenticateToken, requireRole('ADMIN', 'MANAGER'), shipmentController.createShipment);
router.post('/shipments/:shipment_id/boxes', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), shipmentController.createBox);
router.get('/shipments/:shipment_id/boxes', authenticateToken, shipmentController.getShipmentBoxes);
router.post('/shipments/:shipment_id/close', authenticateToken, requireRole('ADMIN', 'MANAGER'), shipmentController.closeShipment);
router.post('/shipments/:shipment_id/ship', authenticateToken, requireRole('ADMIN', 'MANAGER'), shipmentController.shipShipment);

// Box operations
router.get('/boxes/:barcode', authenticateToken, shipmentController.getBoxByBarcode);
router.post('/boxes/:box_id/items', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), shipmentController.addItemToBox);
router.delete('/boxes/contents/:content_id', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), shipmentController.removeItemFromBox);
router.post('/boxes/:box_id/close', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), shipmentController.closeBox);
router.put('/boxes/:box_id/destination', authenticateToken, requireRole('ADMIN', 'MANAGER'), shipmentController.updateBoxDestination);

// ============================================
// HEALTH CHECK
// ============================================
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'WMS API is running',
    timestamp: new Date().toISOString(),
  });
});

export default router;
