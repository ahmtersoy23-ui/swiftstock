// ============================================
// RMA CONTROLLER — Module 7 (thin wrapper)
// Sadece req/res yönetimi. İş mantığı → rma.service.ts
// ============================================

import { Response } from 'express';
import logger from '../../../config/logger';
import { AuthRequest } from '../../../middleware/auth.middleware';
import { HTTP_STATUS, ERROR_MESSAGES } from '../../../constants';
import { rmaService, RmaError, RMAFilters, CreateRMAInput, ReceiveReturnInput } from '../services/rma.service';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof RmaError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  logger.error(`[RmaController] ${context}:`, error);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: ERROR_MESSAGES.INTERNAL_ERROR,
  });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const getAllRMAs = async (req: AuthRequest, res: Response) => {
  try {
    const result = await rmaService.getAllRMAs(req.query as RMAFilters);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, 'getAllRMAs');
  }
};

export const getRMAById = async (req: AuthRequest, res: Response) => {
  try {
    const data = await rmaService.getRMAById(req.params.rma_id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getRMAById');
  }
};

export const createRMA = async (req: AuthRequest, res: Response) => {
  const { warehouse_id, reason, items } = req.body;

  if (!warehouse_id || !reason || !items || items.length === 0) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: ERROR_MESSAGES.INVALID_REQUEST,
    });
    return;
  }

  try {
    const data = await rmaService.createRMA(
      req.body as CreateRMAInput,
      req.user?.username || 'system',
    );
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data,
      message: 'RMA talebi oluşturuldu',
    });
  } catch (error) {
    handleError(res, error, 'createRMA');
  }
};

export const approveRMA = async (req: AuthRequest, res: Response) => {
  try {
    const data = await rmaService.approveRMA(
      req.params.rma_id,
      req.body.notes,
      req.user?.username || 'system',
    );
    res.json({ success: true, data, message: 'RMA onaylandı' });
  } catch (error) {
    handleError(res, error, 'approveRMA');
  }
};

export const receiveReturn = async (req: AuthRequest, res: Response) => {
  const { quantity_received, condition } = req.body;

  if (!quantity_received || !condition) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Alınan miktar ve durum gerekli',
    });
    return;
  }

  try {
    await rmaService.receiveReturn(
      req.params.item_id,
      req.body as ReceiveReturnInput,
      req.user?.username || 'system',
    );
    res.json({ success: true, message: 'İade alındı' });
  } catch (error) {
    handleError(res, error, 'receiveReturn');
  }
};

export const completeRMA = async (req: AuthRequest, res: Response) => {
  try {
    const data = await rmaService.completeRMA(
      req.params.rma_id,
      req.body.notes,
      req.user?.username || 'system',
    );
    res.json({ success: true, data, message: 'RMA tamamlandı' });
  } catch (error) {
    handleError(res, error, 'completeRMA');
  }
};
