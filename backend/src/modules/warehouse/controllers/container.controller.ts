// ============================================
// CONTAINER CONTROLLER — Module 2 (thin wrapper)
// Sadece req/res yönetimi. İş mantığı → container.service.ts
// ============================================

import { Request, Response } from 'express';
import logger from '../../../config/logger';
import { AuthRequest } from '../../../middleware/auth.middleware';
import { containerService, ContainerError } from '../services/container.service';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof ContainerError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  logger.error(`[ContainerController] ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const createContainer = async (req: Request, res: Response) => {
  const { container_type, warehouse_code, items, contents, created_by } = req.body;
  const containerItems = items || contents;

  if (!container_type || !warehouse_code || !containerItems || containerItems.length === 0 || !created_by) {
    res.status(400).json({
      success: false,
      error: 'container_type, warehouse_code, items (or contents), and created_by are required',
    });
    return;
  }

  try {
    const data = await containerService.createContainer({
      container_type,
      warehouse_code,
      items: containerItems,
      created_by,
      notes: req.body.notes,
      parent_container_id: req.body.parent_container_id,
    });
    res.json({
      success: true,
      data,
      message: `Container ${data.barcode} created successfully`,
    });
  } catch (error) {
    handleError(res, error, 'createContainer');
  }
};

export const getContainerByBarcode = async (req: Request, res: Response) => {
  try {
    const data = await containerService.getContainerByBarcode(req.params.barcode);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getContainerByBarcode');
  }
};

export const getAllContainers = async (req: Request, res: Response) => {
  try {
    const result = await containerService.getAllContainers(req.query);
    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages: Math.ceil(result.total / result.limit),
      },
    });
  } catch (error) {
    handleError(res, error, 'getAllContainers');
  }
};

export const openContainer = async (req: AuthRequest, res: Response) => {
  const { location_qr, created_by } = req.body;

  if (!created_by) {
    res.status(400).json({ success: false, error: 'created_by is required' });
    return;
  }

  try {
    const data = await containerService.openContainer(
      req.params.barcode,
      location_qr,
      req.user?.user_id ?? 0,
    );
    res.json({
      success: true,
      message: `Container ${req.params.barcode} opened successfully`,
      data,
    });
  } catch (error) {
    handleError(res, error, 'openContainer');
  }
};
