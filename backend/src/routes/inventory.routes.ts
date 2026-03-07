// ============================================
// INVENTORY CORE ROUTES — Module 4
// Transactions, inventory summary, low-stock alerts
// ============================================

import { Router } from 'express';
import * as transactionController from '../modules/inventory-core/controllers/transaction.controller';
import * as inventoryController from '../modules/inventory-core/controllers/inventory.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import {
  createTransactionSchema,
  transactionIdParamSchema,
} from '../validators/schemas';

const router = Router();

// ── Transactions ───────────────────────────────────────────────────────────
router.post('/transactions', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(createTransactionSchema), transactionController.createTransaction);
router.get('/transactions', authenticateToken, transactionController.getRecentTransactions);
router.get('/transactions/:transaction_id', authenticateToken, validateParams(transactionIdParamSchema), transactionController.getTransactionDetails);
router.post('/transactions/:transaction_id/undo', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateParams(transactionIdParamSchema), transactionController.undoTransaction);

// ── Inventory ─────────────────────────────────────────────────────────────
router.get('/inventory', authenticateToken, inventoryController.getInventorySummary);
router.get('/inventory/sku/:sku_code', authenticateToken, inventoryController.getInventoryBySku);
router.get('/inventory/low-stock', authenticateToken, inventoryController.getLowStock);
router.get('/inventory/search', authenticateToken, inventoryController.searchInventory);

export default router;
