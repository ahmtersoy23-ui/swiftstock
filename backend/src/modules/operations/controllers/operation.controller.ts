// ============================================
// OPERATION CONTROLLER — Module 8 (thin wrapper)
// Sadece req/res yönetimi. İş mantığı → operation.service.ts
// ============================================

import { Request, Response } from 'express';
import logger from '../../../config/logger';
import { operationService, OperationError } from '../services/operation.service';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof OperationError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  logger.error(`[OperationController] ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── Operation Modes ───────────────────────────────────────────────────────────

export const getAllOperationModes = async (_req: Request, res: Response) => {
  try {
    const data = await operationService.getAllOperationModes();
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getAllOperationModes');
  }
};

export const getOperationModeByCode = async (req: Request, res: Response) => {
  try {
    const data = await operationService.getOperationModeByCode(req.params.mode_code);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getOperationModeByCode');
  }
};

// ── Scan Sessions ─────────────────────────────────────────────────────────────

export const createScanSession = async (req: Request, res: Response) => {
  const { warehouse_code, user_name, mode_type, notes } = req.body;

  if (!warehouse_code || !user_name || !mode_type) {
    res.status(400).json({
      success: false,
      error: 'warehouse_code, user_name, and mode_type are required',
    });
    return;
  }

  try {
    const data = await operationService.createScanSession({
      warehouse_code,
      user_name,
      mode_type,
      notes,
    });
    res.status(201).json({ success: true, data, message: 'Scan session created successfully' });
  } catch (error) {
    handleError(res, error, 'createScanSession');
  }
};

export const getScanSession = async (req: Request, res: Response) => {
  try {
    const data = await operationService.getScanSession(req.params.session_id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getScanSession');
  }
};

export const getActiveScanSession = async (req: Request, res: Response) => {
  const { user_name } = req.query;

  if (!user_name) {
    res.status(400).json({ success: false, error: 'user_name is required' });
    return;
  }

  try {
    const data = await operationService.getActiveScanSession(user_name as string);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getActiveScanSession');
  }
};

export const completeScanSession = async (req: Request, res: Response) => {
  try {
    const data = await operationService.completeScanSession(
      req.params.session_id,
      req.body.notes,
    );
    res.json({ success: true, data, message: 'Session completed successfully' });
  } catch (error) {
    handleError(res, error, 'completeScanSession');
  }
};

export const cancelScanSession = async (req: Request, res: Response) => {
  try {
    const data = await operationService.cancelScanSession(
      req.params.session_id,
      req.body.notes,
    );
    res.json({ success: true, data, message: 'Session cancelled successfully' });
  } catch (error) {
    handleError(res, error, 'cancelScanSession');
  }
};

// ── Scan Operations ───────────────────────────────────────────────────────────

export const addScanOperation = async (req: Request, res: Response) => {
  const { session_id, operation_type } = req.body;

  if (!session_id || !operation_type) {
    res.status(400).json({
      success: false,
      error: 'session_id and operation_type are required',
    });
    return;
  }

  try {
    const data = await operationService.addScanOperation(req.body);
    res.status(201).json({ success: true, data, message: 'Scan operation added successfully' });
  } catch (error) {
    handleError(res, error, 'addScanOperation');
  }
};

export const getSessionOperations = async (req: Request, res: Response) => {
  try {
    const data = await operationService.getSessionOperations(req.params.session_id);
    res.json({ success: true, data, message: `Found ${data.length} operations` });
  } catch (error) {
    handleError(res, error, 'getSessionOperations');
  }
};
