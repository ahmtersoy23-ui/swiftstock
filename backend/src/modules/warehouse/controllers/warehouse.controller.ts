// ============================================
// WAREHOUSE CONTROLLER — Module 2 (thin wrapper)
// Shared warehouseService kullanır (READ-ONLY, cached).
// ============================================

import { Request, Response } from 'express';
import logger from '../../../config/logger';
import { warehouseService } from '../../shared/services/warehouse.service';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  logger.error(`[WarehouseController] ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const getAllWarehouses = async (_req: Request, res: Response) => {
  try {
    const data = await warehouseService.getAllWarehouses();
    res.json({ success: true, data, message: `Found ${data.length} warehouses` });
  } catch (error) {
    handleError(res, error, 'getAllWarehouses');
  }
};

export const getWarehouseByCode = async (req: Request, res: Response) => {
  try {
    const data = await warehouseService.getByCode(req.params.warehouse_code);
    if (!data) {
      res.status(404).json({ success: false, error: 'Warehouse not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getWarehouseByCode');
  }
};

export const getWarehouseById = async (req: Request, res: Response) => {
  try {
    const data = await warehouseService.getById(Number(req.params.warehouse_id));
    if (!data) {
      res.status(404).json({ success: false, error: 'Warehouse not found' });
      return;
    }
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getWarehouseById');
  }
};
