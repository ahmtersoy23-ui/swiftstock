// ============================================
// INVENTORY CONTROLLER — Module 4 (Inventory Core)
// Sadece req/res yönetimi. İş mantığı → inventory.service.ts
// ============================================

import { Request, Response } from 'express';
import logger from '../../../config/logger';
import { inventoryService, InventoryError } from '../services/inventory.service';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof InventoryError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  logger.error(`[InventoryController] ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const getInventorySummary = async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.getInventorySummary(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, 'getInventorySummary');
  }
};

export const getInventoryBySku = async (req: Request, res: Response) => {
  try {
    const data = await inventoryService.getInventoryBySku(req.params.product_sku);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getInventoryBySku');
  }
};

export const getLowStock = async (req: Request, res: Response) => {
  try {
    const result = await inventoryService.getLowStock(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, 'getLowStock');
  }
};

export const searchInventory = async (req: Request, res: Response) => {
  const { query, warehouse_code } = req.query;

  if (!query) {
    res.status(400).json({ success: false, error: 'Query parameter is required' });
    return;
  }

  try {
    const data = await inventoryService.searchInventory(
      query as string,
      warehouse_code as string | undefined,
    );
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'searchInventory');
  }
};
