// ============================================
// CATALOG + BARCODING ROUTES — Module 1
// Products (READ-ONLY facade), Serials, Scan
// ============================================

import { Router, Request, Response } from 'express';
import * as productController from '../modules/catalog/controllers/product.controller';
import * as serialController from '../modules/catalog/controllers/serial.controller';
import * as scanController from '../modules/catalog/controllers/scan.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
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

// ── Serial Numbers ─────────────────────────────────────────────────────────
router.post('/serials/generate', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(generateSerialsSchema), serialController.generateSerialNumbers);
router.get('/serials/sku/:sku_code', authenticateToken, serialController.getSerialNumbers);
router.get('/serials/barcode/:barcode', authenticateToken, serialController.lookupSerialBarcode);
router.get('/serials/barcode/:barcode/history', authenticateToken, serialController.getSerialHistory);
router.put('/serials/barcode/:barcode', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(updateSerialStatusSchema), serialController.updateSerialStatus);
router.get('/serials/stats/:sku_code', authenticateToken, serialController.getSerialStats);

export default router;
