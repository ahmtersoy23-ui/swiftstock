// ============================================
// TRANSACTION CONTROLLER — Module 4 (Inventory Core)
// Sadece req/res yönetimi. İş mantığı → transaction.service.ts
// ============================================

import { Request, Response } from 'express';
import logger from '../../../config/logger';
import { transactionService, TransactionError } from '../services/transaction.service';
import { TransactionCreateRequest } from '../../../types';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof TransactionError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  logger.error(`[TransactionController] ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const createTransaction = async (req: Request, res: Response) => {
  // body is validated by createTransactionSchema (single-item fields)
  // Service expects items[]. Wrap single item into array for HTTP callers.
  const body = req.body as Record<string, unknown>;
  try {
    const result = await transactionService.createTransaction({
      transaction_type: body.transaction_type as string,
      warehouse_code: body.warehouse_code as string | undefined,
      location_qr: body.location_qr as string | undefined,
      items: (body.items as TransactionCreateRequest['items'] | undefined) ?? [
        {
          product_sku: body.sku_code as string,
          quantity: body.quantity as number,
          unit_type: (body.unit_type as string | undefined) ?? 'EACH',
        },
      ],
      reference_no: (body.reference_number ?? body.reference_no) as string | undefined,
      notes: body.notes as string | undefined,
      created_by: body.created_by as string | undefined,
      device_id: body.device_id as string | undefined,
    });
    res.status(201).json({
      success: true,
      data: result,
      message: `Transaction ${body.transaction_type} completed successfully`,
    });
  } catch (error) {
    handleError(res, error, 'createTransaction');
  }
};

export const getRecentTransactions = async (req: Request, res: Response) => {
  try {
    const data = await transactionService.getRecentTransactions(req.query);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getRecentTransactions');
  }
};

export const getTransactionDetails = async (req: Request, res: Response) => {
  try {
    const data = await transactionService.getTransactionDetails(req.params.transaction_id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getTransactionDetails');
  }
};

export const undoTransaction = async (req: Request, res: Response) => {
  try {
    const data = await transactionService.undoTransaction(
      req.params.transaction_id,
      req.body.user,
    );
    res.json({ success: true, data, message: 'Transaction undone successfully' });
  } catch (error) {
    handleError(res, error, 'undoTransaction');
  }
};
