import { Request, Response } from 'express';
import pool from '../config/database';
import logger from '../config/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Create a new container (BOX or PALLET)
 * Generates barcode: KOL-00001 or PAL-00001
 */
export const createContainer = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const { container_type, warehouse_code, items, contents, created_by, notes, parent_container_id } = req.body;

    // Support both 'items' and 'contents' parameters
    const containerItems = items || contents;

    if (!container_type || !warehouse_code || !containerItems || containerItems.length === 0 || !created_by) {
      return res.status(400).json({
        success: false,
        error: 'container_type, warehouse_code, items (or contents), and created_by are required',
      });
    }

    // Get warehouse_id
    const warehouseResult = await client.query(
      'SELECT warehouse_id FROM wms_warehouses WHERE code = $1',
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
      `SELECT COUNT(*) as count FROM wms_containers WHERE barcode LIKE $1`,
      [`${prefix}-%`]
    );
    const nextNum = parseInt(countResult.rows[0].count) + 1;
    const barcode = `${prefix}-${String(nextNum).padStart(5, '0')}`;

    // Create container
    const containerResult = await client.query(
      `INSERT INTO wms_containers
       (barcode, container_type, warehouse_id, parent_container_id, status, created_by, notes)
       VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6)
       RETURNING *`,
      [barcode, container_type, warehouse_id, parent_container_id || null, created_by, notes || null]
    );

    const container = containerResult.rows[0];

    // Add items to container (batched INSERT)
    if (containerItems.length > 0) {
      const valuesClauses: string[] = [];
      const insertParams: (string | number | boolean | null)[] = [];
      containerItems.forEach((item: Record<string, unknown>, idx: number) => {
        const offset = idx * 3;
        valuesClauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
        insertParams.push(container.container_id, item.product_sku as string, item.quantity as number);
      });
      await client.query(
        `INSERT INTO wms_container_contents (container_id, product_sku, quantity)
         VALUES ${valuesClauses.join(', ')}`,
        insertParams
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        container,
        barcode: container.barcode,
        items_count: containerItems.length,
      },
      message: `Container ${barcode} created successfully`,
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    logger.error('Error creating container:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
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
      'SELECT * FROM wms_containers WHERE barcode = $1',
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
       FROM wms_container_contents cc
       JOIN products p ON cc.product_sku = p.sku_code
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
  } catch (error: unknown) {
    logger.error('Error getting container:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
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
      'SELECT * FROM wms_containers WHERE barcode = $1 AND status = $2',
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
      'SELECT * FROM wms_container_contents WHERE container_id = $1',
      [container.container_id]
    );

    // Create transaction for unpacking
    const transactionUuid = uuidv4();
    const transactionResult = await client.query(
      `INSERT INTO transactions
       (transaction_uuid, transaction_type, warehouse_id, location_id, container_id,
        notes, created_by, device_id)
       VALUES ($1, 'IN', $2,
         (SELECT location_id FROM wms_locations WHERE qr_code = $3 LIMIT 1),
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

    // Add transaction items (batched INSERT) - inventory update handled by trigger
    if (contentsResult.rows.length > 0) {
      const valuesClauses: string[] = [];
      const insertParams: (string | number | boolean | null)[] = [];
      contentsResult.rows.forEach((content: Record<string, unknown>, idx: number) => {
        const offset = idx * 4;
        valuesClauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, 'EACH', $${offset + 4})`);
        insertParams.push(transaction_id, content.product_sku as string, content.quantity as number, content.quantity as number);
      });
      await client.query(
        `INSERT INTO transaction_items
         (transaction_id, product_sku, quantity, unit_type, quantity_each)
         VALUES ${valuesClauses.join(', ')}`,
        insertParams
      );
    }

    // Update container status
    await client.query(
      `UPDATE wms_containers
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
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    logger.error('Error opening container:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  } finally {
    client.release();
  }
};

/**
 * Get all containers (with filters)
 * Includes item counts and calculated status
 */
export const getAllContainers = async (req: Request, res: Response) => {
  try {
    const { warehouse_code, status, type, search, page = '1', limit = '50' } = req.query;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = ' WHERE 1=1';
    const params: (string | number | boolean | null)[] = [];
    let paramCount = 1;

    if (warehouse_code) {
      whereClause += ` AND w.code = $${paramCount}`;
      params.push(warehouse_code as string);
      paramCount++;
    }

    if (status) {
      whereClause += ` AND c.status = $${paramCount}`;
      params.push(status as string);
      paramCount++;
    }

    if (type) {
      whereClause += ` AND c.container_type = $${paramCount}`;
      params.push(type as string);
      paramCount++;
    }

    if (search) {
      whereClause += ` AND (c.barcode ILIKE $${paramCount} OR c.notes ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM wms_containers c
       JOIN wms_warehouses w ON c.warehouse_id = w.warehouse_id
       ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get paginated data
    const query = `
      SELECT
        c.*,
        w.code as warehouse_code,
        w.name as warehouse_name,
        l.location_code,
        l.qr_code as location_qr,
        COALESCE(cc.current_items, 0) as current_items,
        COALESCE(cc.original_items, 0) as original_items,
        CASE
          WHEN c.status = 'OPENED' THEN 'OPENED'
          WHEN COALESCE(cc.current_items, 0) = 0 THEN 'EMPTY'
          WHEN COALESCE(cc.current_items, 0) < COALESCE(cc.original_items, 0) THEN 'PARTIAL'
          ELSE 'SEALED'
        END as calculated_status
      FROM wms_containers c
      JOIN wms_warehouses w ON c.warehouse_id = w.warehouse_id
      LEFT JOIN wms_locations l ON c.location_id = l.location_id
      LEFT JOIN (
        SELECT
          container_id,
          COUNT(*) as current_items,
          COUNT(*) as original_items
        FROM wms_container_contents
        GROUP BY container_id
      ) cc ON c.container_id = cc.container_id
      ${whereClause}
      ORDER BY c.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
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
  } catch (error: unknown) {
    logger.error('Error getting containers:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
