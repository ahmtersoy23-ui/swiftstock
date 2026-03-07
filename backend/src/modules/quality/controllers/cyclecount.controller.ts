// ============================================
// CYCLECOUNT CONTROLLER — Module 5 (thin wrapper)
// Sadece req/res yönetimi. İş mantığı → cyclecount.service.ts
// ============================================

import { Response } from 'express';
import logger from '../../../config/logger';
import { AuthRequest } from '../../../middleware/auth.middleware';
import { cycleCountService, CycleCountError } from '../services/cyclecount.service';
import { HTTP_STATUS, ERROR_MESSAGES } from '../../../constants';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof CycleCountError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  logger.error(`[CycleCountController] ${context}:`, error);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: ERROR_MESSAGES.INTERNAL_ERROR,
  });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const getAllSessions = async (req: AuthRequest, res: Response) => {
  try {
    const result = await cycleCountService.getAllSessions(req.query);
    res.json({
      success: true,
      data: result.rows,
      pagination: { limit: result.limit, offset: result.offset, total: result.rows.length },
    });
  } catch (error) {
    handleError(res, error, 'getAllSessions');
  }
};

export const getSessionById = async (req: AuthRequest, res: Response) => {
  try {
    const data = await cycleCountService.getSessionById(req.params.session_id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getSessionById');
  }
};

export const createSession = async (req: AuthRequest, res: Response) => {
  const { warehouse_id, count_type, scheduled_date, assigned_to, notes, items } = req.body;

  if (!warehouse_id || !count_type) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: ERROR_MESSAGES.INVALID_REQUEST,
    });
    return;
  }

  try {
    const data = await cycleCountService.createSession({
      warehouse_id,
      count_type,
      scheduled_date,
      assigned_to,
      notes,
      items,
      createdBy: req.user?.username ?? 'system',
    });
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data,
      message: 'Sayım oturumu oluşturuldu',
    });
  } catch (error) {
    handleError(res, error, 'createSession');
  }
};

export const startSession = async (req: AuthRequest, res: Response) => {
  try {
    const data = await cycleCountService.startSession(req.params.session_id);
    res.json({ success: true, data, message: 'Sayım başlatıldı' });
  } catch (error) {
    handleError(res, error, 'startSession');
  }
};

export const recordCount = async (req: AuthRequest, res: Response) => {
  const { counted_quantity, notes } = req.body;

  if (counted_quantity === undefined || counted_quantity === null) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'Sayılan miktar gerekli',
    });
    return;
  }

  try {
    const data = await cycleCountService.recordCount(req.params.item_id, {
      counted_quantity,
      notes,
      countedBy: req.user?.username ?? 'system',
    });
    res.json({ success: true, data, message: 'Sayım kaydedildi' });
  } catch (error) {
    handleError(res, error, 'recordCount');
  }
};

export const completeSession = async (req: AuthRequest, res: Response) => {
  const { auto_adjust = false } = req.body;

  try {
    const result = await cycleCountService.completeSession(
      req.params.session_id,
      auto_adjust,
      req.user?.user_id ?? 0,
    );
    res.json({
      success: true,
      message: `Sayım tamamlandı. ${result.adjustments_count} fark kaydı oluşturuldu${result.auto_adjusted ? ' ve envanter güncelleme kuyruğa alındı' : ''}`,
      data: result,
    });
  } catch (error) {
    handleError(res, error, 'completeSession');
  }
};
