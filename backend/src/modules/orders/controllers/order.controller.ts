// ============================================
// ORDER CONTROLLER — Module 3 (thin wrapper)
// Sadece req/res yönetimi. İş mantığı → order.service.ts
// ============================================

import { Response } from 'express';
import logger from '../../../config/logger';
import { AuthRequest } from '../../../middleware/auth.middleware';
import { orderService, OrderError } from '../services/order.service';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof OrderError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  logger.error(`[OrderController] ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── Orders ────────────────────────────────────────────────────────────────────

export const getAllOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const result = await orderService.getAllOrders(req.query);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, 'getAllOrders');
  }
};

export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await orderService.getOrderById(req.params.order_id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getOrderById');
  }
};

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const { order_number, warehouse_code, customer_name, items = [] } = req.body;

  if (!order_number || !warehouse_code || !customer_name || items.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Sipariş numarası, depo, müşteri adı ve ürünler gereklidir.',
    });
    return;
  }

  try {
    const data = await orderService.createOrder(
      req.body,
      req.user?.username || 'SYSTEM',
      req.user?.user_id,
      req.user?.username,
    );
    res.status(201).json({ success: true, data, message: 'Sipariş başarıyla oluşturuldu.' });
  } catch (error) {
    handleError(res, error, 'createOrder');
  }
};

// ── Picking Workflow ───────────────────────────────────────────────────────────

export const assignPicker = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await orderService.assignPicker(req.params.order_id, req.body.picker_id);
    res.json({ success: true, message: 'Toplayıcı başarıyla atandı.' });
  } catch (error) {
    handleError(res, error, 'assignPicker');
  }
};

export const startPicking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await orderService.startPicking(req.params.order_id);
    res.json({ success: true, message: 'Toplama işlemi başlatıldı.' });
  } catch (error) {
    handleError(res, error, 'startPicking');
  }
};

export const recordPick = async (req: AuthRequest, res: Response): Promise<void> => {
  const { item_id, product_sku, quantity_picked } = req.body;

  if (!item_id || !product_sku || quantity_picked <= 0) {
    res.status(400).json({ success: false, error: 'Geçersiz toplama bilgisi.' });
    return;
  }

  try {
    await orderService.recordPick(req.params.order_id, req.body, req.user?.user_id);
    res.json({ success: true, message: 'Toplama kaydedildi.' });
  } catch (error) {
    handleError(res, error, 'recordPick');
  }
};

export const completePicking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await orderService.completePicking(req.params.order_id);
    res.json({ success: true, message: 'Sipariş toplanması tamamlandı.' });
  } catch (error) {
    handleError(res, error, 'completePicking');
  }
};

export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await orderService.cancelOrder(req.params.order_id, req.body.reason, {
      user_id: req.user?.user_id,
      username: req.user?.username,
    });
    res.json({ success: true, message: 'Sipariş iptal edildi.' });
  } catch (error) {
    handleError(res, error, 'cancelOrder');
  }
};

// ── Picker Performance ────────────────────────────────────────────────────────

export const getPickerPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const data = await orderService.getPickerPerformance(
      req.params.picker_id,
      req.query.start_date as string | undefined,
      req.query.end_date as string | undefined,
    );
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getPickerPerformance');
  }
};
