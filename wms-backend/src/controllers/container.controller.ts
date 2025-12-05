import { Request, Response } from 'express';
import pool from '../config/database';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new container (BOX or PALLET)
 * Generates barcode: KOL-00001 or PAL-00001
 */
export const createContainer = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const { container_type, warehouse_code, items, created_by, notes, parent_container_id } = req.body;

    if (!container_type || !warehouse_code || !items || !created_by) {
      return res.status(400).json({
        success: false,
        error: 'container_type, warehouse_code, items, and created_by are required',
      });
    }

    // Get warehouse_id
    const warehouseResult = await client.query(
      'SELECT warehouse_id FROM warehouses WHERE code = $1',
      [warehouse_code]
    );

    if (warehouseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found',
      });
    }

    const warehouse_id = warehouseResult.rows[0].warehouse_id;

    await client.query('BEGIN');

    // Generate barcode prefix
    const prefix = container_type === 'BOX' ? 'KOL' : 'PAL';

    // Get next sequence number
    const countResult = await client.query(
      `SELECT COUNT(*) as count FROM containers WHERE barcode LIKE $1`,
      [`${prefix}-%`]
    );
    const nextNum = parseInt(countResult.rows[0].count) + 1;
    const barcode = `${prefix}-${String(nextNum).padStart(5, '0')}`;

    // Create container
    const containerResult = await client.query(
      `INSERT INTO containers
       (barcode, container_type, warehouse_id, parent_container_id, status, created_by, notes)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6)
       RETURNING *`,
      [barcode, container_type, warehouse_id, parent_container_id || null, created_by, notes || null]
    );

    const container = containerResult.rows[0];

    // Add items to container
    for (const item of items) {
      await client.query(
        `INSERT INTO container_contents (container_id, sku_code, quantity)
         VALUES ($1, $2, $3)`,
        [container.container_id, item.sku_code, item.quantity]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        container,
        items_count: items.length,
      },
      message: `Container ${barcode} created successfully`,
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error creating container:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create container',
    });
  } finally {
    client.release();
  }
};

/**
 * Get container details by barcode
 */
export const getContainerByBarcode = async (req: Request, res: Response) => {
  try {
    const { barcode } = req.params;

    // Get container info
    const containerResult = await pool.query(
      'SELECT * FROM containers WHERE barcode = $1',
      [barcode]
    );

    if (containerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Container not found',
      });
    }

    const container = containerResult.rows[0];

    // Get container contents
    const contentsResult = await pool.query(
      `SELECT cc.*, p.product_name, p.barcode as product_barcode
       FROM container_contents cc
       JOIN products p ON cc.sku_code = p.sku_code
       WHERE cc.container_id = $1`,
      [container.container_id]
    );

    res.json({
      success: true,
      data: {
        container,
        contents: contentsResult.rows,
      },
    });
  } catch (error: any) {
    console.error('Error getting container:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get container',
    });
  }
};

/**
 * Open/unpack a container
 * Returns items back to inventory
 */
export const openContainer = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const { barcode } = req.params;
    const { location_qr, created_by } = req.body;

    if (!created_by) {
      return res.status(400).json({
        success: false,
        error: 'created_by is required',
      });
    }

    await client.query('BEGIN');

    // Get container
    const containerResult = await client.query(
      'SELECT * FROM containers WHERE barcode = $1 AND status = $2',
      [barcode, 'ACTIVE']
    );

    if (containerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Active container not found',
      });
    }

    const container = containerResult.rows[0];

    // Get contents
    const contentsResult = await client.query(
      'SELECT * FROM container_contents WHERE container_id = $1',
      [container.container_id]
    );

    // Create transaction for unpacking
    const transactionUuid = uuidv4();
    const transactionResult = await client.query(
      `INSERT INTO transactions
       (transaction_uuid, transaction_type, warehouse_id, location_id, container_id,
        notes, created_by, device_id)
       VALUES ($1, 'IN', $2,
         (SELECT location_id FROM locations WHERE qr_code = $3 LIMIT 1),
         $4, $5, $6, $7)
       RETURNING transaction_id`,
      [
        transactionUuid,
        container.warehouse_id,
        location_qr || null,
        container.container_id,
        `Unpacked container ${barcode}`,
        created_by,
        null
      ]
    );

    const transaction_id = transactionResult.rows[0].transaction_id;

    // Add transaction items and update inventory
    for (const content of contentsResult.rows) {
      // Add to transaction_items
      await client.query(
        `INSERT INTO transaction_items
         (transaction_id, sku_code, quantity, unit_type, quantity_each)
         VALUES ($1, $2, $3, 'EACH', $4)`,
        [transaction_id, content.sku_code, content.quantity, content.quantity]
      );

      // Update inventory (will be handled by trigger)
    }

    // Update container status
    await client.query(
      `UPDATE containers
       SET status = 'OPENED', opened_at = NOW()
       WHERE container_id = $1`,
      [container.container_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Container ${barcode} opened successfully`,
      data: {
        transaction_id,
        items_returned: contentsResult.rows.length,
      },
    });
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('Error opening container:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to open container',
    });
  } finally {
    client.release();
  }
};

/**
 * Get all containers (with filters)
 */
export const getAllContainers = async (req: Request, res: Response) => {
  try {
    const { warehouse_code, status, type } = req.query;

    let query = `
      SELECT c.*, w.code as warehouse_code
      FROM containers c
      JOIN warehouses w ON c.warehouse_id = w.warehouse_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramCount = 1;

    if (warehouse_code) {
      query += ` AND w.code = $${paramCount}`;
      params.push(warehouse_code);
      paramCount++;
    }

    if (status) {
      query += ` AND c.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (type) {
      query += ` AND c.container_type = $${paramCount}`;
      params.push(type);
      paramCount++;
    }

    query += ` ORDER BY c.created_at DESC LIMIT 100`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error: any) {
    console.error('Error getting containers:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get containers',
    });
  }
};
