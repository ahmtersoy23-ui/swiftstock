// ============================================
// CYCLE COUNT + REPORTS ROUTES — Module 5
// Inventory counting sessions, count reports
// ============================================

import { Router } from 'express';
import * as cyclecountController from '../controllers/cyclecount.controller';
import * as reportController from '../controllers/report.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import {
  createCycleCountSchema,
  recordCountSchema,
  saveCountReportSchema,
  sessionIdParamSchema,
  itemIdParamSchema,
} from '../validators/schemas';

const router = Router();

// ── Cycle Count Sessions ───────────────────────────────────────────────────
router.get('/cycle-counts', authenticateToken, cyclecountController.getAllSessions);
router.get('/cycle-counts/:session_id', authenticateToken, validateParams(sessionIdParamSchema), cyclecountController.getSessionById);
router.post('/cycle-counts', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(createCycleCountSchema), cyclecountController.createSession);
router.post('/cycle-counts/:session_id/start', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateParams(sessionIdParamSchema), cyclecountController.startSession);
router.post('/cycle-counts/items/:item_id/count', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateParams(itemIdParamSchema), validateBody(recordCountSchema), cyclecountController.recordCount);
router.post('/cycle-counts/:session_id/complete', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateParams(sessionIdParamSchema), cyclecountController.completeSession);

// ── Reports ───────────────────────────────────────────────────────────────
router.post('/reports/count', authenticateToken, validateBody(saveCountReportSchema), reportController.saveCountReport);
router.get('/reports/count', authenticateToken, reportController.getAllCountReports);
router.get('/reports/count/:report_id', authenticateToken, reportController.getCountReportById);
router.delete('/reports/count/:report_id', authenticateToken, requireRole('ADMIN', 'MANAGER'), reportController.deleteCountReport);
router.get('/reports/inventory/:warehouse_id', authenticateToken, reportController.getInventoryReport);

export default router;
