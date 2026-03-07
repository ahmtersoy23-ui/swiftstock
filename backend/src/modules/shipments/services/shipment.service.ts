// ============================================
// SHIPMENT SERVICE — Module 6
// Sevkiyat iş mantığı. Controller sadece req/res yönetir,
// tüm business logic burada.
// Tablolar: virtual_shipments, shipment_boxes, shipment_box_contents
// Coupling: 2/10 — pilot modül
// ============================================

import pool from '../../../config/database';

// ── Domain Error ──────────────────────────────────────────────────────────────

export class ShipmentError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ShipmentError';
  }
}

// ── Input Types ───────────────────────────────────────────────────────────────

export interface ShipmentFilters {
  status?: string;
  warehouse_id?: string;
  page?: string | number;
  limit?: string | number;
}

export interface CreateShipmentInput {
  prefix: string;
  name: string;
  source_warehouse_id: string | number;
  default_destination?: string;
  notes?: string;
  created_by: string;
}

export interface CreateBoxInput {
  destination?: string;
  notes?: string;
  created_by: string;
}

export interface AddItemToBoxInput {
  product_sku: string;
  quantity: number;
  added_by: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

class ShipmentService {
  // ── Shipments ────────────────────────────────────────────────────────────

  async getAllShipments(filters: ShipmentFilters) {
    const { status, warehouse_id, page = 1, limit = 50 } = filters;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = ' WHERE 1=1';
    const params: (string | number | null)[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND vs.status = $${params.length}`;
    }

    if (warehouse_id) {
      params.push(warehouse_id);
      whereClause += ` AND vs.source_warehouse_id = $${params.length}`;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM virtual_shipments vs ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT
        vs.*,
        w.code as source_warehouse_code,
        w.name as source_warehouse_name,
        (SELECT COUNT(*) FROM shipment_boxes sb WHERE sb.shipment_id = vs.shipment_id AND sb.destination = 'USA') as usa_boxes,
        (SELECT COUNT(*) FROM shipment_boxes sb WHERE sb.shipment_id = vs.shipment_id AND sb.destination = 'FBA') as fba_boxes
      FROM virtual_shipments vs
      JOIN wms_warehouses w ON vs.source_warehouse_id = w.warehouse_id
      ${whereClause}
      ORDER BY vs.created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const result = await pool.query(query, [...params, limitNum, offset]);

    return {
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async getShipmentById(shipmentId: string) {
    const shipmentResult = await pool.query(
      `SELECT
        vs.*,
        w.code as source_warehouse_code,
        w.name as source_warehouse_name
      FROM virtual_shipments vs
      JOIN wms_warehouses w ON vs.source_warehouse_id = w.warehouse_id
      WHERE vs.shipment_id = $1`,
      [shipmentId],
    );

    if (shipmentResult.rows.length === 0) {
      throw new ShipmentError(404, 'Shipment not found');
    }

    const boxesResult = await pool.query(
      'SELECT * FROM shipment_boxes WHERE shipment_id = $1 ORDER BY box_number',
      [shipmentId],
    );

    return { ...shipmentResult.rows[0], boxes: boxesResult.rows };
  }

  async createShipment(data: CreateShipmentInput) {
    const { prefix, name, source_warehouse_id, default_destination, notes, created_by } = data;

    const existingPrefix = await pool.query(
      'SELECT shipment_id FROM virtual_shipments WHERE prefix = $1',
      [prefix.toUpperCase()],
    );

    if (existingPrefix.rows.length > 0) {
      throw new ShipmentError(400, 'Prefix already exists');
    }

    const result = await pool.query(
      `INSERT INTO virtual_shipments (prefix, name, source_warehouse_id, default_destination, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [prefix.toUpperCase(), name, source_warehouse_id, default_destination || 'USA', notes, created_by],
    );

    return result.rows[0];
  }

  async closeShipment(shipmentId: string) {
    const shipmentResult = await pool.query(
      'SELECT * FROM virtual_shipments WHERE shipment_id = $1',
      [shipmentId],
    );

    if (shipmentResult.rows.length === 0) {
      throw new ShipmentError(404, 'Shipment not found');
    }

    if (shipmentResult.rows[0].status !== 'OPEN') {
      throw new ShipmentError(400, 'Shipment is not open');
    }

    await pool.query(
      `UPDATE shipment_boxes SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP
       WHERE shipment_id = $1 AND status = 'OPEN'`,
      [shipmentId],
    );

    const result = await pool.query(
      `UPDATE virtual_shipments
       SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP
       WHERE shipment_id = $1
       RETURNING *`,
      [shipmentId],
    );

    return result.rows[0];
  }

  async shipShipment(shipmentId: string) {
    const shipmentResult = await pool.query(
      'SELECT * FROM virtual_shipments WHERE shipment_id = $1',
      [shipmentId],
    );

    if (shipmentResult.rows.length === 0) {
      throw new ShipmentError(404, 'Shipment not found');
    }

    if (shipmentResult.rows[0].status === 'SHIPPED') {
      throw new ShipmentError(400, 'Shipment is already shipped');
    }

    await pool.query(
      `UPDATE shipment_boxes SET status = 'SHIPPED' WHERE shipment_id = $1`,
      [shipmentId],
    );

    const result = await pool.query(
      `UPDATE virtual_shipments
       SET status = 'SHIPPED', shipped_at = CURRENT_TIMESTAMP
       WHERE shipment_id = $1
       RETURNING *`,
      [shipmentId],
    );

    return result.rows[0];
  }

  // ── Boxes ─────────────────────────────────────────────────────────────────

  async getShipmentBoxes(shipmentId: string, destination?: string) {
    let query = `
      SELECT sb.*,
        (SELECT json_agg(json_build_object(
          'content_id', sbc.content_id,
          'product_sku', sbc.product_sku,
          'quantity', sbc.quantity,
          'product_name', p.name
        ))
        FROM shipment_box_contents sbc
        JOIN products p ON sbc.product_sku = p.product_sku
        WHERE sbc.box_id = sb.box_id) as contents
      FROM shipment_boxes sb
      WHERE sb.shipment_id = $1
    `;
    const params: (string | number | null)[] = [shipmentId];

    if (destination) {
      params.push(destination);
      query += ` AND sb.destination = $${params.length}`;
    }

    query += ' ORDER BY sb.box_number';

    const result = await pool.query(query, params);
    return result.rows;
  }

  async createBox(shipmentId: string, data: CreateBoxInput) {
    const { destination, notes, created_by } = data;

    const shipmentResult = await pool.query(
      'SELECT * FROM virtual_shipments WHERE shipment_id = $1',
      [shipmentId],
    );

    if (shipmentResult.rows.length === 0) {
      throw new ShipmentError(404, 'Shipment not found');
    }

    const shipment = shipmentResult.rows[0];

    if (shipment.status !== 'OPEN') {
      throw new ShipmentError(400, 'Cannot add boxes to a closed shipment');
    }

    const nextBoxResult = await pool.query(
      'SELECT COALESCE(MAX(box_number), 0) + 1 as next_number FROM shipment_boxes WHERE shipment_id = $1',
      [shipmentId],
    );
    const nextNumber = nextBoxResult.rows[0].next_number;

    const barcode = `${shipment.prefix}-${String(nextNumber).padStart(5, '0')}`;

    const result = await pool.query(
      `INSERT INTO shipment_boxes (shipment_id, barcode, box_number, destination, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [shipmentId, barcode, nextNumber, destination || shipment.default_destination, notes, created_by],
    );

    return result.rows[0];
  }

  async getBoxByBarcode(barcode: string) {
    const boxResult = await pool.query(
      `SELECT
        sb.*,
        vs.prefix,
        vs.name as shipment_name,
        vs.status as shipment_status
      FROM shipment_boxes sb
      JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id
      WHERE sb.barcode = $1`,
      [barcode],
    );

    if (boxResult.rows.length === 0) {
      throw new ShipmentError(404, 'Box not found');
    }

    const contentsResult = await pool.query(
      `SELECT
        sbc.*,
        p.name AS product_name,
      FROM shipment_box_contents sbc
      JOIN products p ON sbc.product_sku = p.product_sku
      WHERE sbc.box_id = $1
      ORDER BY sbc.added_at`,
      [boxResult.rows[0].box_id],
    );

    return { ...boxResult.rows[0], contents: contentsResult.rows };
  }

  async addItemToBox(boxId: string, data: AddItemToBoxInput) {
    const { product_sku, quantity, added_by } = data;

    const boxResult = await pool.query(
      `SELECT sb.*, vs.status as shipment_status
       FROM shipment_boxes sb
       JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id
       WHERE sb.box_id = $1`,
      [boxId],
    );

    if (boxResult.rows.length === 0) {
      throw new ShipmentError(404, 'Box not found');
    }

    const box = boxResult.rows[0];

    if (box.status !== 'OPEN') {
      throw new ShipmentError(400, 'Cannot add items to a closed box');
    }

    if (box.shipment_status !== 'OPEN') {
      throw new ShipmentError(400, 'Cannot add items when shipment is closed');
    }

    const productResult = await pool.query(
      'SELECT * FROM products WHERE product_sku = $1',
      [product_sku],
    );

    if (productResult.rows.length === 0) {
      throw new ShipmentError(404, 'Product not found');
    }

    const existingContent = await pool.query(
      'SELECT * FROM shipment_box_contents WHERE box_id = $1 AND product_sku = $2',
      [boxId, product_sku],
    );

    let result;
    if (existingContent.rows.length > 0) {
      result = await pool.query(
        `UPDATE shipment_box_contents
         SET quantity = quantity + $1, added_at = CURRENT_TIMESTAMP, added_by = $2
         WHERE box_id = $3 AND product_sku = $4
         RETURNING *`,
        [quantity, added_by, boxId, product_sku],
      );
    } else {
      result = await pool.query(
        `INSERT INTO shipment_box_contents (box_id, product_sku, quantity, added_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [boxId, product_sku, quantity, added_by],
      );
    }

    return result.rows[0];
  }

  async removeItemFromBox(contentId: string) {
    const contentResult = await pool.query(
      `SELECT sbc.*, sb.status as box_status, vs.status as shipment_status
       FROM shipment_box_contents sbc
       JOIN shipment_boxes sb ON sbc.box_id = sb.box_id
       JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id
       WHERE sbc.content_id = $1`,
      [contentId],
    );

    if (contentResult.rows.length === 0) {
      throw new ShipmentError(404, 'Content not found');
    }

    if (contentResult.rows[0].box_status !== 'OPEN') {
      throw new ShipmentError(400, 'Cannot remove items from a closed box');
    }

    await pool.query('DELETE FROM shipment_box_contents WHERE content_id = $1', [contentId]);
  }

  async closeBox(boxId: string, weightKg?: number) {
    const boxResult = await pool.query(
      `SELECT sb.*, vs.status as shipment_status
       FROM shipment_boxes sb
       JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id
       WHERE sb.box_id = $1`,
      [boxId],
    );

    if (boxResult.rows.length === 0) {
      throw new ShipmentError(404, 'Box not found');
    }

    if (boxResult.rows[0].status !== 'OPEN') {
      throw new ShipmentError(400, 'Box is already closed');
    }

    const result = await pool.query(
      `UPDATE shipment_boxes
       SET status = 'CLOSED', weight_kg = $1, closed_at = CURRENT_TIMESTAMP
       WHERE box_id = $2
       RETURNING *`,
      [weightKg ?? null, boxId],
    );

    return result.rows[0];
  }

  async updateBoxDestination(boxId: string, destination: string) {
    const boxResult = await pool.query(
      `SELECT sb.*, vs.status as shipment_status
       FROM shipment_boxes sb
       JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id
       WHERE sb.box_id = $1`,
      [boxId],
    );

    if (boxResult.rows.length === 0) {
      throw new ShipmentError(404, 'Box not found');
    }

    if (boxResult.rows[0].shipment_status === 'SHIPPED') {
      throw new ShipmentError(400, 'Cannot change destination of shipped box');
    }

    const result = await pool.query(
      'UPDATE shipment_boxes SET destination = $1 WHERE box_id = $2 RETURNING *',
      [destination, boxId],
    );

    return result.rows[0];
  }
}

export const shipmentService = new ShipmentService();

// Re-export for module barrel
export default shipmentService;
