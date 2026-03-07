// ============================================
// LOCATION SERVICE — Module 2 (Warehouse Placement)
// WMS lokasyon yönetimi iş mantığı.
// Tablolar: wms_locations, location_inventory
// Coupling: 2/10 — düşük
// ============================================

import pool from '../../../config/database';

// ── Domain Error ──────────────────────────────────────────────────────────────

export class LocationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'LocationError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GetLocationsFilters {
  warehouse_code?: string;
  zone?: string;
  page?: string | number;
  limit?: string | number;
}

export interface CreateLocationInput {
  warehouse_code: string;
  location_code: string;
  qr_code: string;
  description?: string;
  zone?: string;
  aisle?: string;
  bay?: string;
  level?: string;
  location_type?: string;
  capacity_units?: number;
  max_weight_kg?: number;
  notes?: string;
}

export interface UpdateLocationInput {
  [key: string]: unknown;
}

// ── Whitelist — only these columns may appear in UPDATE SET ──────────────────

const UPDATABLE_LOCATION_FIELDS: ReadonlySet<string> = new Set([
  'location_code', 'qr_code', 'description', 'zone', 'aisle', 'bay', 'level',
  'location_type', 'capacity_units', 'max_weight_kg', 'notes', 'is_active',
]);

// ── Service ───────────────────────────────────────────────────────────────────

class LocationService {
  async getAllLocations(filters: GetLocationsFilters) {
    const { warehouse_code, zone, page = 1, limit = 50 } = filters;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = ' WHERE 1=1';
    const params: (string | number | boolean | null)[] = [];

    if (warehouse_code) {
      params.push(warehouse_code as string);
      whereClause += ` AND w.code = $${params.length}`;
    }
    if (zone) {
      params.push(zone as string);
      whereClause += ` AND l.zone = $${params.length}`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM wms_locations l
       JOIN wms_warehouses w ON l.warehouse_id = w.warehouse_id
       ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT l.*, w.code as warehouse_code, w.name as warehouse_name
       FROM wms_locations l
       JOIN wms_warehouses w ON l.warehouse_id = w.warehouse_id
       ${whereClause}
       ORDER BY l.location_code
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limitNum, offset],
    );

    return { rows: result.rows, page: pageNum, limit: limitNum, total };
  }

  async getLocationById(location_id: string) {
    const result = await pool.query(
      `SELECT l.*, w.code as warehouse_code, w.name as warehouse_name
       FROM wms_locations l
       JOIN wms_warehouses w ON l.warehouse_id = w.warehouse_id
       WHERE l.location_id = $1`,
      [location_id],
    );

    if (result.rows.length === 0) {
      throw new LocationError(404, 'Location not found');
    }

    return result.rows[0];
  }

  async getLocationByCode(location_code: string) {
    const result = await pool.query(
      `SELECT l.*, w.code as warehouse_code, w.name as warehouse_name
       FROM wms_locations l
       JOIN wms_warehouses w ON l.warehouse_id = w.warehouse_id
       WHERE l.location_code = $1`,
      [location_code],
    );

    if (result.rows.length === 0) {
      throw new LocationError(404, 'Location not found');
    }

    return result.rows[0];
  }

  async createLocation(data: CreateLocationInput) {
    const {
      warehouse_code,
      location_code,
      qr_code,
      description,
      zone,
      aisle,
      bay,
      level,
      location_type,
      capacity_units,
      max_weight_kg,
      notes,
    } = data;

    const warehouseResult = await pool.query(
      'SELECT warehouse_id FROM wms_warehouses WHERE code = $1',
      [warehouse_code],
    );

    if (warehouseResult.rows.length === 0) {
      throw new LocationError(404, 'Warehouse not found');
    }

    const warehouse_id = warehouseResult.rows[0].warehouse_id;

    const result = await pool.query(
      `INSERT INTO wms_locations (
        warehouse_id, location_code, qr_code, description, zone,
        aisle, bay, level, location_type, capacity_units, max_weight_kg, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        warehouse_id,
        location_code,
        qr_code,
        description,
        zone,
        aisle,
        bay,
        level,
        location_type ?? 'RACK',
        capacity_units,
        max_weight_kg,
        notes,
      ],
    );

    return result.rows[0];
  }

  async updateLocation(location_id: string, updates: UpdateLocationInput) {
    const fields = Object.keys(updates).filter((key) => UPDATABLE_LOCATION_FIELDS.has(key));

    if (fields.length === 0) {
      throw new LocationError(400, 'No fields to update');
    }

    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    const values = [location_id, ...fields.map((field) => updates[field])];

    const result = await pool.query(
      `UPDATE wms_locations SET ${setClause}, updated_at = NOW()
       WHERE location_id = $1 RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      throw new LocationError(404, 'Location not found');
    }

    return result.rows[0];
  }

  async deleteLocation(location_id: string) {
    const inventoryCheck = await pool.query(
      'SELECT COUNT(*) as count FROM location_inventory WHERE location_id = $1',
      [location_id],
    );

    if (parseInt(inventoryCheck.rows[0].count) > 0) {
      throw new LocationError(400, 'Cannot delete location with existing inventory');
    }

    const result = await pool.query(
      'DELETE FROM wms_locations WHERE location_id = $1 RETURNING location_id',
      [location_id],
    );

    if (result.rows.length === 0) {
      throw new LocationError(404, 'Location not found');
    }
  }

  async getLocationInventory(location_id: string) {
    const result = await pool.query(
      `SELECT
        li.*,
        p.product_name,
        p.barcode,
        p.category,
        l.location_code,
        l.zone
       FROM location_inventory li
       JOIN products p ON li.product_sku = p.sku_code
       JOIN wms_locations l ON li.location_id = l.location_id
       WHERE li.location_id = $1
       ORDER BY p.product_name`,
      [location_id],
    );

    return result.rows;
  }
}

export const locationService = new LocationService();
export default locationService;
