// ============================================
// OPERATIONS ENGINE ROUTES — Module 8
// Operation modes, scan sessions, scan operations
// ============================================

import { Router } from 'express';
import * as operationController from '../modules/operations/controllers/operation.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import {
  createScanSessionSchema,
  addScanOperationSchema,
  sessionIdParamSchema,
} from '../validators/schemas';

const router = Router();

// ── Operation Modes ───────────────────────────────────────────────────────
router.get('/operation-modes', authenticateToken, operationController.getAllOperationModes);
router.get('/operation-modes/:mode_code', authenticateToken, operationController.getOperationModeByCode);

// ── Scan Sessions ─────────────────────────────────────────────────────────
router.post('/scan-sessions', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(createScanSessionSchema), operationController.createScanSession);
router.get('/scan-sessions/active', authenticateToken, operationController.getActiveScanSession);
router.get('/scan-sessions/:session_id', authenticateToken, validateParams(sessionIdParamSchema), operationController.getScanSession);
router.post('/scan-sessions/:session_id/complete', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateParams(sessionIdParamSchema), operationController.completeScanSession);
router.post('/scan-sessions/:session_id/cancel', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateParams(sessionIdParamSchema), operationController.cancelScanSession);
router.get('/scan-sessions/:session_id/operations', authenticateToken, validateParams(sessionIdParamSchema), operationController.getSessionOperations);

// ── Scan Operations ───────────────────────────────────────────────────────
router.post('/scan-operations', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateBody(addScanOperationSchema), operationController.addScanOperation);

export default router;
