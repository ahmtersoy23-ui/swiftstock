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
  const { container_type, warehouse_code, items, contents, created_by, display_name, shipment_id } = req.body;
  const containerItems = items || contents || [];

  if (!container_type || !warehouse_code || !created_by) {
    res.status(400).json({
      success: false,
      error: 'container_type, warehouse_code, and created_by are required',
    });
    return;
  }

  try {
    const data = await containerService.createContainer({
      container_type,
      warehouse_code,
      items: containerItems,
      created_by,
      display_name: display_name || undefined,
      shipment_id: shipment_id ? Number(shipment_id) : undefined,
      notes: req.body.notes,
      parent_container_id: req.body.parent_container_id,
    });
    res.json({
      success: true,
      data,
      message: `Container ${data.barcode} olusturuldu`,
    });
  } catch (error) {
    handleError(res, error, 'createContainer');
  }
};

export const linkContainerToShipment = async (req: Request, res: Response) => {
  const container_id = parseInt(req.params.container_id);
  const { shipment_id } = req.body;

  if (isNaN(container_id)) {
    res.status(400).json({ success: false, error: 'Gecersiz container_id' });
    return;
  }

  try {
    const data = await containerService.linkContainerToShipment(
      container_id,
      shipment_id === null || shipment_id === undefined ? null : Number(shipment_id),
    );
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'linkContainerToShipment');
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

export const breakContainer = async (req: AuthRequest, res: Response) => {
  const container_id = parseInt(req.params.container_id);
  const { product_sku } = req.body;

  if (isNaN(container_id) || !product_sku) {
    res.status(400).json({ success: false, error: 'container_id ve product_sku gereklidir' });
    return;
  }

  try {
    const data = await containerService.breakContainer(
      container_id,
      product_sku,
      req.user?.user_id ?? 0,
    );
    res.json({
      success: true,
      data,
      message: `Container ${data.container_barcode} dağıtıldı. ${data.remaining_items} kalan ürün stoka kaydedildi.`,
    });
  } catch (error) {
    handleError(res, error, 'breakContainer');
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
