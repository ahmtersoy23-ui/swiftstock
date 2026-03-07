// ============================================
// REPORT CONTROLLER — Module 5 (thin wrapper)
// Sadece req/res yönetimi. İş mantığı → report.service.ts
// ============================================

import { Response } from 'express';
import logger from '../../../config/logger';
import { AuthRequest } from '../../../middleware/auth.middleware';
import { reportService, ReportError } from '../services/report.service';
import { HTTP_STATUS, ERROR_MESSAGES } from '../../../constants';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof ReportError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  logger.error(`[ReportController] ${context}:`, error);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
    success: false,
    error: ERROR_MESSAGES.INTERNAL_ERROR,
  });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const saveCountReport = async (req: AuthRequest, res: Response) => {
  const { warehouse_id, warehouse_code, locations, notes } = req.body;

  if (!warehouse_id || !warehouse_code || !locations || locations.length === 0) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      error: 'warehouse_id, warehouse_code ve locations gerekli',
    });
    return;
  }

  try {
    const data = await reportService.saveCountReport({
      warehouse_id,
      warehouse_code,
      locations,
      notes,
      createdBy: req.user?.username ?? 'system',
    });
    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data,
      message: `Sayım raporu kaydedildi: ${data.report_number}`,
    });
  } catch (error) {
    handleError(res, error, 'saveCountReport');
  }
};

export const getAllCountReports = async (req: AuthRequest, res: Response) => {
  try {
    const result = await reportService.getAllCountReports(req.query);
    res.json({
      success: true,
      data: result.rows,
      pagination: { limit: result.limit, offset: result.offset, total: result.total },
    });
  } catch (error) {
    handleError(res, error, 'getAllCountReports');
  }
};

export const getCountReportById = async (req: AuthRequest, res: Response) => {
  try {
    const data = await reportService.getCountReportById(req.params.report_id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getCountReportById');
  }
};

export const getInventoryReport = async (req: AuthRequest, res: Response) => {
  const { warehouse_id } = req.params;

  if (!warehouse_id) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({ success: false, error: 'warehouse_id gerekli' });
    return;
  }

  try {
    const data = await reportService.getInventoryReport(
      warehouse_id,
      req.query.group_by as string | undefined,
    );
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getInventoryReport');
  }
};

export const deleteCountReport = async (req: AuthRequest, res: Response) => {
  try {
    await reportService.deleteCountReport(req.params.report_id);
    res.json({ success: true, message: 'Rapor silindi' });
  } catch (error) {
    handleError(res, error, 'deleteCountReport');
  }
};
