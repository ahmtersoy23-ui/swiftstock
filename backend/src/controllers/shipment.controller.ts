import { Request, Response } from 'express';
import pool from '../config/database';

// ============================================
// GET ALL SHIPMENTS
// ============================================
export const getAllShipments = async (req: Request, res: Response) => {
  try {
    const { status, warehouse_id, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = ' WHERE 1=1';
    const params: any[] = [];

    if (status) {
      params.push(status);
      whereClause += ` AND vs.status = $${params.length}`;
    }

    if (warehouse_id) {
      params.push(warehouse_id);
      whereClause += ` AND vs.source_warehouse_id = $${params.length}`;
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM virtual_shipments vs ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    let query = `
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

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error: any) {
    console.error('Error getting shipments:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// GET SHIPMENT BY ID
// ============================================
export const getShipmentById = async (req: Request, res: Response) => {
  try {
    const { shipment_id } = req.params;

    const shipmentResult = await pool.query(
      `SELECT
        vs.*,
        w.code as source_warehouse_code,
        w.name as source_warehouse_name
      FROM virtual_shipments vs
      JOIN wms_warehouses w ON vs.source_warehouse_id = w.warehouse_id
      WHERE vs.shipment_id = $1`,
      [shipment_id]
    );

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Shipment not found',
      });
    }

    const boxesResult = await pool.query(
      `SELECT * FROM shipment_boxes WHERE shipment_id = $1 ORDER BY box_number`,
      [shipment_id]
    );

    res.json({
      success: true,
      data: {
        ...shipmentResult.rows[0],
        boxes: boxesResult.rows,
      },
    });
  } catch (error: any) {
    console.error('Error getting shipment:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// CREATE SHIPMENT
// ============================================
export const createShipment = async (req: Request, res: Response) => {
  try {
    const { prefix, name, source_warehouse_id, default_destination, notes, created_by } = req.body;

    if (!prefix || !name || !source_warehouse_id || !created_by) {
      return res.status(400).json({
        success: false,
        error: 'prefix, name, source_warehouse_id and created_by are required',
      });
    }

    const existingPrefix = await pool.query(
      'SELECT shipment_id FROM virtual_shipments WHERE prefix = $1',
      [prefix.toUpperCase()]
    );

    if (existingPrefix.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Prefix already exists',
      });
    }

    const result = await pool.query(
      `INSERT INTO virtual_shipments (prefix, name, source_warehouse_id, default_destination, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [prefix.toUpperCase(), name, source_warehouse_id, default_destination || 'USA', notes, created_by]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Shipment created successfully',
    });
  } catch (error: any) {
    console.error('Error creating shipment:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// CREATE BOX IN SHIPMENT
// ============================================
export const createBox = async (req: Request, res: Response) => {
  try {
    const { shipment_id } = req.params;
    const { destination, notes, created_by } = req.body;

    if (!created_by) {
      return res.status(400).json({
        success: false,
        error: 'created_by is required',
      });
    }

    const shipmentResult = await pool.query(
      'SELECT * FROM virtual_shipments WHERE shipment_id = $1',
      [shipment_id]
    );

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Shipment not found',
      });
    }

    const shipment = shipmentResult.rows[0];

    if (shipment.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        error: 'Cannot add boxes to a closed shipment',
      });
    }

    const nextBoxResult = await pool.query(
      'SELECT COALESCE(MAX(box_number), 0) + 1 as next_number FROM shipment_boxes WHERE shipment_id = $1',
      [shipment_id]
    );
    const nextNumber = nextBoxResult.rows[0].next_number;

    const barcode = `${shipment.prefix}-${String(nextNumber).padStart(5, '0')}`;

    const result = await pool.query(
      `INSERT INTO shipment_boxes (shipment_id, barcode, box_number, destination, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [shipment_id, barcode, nextNumber, destination || shipment.default_destination, notes, created_by]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Box created successfully',
    });
  } catch (error: any) {
    console.error('Error creating box:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// GET BOX BY BARCODE
// ============================================
export const getBoxByBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;

    const boxResult = await pool.query(
      `SELECT
        sb.*,
        vs.prefix,
        vs.name as shipment_name,
        vs.status as shipment_status
      FROM shipment_boxes sb
      JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id
      WHERE sb.barcode = $1`,
      [barcode]
    );

    if (boxResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Box not found',
      });
    }

    const contentsResult = await pool.query(
      `SELECT
        sbc.*,
        p.product_name,
        p.barcode as product_barcode
      FROM shipment_box_contents sbc
      JOIN products p ON sbc.product_sku = p.sku_code
      WHERE sbc.box_id = $1
      ORDER BY sbc.added_at`,
      [boxResult.rows[0].box_id]
    );

    res.json({
      success: true,
      data: {
        ...boxResult.rows[0],
        contents: contentsResult.rows,
      },
    });
  } catch (error: any) {
    console.error('Error getting box:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// ADD ITEM TO BOX
// ============================================
export const addItemToBox = async (req: Request, res: Response) => {
  try {
    const { box_id } = req.params;
    const { product_sku, quantity, added_by } = req.body;

    if (!sku_code || !quantity || !added_by) {
      return res.status(400).json({
        success: false,
        error: 'product_sku, quantity and added_by are required',
      });
    }

    const boxResult = await pool.query(
      `SELECT sb.*, vs.status as shipment_status
       FROM shipment_boxes sb
       JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id
       WHERE sb.box_id = $1`,
      [box_id]
    );

    if (boxResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Box not found',
      });
    }

    const box = boxResult.rows[0];

    if (box.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        error: 'Cannot add items to a closed box',
      });
    }

    if (box.shipment_status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        error: 'Cannot add items when shipment is closed',
      });
    }

    const productResult = await pool.query(
      'SELECT * FROM products WHERE product_sku = $1',
      [sku_code]
    );

    if (productResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      });
    }

    const existingContent = await pool.query(
      'SELECT * FROM shipment_box_contents WHERE box_id = $1 AND product_sku = $2',
      [box_id, sku_code]
    );

    let result;
    if (existingContent.rows.length > 0) {
      result = await pool.query(
        `UPDATE shipment_box_contents
         SET quantity = quantity + $1, added_at = CURRENT_TIMESTAMP, added_by = $2
         WHERE box_id = $3 AND product_sku = $4
         RETURNING *`,
        [quantity, added_by, box_id, sku_code]
      );
    } else {
      result = await pool.query(
        `INSERT INTO shipment_box_contents (box_id, product_sku, quantity, added_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [box_id, product_sku, quantity, added_by]
      );
    }

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Item added to box',
    });
  } catch (error: any) {
    console.error('Error adding item to box:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// REMOVE ITEM FROM BOX
// ============================================
export const removeItemFromBox = async (req: Request, res: Response) => {
  try {
    const { content_id } = req.params;

    const contentResult = await pool.query(
      `SELECT sbc.*, sb.status as box_status, vs.status as shipment_status
       FROM shipment_box_contents sbc
       JOIN shipment_boxes sb ON sbc.box_id = sb.box_id
       JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id
       WHERE sbc.content_id = $1`,
      [content_id]
    );

    if (contentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Content not found',
      });
    }

    const content = contentResult.rows[0];

    if (content.box_status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        error: 'Cannot remove items from a closed box',
      });
    }

    await pool.query('DELETE FROM shipment_box_contents WHERE content_id = $1', [content_id]);

    res.json({
      success: true,
      message: 'Item removed from box',
    });
  } catch (error: any) {
    console.error('Error removing item from box:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// CLOSE BOX
// ============================================
export const closeBox = async (req: Request, res: Response) => {
  try {
    const { box_id } = req.params;
    const { weight_kg } = req.body;

    const boxResult = await pool.query(
      `SELECT sb.*, vs.status as shipment_status
       FROM shipment_boxes sb
       JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id
       WHERE sb.box_id = $1`,
      [box_id]
    );

    if (boxResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Box not found',
      });
    }

    const box = boxResult.rows[0];

    if (box.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        error: 'Box is already closed',
      });
    }

    const result = await pool.query(
      `UPDATE shipment_boxes
       SET status = 'CLOSED', weight_kg = $1, closed_at = CURRENT_TIMESTAMP
       WHERE box_id = $2
       RETURNING *`,
      [weight_kg, box_id]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Box closed successfully',
    });
  } catch (error: any) {
    console.error('Error closing box:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// UPDATE BOX DESTINATION
// ============================================
export const updateBoxDestination = async (req: Request, res: Response) => {
  try {
    const { box_id } = req.params;
    const { destination } = req.body;

    if (!destination || !['USA', 'FBA'].includes(destination)) {
      return res.status(400).json({
        success: false,
        error: 'Valid destination (USA or FBA) is required',
      });
    }

    const boxResult = await pool.query(
      `SELECT sb.*, vs.status as shipment_status
       FROM shipment_boxes sb
       JOIN virtual_shipments vs ON sb.shipment_id = vs.shipment_id
       WHERE sb.box_id = $1`,
      [box_id]
    );

    if (boxResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Box not found',
      });
    }

    if (boxResult.rows[0].shipment_status === 'SHIPPED') {
      return res.status(400).json({
        success: false,
        error: 'Cannot change destination of shipped box',
      });
    }

    const result = await pool.query(
      `UPDATE shipment_boxes SET destination = $1 WHERE box_id = $2 RETURNING *`,
      [destination, box_id]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Box destination updated',
    });
  } catch (error: any) {
    console.error('Error updating box destination:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// CLOSE SHIPMENT
// ============================================
export const closeShipment = async (req: Request, res: Response) => {
  try {
    const { shipment_id } = req.params;

    const shipmentResult = await pool.query(
      'SELECT * FROM virtual_shipments WHERE shipment_id = $1',
      [shipment_id]
    );

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Shipment not found',
      });
    }

    if (shipmentResult.rows[0].status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        error: 'Shipment is not open',
      });
    }

    await pool.query(
      `UPDATE shipment_boxes SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP
       WHERE shipment_id = $1 AND status = 'OPEN'`,
      [shipment_id]
    );

    const result = await pool.query(
      `UPDATE virtual_shipments
       SET status = 'CLOSED', closed_at = CURRENT_TIMESTAMP
       WHERE shipment_id = $1
       RETURNING *`,
      [shipment_id]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Shipment closed successfully',
    });
  } catch (error: any) {
    console.error('Error closing shipment:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// SHIP SHIPMENT
// ============================================
export const shipShipment = async (req: Request, res: Response) => {
  try {
    const { shipment_id } = req.params;

    const shipmentResult = await pool.query(
      'SELECT * FROM virtual_shipments WHERE shipment_id = $1',
      [shipment_id]
    );

    if (shipmentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Shipment not found',
      });
    }

    if (shipmentResult.rows[0].status === 'SHIPPED') {
      return res.status(400).json({
        success: false,
        error: 'Shipment is already shipped',
      });
    }

    await pool.query(
      `UPDATE shipment_boxes SET status = 'SHIPPED' WHERE shipment_id = $1`,
      [shipment_id]
    );

    const result = await pool.query(
      `UPDATE virtual_shipments
       SET status = 'SHIPPED', shipped_at = CURRENT_TIMESTAMP
       WHERE shipment_id = $1
       RETURNING *`,
      [shipment_id]
    );

    res.json({
      success: true,
      data: result.rows[0],
      message: 'Shipment marked as shipped',
    });
  } catch (error: any) {
    console.error('Error shipping shipment:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// ============================================
// GET SHIPMENT BOXES
// ============================================
export const getShipmentBoxes = async (req: Request, res: Response) => {
  try {
    const { shipment_id } = req.params;
    const { destination } = req.query;

    let query = `
      SELECT sb.*,
        (SELECT json_agg(json_build_object(
          'content_id', sbc.content_id,
          'sku_code', sbc.product_sku,
          'quantity', sbc.quantity,
          'product_name', p.product_name
        ))
        FROM shipment_box_contents sbc
        JOIN products p ON sbc.product_sku = p.sku_code
        WHERE sbc.box_id = sb.box_id) as contents
      FROM shipment_boxes sb
      WHERE sb.shipment_id = $1
    `;
    const params: any[] = [shipment_id];

    if (destination) {
      params.push(destination);
      query += ` AND sb.destination = $${params.length}`;
    }

    query += ` ORDER BY sb.box_number`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    console.error('Error getting shipment boxes:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
