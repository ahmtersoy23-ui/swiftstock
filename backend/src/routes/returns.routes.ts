// ============================================
// RETURNS / RMA ROUTES — Module 7
// Return Merchandise Authorization workflow
// Coupling: 3/10 — second easiest to extract
// ============================================

import { Router } from 'express';
import * as rmaController from '../modules/returns/controllers/rma.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import {
  createRMASchema,
  approveRMASchema,
  receiveReturnSchema,
  rmaIdParamSchema,
  itemIdParamSchema,
} from '../validators/schemas';

const router = Router();

// ── RMA ───────────────────────────────────────────────────────────────────
router.get('/rma', authenticateToken, rmaController.getAllRMAs);
router.get('/rma/:rma_id', authenticateToken, validateParams(rmaIdParamSchema), rmaController.getRMAById);
router.post('/rma', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateBody(createRMASchema), rmaController.createRMA);
router.post('/rma/:rma_id/approve', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateParams(rmaIdParamSchema), validateBody(approveRMASchema), rmaController.approveRMA);
router.post('/rma/items/:item_id/receive', authenticateToken, requireRole('ADMIN', 'MANAGER', 'OPERATOR'), validateParams(itemIdParamSchema), validateBody(receiveReturnSchema), rmaController.receiveReturn);
router.post('/rma/:rma_id/complete', authenticateToken, requireRole('ADMIN', 'MANAGER'), validateParams(rmaIdParamSchema), rmaController.completeRMA);

export default router;
