// ============================================
// LOCATION CONTROLLER — Module 2 (thin wrapper)
// Sadece req/res yönetimi. İş mantığı → location.service.ts
// ============================================

import { Request, Response } from 'express';
import logger from '../../../config/logger';
import { locationService, LocationError } from '../services/location.service';

// ── Error Handler ─────────────────────────────────────────────────────────────

function handleError(res: Response, error: unknown, context: string): void {
  if (error instanceof LocationError) {
    res.status(error.statusCode).json({ success: false, error: error.message });
    return;
  }
  if (error instanceof Error && 'code' in error && (error as Record<string, unknown>).code === '23505') {
    res.status(409).json({ success: false, error: 'Location code or QR code already exists' });
    return;
  }
  logger.error(`[LocationController] ${context}:`, error);
  res.status(500).json({ success: false, error: 'Internal server error' });
}

// ── Handlers ──────────────────────────────────────────────────────────────────

export const getAllLocations = async (req: Request, res: Response) => {
  try {
    const result = await locationService.getAllLocations(req.query);
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
    handleError(res, error, 'getAllLocations');
  }
};

export const getLocationById = async (req: Request, res: Response) => {
  try {
    const data = await locationService.getLocationById(req.params.location_id);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getLocationById');
  }
};

export const getLocationByCode = async (req: Request, res: Response) => {
  try {
    const data = await locationService.getLocationByCode(req.params.location_code);
    res.json({ success: true, data });
  } catch (error) {
    handleError(res, error, 'getLocationByCode');
  }
};

export const createLocation = async (req: Request, res: Response) => {
  const { warehouse_code, location_code, qr_code } = req.body;

  if (!warehouse_code || !location_code || !qr_code) {
    res.status(400).json({
      success: false,
      error: 'warehouse_code, location_code, and qr_code are required',
    });
    return;
  }

  try {
    const data = await locationService.createLocation(req.body);
    res.status(201).json({ success: true, data, message: 'Location created successfully' });
  } catch (error) {
    handleError(res, error, 'createLocation');
  }
};

export const updateLocation = async (req: Request, res: Response) => {
  try {
    const data = await locationService.updateLocation(req.params.location_id, req.body);
    res.json({ success: true, data, message: 'Location updated successfully' });
  } catch (error) {
    handleError(res, error, 'updateLocation');
  }
};

export const deleteLocation = async (req: Request, res: Response) => {
  try {
    await locationService.deleteLocation(req.params.location_id);
    res.json({ success: true, message: 'Location deleted successfully' });
  } catch (error) {
    handleError(res, error, 'deleteLocation');
  }
};

export const getLocationInventory = async (req: Request, res: Response) => {
  try {
    const data = await locationService.getLocationInventory(req.params.location_id);
    res.json({ success: true, data, message: `Found ${data.length} products in location` });
  } catch (error) {
    handleError(res, error, 'getLocationInventory');
  }
};
