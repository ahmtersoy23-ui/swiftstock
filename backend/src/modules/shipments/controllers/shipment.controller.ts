// ============================================
// SHIPMENT CONTROLLER — Module 6 (thin wrapper)
// Sadece req/res yönetimi. İş mantığı → shipment.service.ts
// ============================================

import { Request, Response } from 'express';
import logger from '../../../config/logger';
import { shipmentService, ShipmentError, ShipmentFilters } from '../services/shipment.service';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof ShipmentError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  logger.error(`[ShipmentController] ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── Shipments ─────────────────────────────────────────────────────────────────

export const getAllShipments = async (req: Request, res: Response) => {
  try {
    const result = await shipmentService.getAllShipments(req.query as ShipmentFilters);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error, 'getAllShipments');
  }
};

export const getShipmentById = async (req: Request, res: Response) => {
  try {
    const data = await shipmentService.getShipmentById(req.params.shipment_id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getShipmentById');
  }
};

export const createShipment = async (req: Request, res: Response) => {
  const { prefix, name, source_warehouse_id, default_destination, notes, created_by } = req.body;

  if (!prefix || !name || !source_warehouse_id || !created_by) {
    res.status(400).json({
      success: false,
      error: 'prefix, name, source_warehouse_id and created_by are required',
    });
    return;
  }

  try {
    const data = await shipmentService.createShipment({
      prefix,
      name,
      source_warehouse_id,
      default_destination,
      notes,
      created_by,
    });
    res.status(201).json({ success: true, data, message: 'Shipment created successfully' });
  } catch (error) {
    handleError(res, error, 'createShipment');
  }
};

export const closeShipment = async (req: Request, res: Response) => {
  try {
    const data = await shipmentService.closeShipment(req.params.shipment_id);
    res.json({ success: true, data, message: 'Shipment closed successfully' });
  } catch (error) {
    handleError(res, error, 'closeShipment');
  }
};

export const shipShipment = async (req: Request, res: Response) => {
  try {
    const data = await shipmentService.shipShipment(req.params.shipment_id);
    res.json({ success: true, data, message: 'Shipment marked as shipped' });
  } catch (error) {
    handleError(res, error, 'shipShipment');
  }
};

// ── Boxes ─────────────────────────────────────────────────────────────────────

export const getShipmentBoxes = async (req: Request, res: Response) => {
  try {
    const data = await shipmentService.getShipmentBoxes(
      req.params.shipment_id,
      req.query.destination as string | undefined,
    );
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getShipmentBoxes');
  }
};

export const createBox = async (req: Request, res: Response) => {
  const { destination, notes, created_by } = req.body;

  if (!created_by) {
    res.status(400).json({ success: false, error: 'created_by is required' });
    return;
  }

  try {
    const data = await shipmentService.createBox(req.params.shipment_id, {
      destination,
      notes,
      created_by,
    });
    res.status(201).json({ success: true, data, message: 'Box created successfully' });
  } catch (error) {
    handleError(res, error, 'createBox');
  }
};

export const getBoxByBarcode = async (req: Request, res: Response) => {
  try {
    const data = await shipmentService.getBoxByBarcode(req.params.barcode);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getBoxByBarcode');
  }
};

export const addItemToBox = async (req: Request, res: Response) => {
  const { product_sku, quantity, added_by } = req.body;

  if (!product_sku || !quantity || !added_by) {
    res.status(400).json({
      success: false,
      error: 'product_sku, quantity and added_by are required',
    });
    return;
  }

  try {
    const data = await shipmentService.addItemToBox(req.params.box_id, {
      product_sku,
      quantity,
      added_by,
    });
    res.status(201).json({ success: true, data, message: 'Item added to box' });
  } catch (error) {
    handleError(res, error, 'addItemToBox');
  }
};

export const removeItemFromBox = async (req: Request, res: Response) => {
  try {
    await shipmentService.removeItemFromBox(req.params.content_id);
    res.json({ success: true, message: 'Item removed from box' });
  } catch (error) {
    handleError(res, error, 'removeItemFromBox');
  }
};

export const closeBox = async (req: Request, res: Response) => {
  try {
    const data = await shipmentService.closeBox(req.params.box_id, req.body.weight_kg);
    res.json({ success: true, data, message: 'Box closed successfully' });
  } catch (error) {
    handleError(res, error, 'closeBox');
  }
};

export const updateBoxDestination = async (req: Request, res: Response) => {
  const { destination } = req.body;

  if (!destination || !['USA', 'FBA'].includes(destination)) {
    res.status(400).json({
      success: false,
      error: 'Valid destination (USA or FBA) is required',
    });
    return;
  }

  try {
    const data = await shipmentService.updateBoxDestination(req.params.box_id, destination);
    res.json({ success: true, data, message: 'Box destination updated' });
  } catch (error) {
    handleError(res, error, 'updateBoxDestination');
  }
};
