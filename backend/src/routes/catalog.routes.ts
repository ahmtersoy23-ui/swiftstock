// ============================================
// CATALOG + BARCODING ROUTES — Module 1
// Products (READ-ONLY facade), Serials, Scan
// ============================================

import { Router } from 'express';
import * as productController from '../controllers/product.controller';
import * as serialController from '../controllers/serial.controller';
import * as scanController from '../controllers/scan.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validateBody } from '../middleware/validate.middleware';
import {
  createProductSchema,
  updateProductSchema,
  scanSchema,
  generateSerialsSchema,
  updateSerialStatusSchema,
} from '../validators/schemas';

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

// ── Serial Numbers ─────────────────────────────────────────────────────────
router.post('/serials/generate', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(generateSerialsSchema), serialController.generateSerialNumbers);
router.get('/serials/sku/:sku_code', authenticateToken, serialController.getSerialNumbers);
router.get('/serials/barcode/:barcode', authenticateToken, serialController.lookupSerialBarcode);
router.get('/serials/barcode/:barcode/history', authenticateToken, serialController.getSerialHistory);
router.put('/serials/barcode/:barcode', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(updateSerialStatusSchema), serialController.updateSerialStatus);
router.get('/serials/stats/:sku_code', authenticateToken, serialController.getSerialStats);

export default router;
