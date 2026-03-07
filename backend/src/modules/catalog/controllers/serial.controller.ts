// ============================================
// SERIAL CONTROLLER — Module 1 (Catalog, thin wrapper)
// Seri numarası HTTP endpoint'leri. İş mantığı → serial.service.ts
// ============================================

import { Request, Response } from 'express';
import logger from '../../../config/logger';
import { serialService, CatalogError } from '../services/serial.service';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof CatalogError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  logger.error(`[SerialController] ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const generateSerialNumbers = async (req: Request, res: Response) => {
  const { product_sku, quantity } = req.body;

  if (!product_sku || !quantity || quantity < 1) {
    res.status(400).json({
      success: false,
      error: 'sku_code and quantity (>= 1) are required',
    });
    return;
  }

  if (quantity > 1000) {
    res.status(400).json({
      success: false,
      error: 'Maximum 1000 serial numbers per request',
    });
    return;
  }

  try {
    const data = await serialService.generateSerialNumbers(product_sku, quantity);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'generateSerialNumbers');
  }
};

export const getSerialNumbers = async (req: Request, res: Response) => {
  try {
    const { sku_code } = req.params;
    const { status, limit = 100, offset = 0 } = req.query;

    const result = await serialService.getSerialNumbers(sku_code, {
      status: status as string | undefined,
      limit: limit as string | number,
      offset: offset as string | number,
    });

    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, 'getSerialNumbers');
  }
};

export const lookupSerialBarcode = async (req: Request, res: Response) => {
  try {
    const data = await serialService.lookupSerialBarcode(req.params.barcode);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'lookupSerialBarcode');
  }
};

export const updateSerialStatus = async (req: Request, res: Response) => {
  const { barcode } = req.params;
  const { status, warehouse_id, location_id, transaction_id } = req.body;

  const validStatuses = ['AVAILABLE', 'IN_STOCK', 'SHIPPED', 'USED'];
  if (!validStatuses.includes(status)) {
    res.status(400).json({
      success: false,
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
    });
    return;
  }

  try {
    const data = await serialService.updateSerialStatus(barcode, {
      status,
      warehouse_id: warehouse_id || null,
      location_id: location_id || null,
      transaction_id: transaction_id || null,
    });
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'updateSerialStatus');
  }
};

export const getSerialStats = async (req: Request, res: Response) => {
  try {
    const data = await serialService.getSerialStats(req.params.sku_code);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getSerialStats');
  }
};

export const getSerialHistory = async (req: Request, res: Response) => {
  try {
    const data = await serialService.getSerialHistory(req.params.barcode);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getSerialHistory');
  }
};
