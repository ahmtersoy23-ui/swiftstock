// ============================================
// SCAN CONTROLLER — Module 1 (Catalog, thin wrapper)
// Barkod/QR tarama HTTP endpoint'leri. İş mantığı → scan.service.ts
// ============================================

import { Request, Response } from 'express';
import logger from '../../../config/logger';
import { scanService } from '../services/scan.service';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  logger.error(`[ScanController] ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error during scan' });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const scanCode = async (req: Request, res: Response) => {
  try {
    const { barcode, warehouse_code } = req.body;

    if (!barcode || !warehouse_code) {
      res.status(400).json({
        success: false,
        error: 'Barcode and warehouse_code are required',
      });
      return;
    }

    const result = await scanService.scanCode(barcode, warehouse_code);

    if (!result) {
      res.status(404).json({
        success: false,
        error: 'Barcode/QR code not found',
        message: `No product, container, or location found with code: ${barcode}`,
      });
      return;
    }

    if ('notFound' in result) {
      res.status(404).json({ success: false, error: result.reason });
      return;
    }

    res.json({ success: true, type: result.type, data: result.data });
  } catch (error) {
    handleError(res, error, 'scanCode');
  }
};

export const lookupBySku = async (req: Request, res: Response) => {
  try {
    const { product_sku, warehouse_code } = req.query;

    if (!product_sku || !warehouse_code) {
      res.status(400).json({
        success: false,
        error: 'sku_code and warehouse_code are required',
      });
      return;
    }

    const data = await scanService.lookupBySku(
      product_sku as string,
      warehouse_code as string,
    );

    if (!data) {
      res.status(404).json({ success: false, error: 'Product not found' });
      return;
    }

    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'lookupBySku');
  }
};
