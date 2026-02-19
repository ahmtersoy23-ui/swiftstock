// ============================================
// SHIPMENT ORDERS CONTROLLER (USA Warehouse Picking)
import logger from '../config/logger';
// ============================================

import { Response } from 'express';
import pool from '../config/database';
import { HTTP_STATUS, ERROR_MESSAGES, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';
import { AuthRequest } from '../middleware/auth.middleware';

/**
 * Get all shipment orders with filters and pagination
 */
export const getAllOrders = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      warehouse_code,
      status,
      priority,
      assigned_picker_id,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(MAX_PAGE_SIZE, parseInt(limit as string));
    const offset = (pageNum - 1) * limitNum;

    let whereConditions: string[] = [];
    let queryParams: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (warehouse_code) {
      whereConditions.push(`so.warehouse_code = $${paramIndex++}`);
      queryParams.push(warehouse_code as string);
    }

    if (status) {
      whereConditions.push(`so.status = $${paramIndex++}`);
      queryParams.push(status as string);
    }

    if (priority) {
      whereConditions.push(`so.priority = $${paramIndex++}`);
      queryParams.push(priority as string);
    }

    if (assigned_picker_id) {
      whereConditions.push(`so.assigned_picker_id = $${paramIndex++}`);
      queryParams.push(assigned_picker_id as string);
    }

    if (search) {
      whereConditions.push(`(so.order_number ILIKE $${paramIndex} OR so.customer_name ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM shipment_orders so ${whereClause}`,
      queryParams
    );

    const total = parseInt(countResult.rows[0].total);

    // Get orders
    const ordersResult = await pool.query(
      `SELECT
         so.*,
         w.name as warehouse_name,
         u.username as picker_username,
         u.full_name as picker_full_name
       FROM shipment_orders so
       LEFT JOIN wms_warehouses w ON so.warehouse_code = w.code
       LEFT JOIN wms_users u ON so.assigned_picker_id = u.user_id
       ${whereClause}
       ORDER BY
         CASE so.priority
           WHEN 'URGENT' THEN 1
           WHEN 'HIGH' THEN 2
           WHEN 'NORMAL' THEN 3
           WHEN 'LOW' THEN 4
         END,
         so.order_date ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limitNum, offset]
    );

    res.json({
      success: true,
      data: ordersResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    logger.error('Get all orders error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Get order by ID with items
 */
export const getOrderById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { order_id } = req.params;

    const orderResult = await pool.query(
      `SELECT
         so.*,
         w.name as warehouse_name,
         u.username as picker_username,
         u.full_name as picker_full_name
       FROM shipment_orders so
       LEFT JOIN wms_warehouses w ON so.warehouse_code = w.code
       LEFT JOIN wms_users u ON so.assigned_picker_id = u.user_id
       WHERE so.order_id = $1`,
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Sipariş bulunamadı.',
      });
      return;
    }

    // Get order items
    const itemsResult = await pool.query(
      `SELECT
         soi.*,
         p.product_name,
         p.barcode,
         l.location_code,
         u.username as picked_by_username
       FROM shipment_order_items soi
       LEFT JOIN products p ON soi.product_sku = p.sku_code
       LEFT JOIN wms_locations l ON soi.location_id = l.location_id
       LEFT JOIN wms_users u ON soi.picked_by = u.user_id
       WHERE soi.order_id = $1
       ORDER BY soi.line_number`,
      [order_id]
    );

    const order = orderResult.rows[0];
    order.items = itemsResult.rows;

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    logger.error('Get order by ID error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Create new shipment order
 */
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      order_number,
      external_order_id,
      warehouse_code,
      customer_name,
      customer_address,
      customer_email,
      customer_phone,
      requested_ship_date,
      priority = 'NORMAL',
      items = [],
      notes,
    } = req.body;

    // Validate required fields
    if (!order_number || !warehouse_code || !customer_name || items.length === 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Sipariş numarası, depo, müşteri adı ve ürünler gereklidir.',
      });
      return;
    }

    // Check if order number already exists
    const existingOrder = await client.query(
      `SELECT order_id FROM shipment_orders WHERE order_number = $1`,
      [order_number]
    );

    if (existingOrder.rows.length > 0) {
      res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: 'Bu sipariş numarası zaten mevcut.',
      });
      return;
    }

    // Create order
    const orderResult = await client.query(
      `INSERT INTO shipment_orders (
        order_number, external_order_id, warehouse_code,
        customer_name, customer_address, customer_email, customer_phone,
        requested_ship_date, priority, notes, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        order_number,
        external_order_id,
        warehouse_code,
        customer_name,
        customer_address,
        customer_email,
        customer_phone,
        requested_ship_date,
        priority,
        notes,
        req.user?.username || 'SYSTEM',
      ]
    );

    const newOrder = orderResult.rows[0];

    // Create order items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Get product details
      const productResult = await client.query(
        `SELECT product_sku, product_name, barcode FROM products WHERE product_sku = $1`,
        [item.sku_code]
      );

      if (productResult.rows.length === 0) {
        throw new Error(`Ürün bulunamadı: ${item.sku_code}`);
      }

      const product = productResult.rows[0];

      // Find best location for this SKU (location with highest quantity)
      const locationResult = await client.query(
        `SELECT li.location_id, l.location_code, li.quantity_each
         FROM location_inventory li
         JOIN wms_locations l ON li.location_id = l.location_id
         WHERE li.product_sku = $1
           AND l.warehouse_id = (SELECT warehouse_id FROM wms_warehouses WHERE code = $2)
           AND li.quantity_each > 0
         ORDER BY li.quantity_each DESC
         LIMIT 1`,
        [item.product_sku, warehouse_code]
      );

      const location = locationResult.rows[0];

      await client.query(
        `INSERT INTO shipment_order_items (
          order_id, line_number, product_sku, product_name, barcode,
          quantity_ordered, location_id, location_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newOrder.order_id,
          i + 1,
          product.product_sku,
          product.product_name,
          product.barcode,
          item.quantity,
          location?.location_id,
          location?.location_code,
        ]
      );
    }

    // Log audit event
    await client.query(
      `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'CREATE_ORDER', 'shipment_orders', $3, $4)`,
      [
        req.user?.user_id,
        req.user?.username,
        newOrder.order_id.toString(),
        JSON.stringify({ order_number, customer_name, items_count: items.length }),
      ]
    );

    await client.query('COMMIT');

    // Get complete order with items
    const completeOrder = await pool.query(
      `SELECT
         so.*,
         json_agg(
           json_build_object(
             'item_id', soi.item_id,
             'line_number', soi.line_number,
             'sku_code', soi.product_sku,
             'product_name', soi.product_name,
             'quantity_ordered', soi.quantity_ordered,
             'location_code', soi.location_code
           ) ORDER BY soi.line_number
         ) as items
       FROM shipment_orders so
       LEFT JOIN shipment_order_items soi ON so.order_id = soi.order_id
       WHERE so.order_id = $1
       GROUP BY so.order_id`,
      [newOrder.order_id]
    );

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: completeOrder.rows[0],
      message: 'Sipariş başarıyla oluşturuldu.',
    });
  } catch (error: unknown) {
    await client.query('ROLLBACK');
    logger.error('Create order error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Assign picker to order
 */
export const assignPicker = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { order_id } = req.params;
    const { picker_id } = req.body;

    // Validate picker exists
    const pickerResult = await client.query(
      `SELECT user_id, username FROM wms_users WHERE user_id = $1 AND is_active = true`,
      [picker_id]
    );

    if (pickerResult.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Toplayıcı bulunamadı.',
      });
      return;
    }

    // Update order
    await client.query(
      `UPDATE shipment_orders
       SET assigned_picker_id = $1, status = 'READY_TO_PICK', updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $2`,
      [picker_id, order_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Toplayıcı başarıyla atandı.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Assign picker error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Start picking order
 */
export const startPicking = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { order_id } = req.params;

    const orderResult = await client.query(
      `SELECT order_id, status, assigned_picker_id FROM shipment_orders WHERE order_id = $1`,
      [order_id]
    );

    if (orderResult.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Sipariş bulunamadı.',
      });
      return;
    }

    const order = orderResult.rows[0];

    if (order.status !== 'READY_TO_PICK' && order.status !== 'PENDING') {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Bu sipariş toplanmaya başlanamaz.',
      });
      return;
    }

    await client.query(
      `UPDATE shipment_orders
       SET status = 'PICKING', picking_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1`,
      [order_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Toplama işlemi başlatıldı.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Start picking error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Record pick confirmation
 */
export const recordPick = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { order_id } = req.params;
    const { item_id, product_sku, location_id, quantity_picked, device_uuid, notes } = req.body;

    if (!item_id || !product_sku || quantity_picked <= 0) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Geçersiz toplama bilgisi.',
      });
      return;
    }

    // Get order item
    const itemResult = await client.query(
      `SELECT * FROM shipment_order_items WHERE item_id = $1 AND order_id = $2`,
      [item_id, order_id]
    );

    if (itemResult.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Sipariş kalemi bulunamadı.',
      });
      return;
    }

    const item = itemResult.rows[0];

    // Update item
    const newQuantityPicked = item.quantity_picked + quantity_picked;
    const newStatus = newQuantityPicked >= item.quantity_ordered ? 'PICKED' : 'PICKING';

    await client.query(
      `UPDATE shipment_order_items
       SET quantity_picked = $1,
           status = $2,
           picked_by = $3,
           picked_at = CURRENT_TIMESTAMP
       WHERE item_id = $4`,
      [newQuantityPicked, newStatus, req.user?.user_id, item_id]
    );

    // Record pick confirmation
    await client.query(
      `INSERT INTO pick_confirmations (
        order_id, item_id, product_sku, location_id, quantity_picked,
        picked_by, device_uuid, scan_method, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'BARCODE', $8)`,
      [order_id, item_id, product_sku, location_id, quantity_picked, req.user?.user_id, device_uuid, notes]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Toplama kaydedildi.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Record pick error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Complete order picking
 */
export const completePicking = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { order_id } = req.params;

    // Check if all items are picked
    const itemsResult = await client.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN status IN ('PICKED', 'PACKED') THEN 1 END) as picked
       FROM shipment_order_items
       WHERE order_id = $1`,
      [order_id]
    );

    const { total, picked } = itemsResult.rows[0];

    if (parseInt(picked) < parseInt(total)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Tüm ürünler toplanmadı.',
      });
      return;
    }

    await client.query(
      `UPDATE shipment_orders
       SET status = 'PICKED', picking_completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $1`,
      [order_id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Sipariş toplanması tamamlandı.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Complete picking error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Cancel order
 */
export const cancelOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { order_id } = req.params;
    const { reason } = req.body;

    await client.query(
      `UPDATE shipment_orders
       SET status = 'CANCELLED', notes = COALESCE(notes || E'\\n', '') || $1, updated_at = CURRENT_TIMESTAMP
       WHERE order_id = $2`,
      [`İptal Nedeni: ${reason || 'Belirtilmedi'}`, order_id]
    );

    // Log audit event
    await client.query(
      `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'CANCEL_ORDER', 'shipment_orders', $3, $4)`,
      [req.user?.user_id, req.user?.username, order_id, JSON.stringify({ reason })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Sipariş iptal edildi.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Cancel order error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Get picker performance stats
 */
export const getPickerPerformance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { picker_id } = req.params;
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params: (string | number | boolean | null)[] = [picker_id];

    if (start_date && end_date) {
      dateFilter = `AND so.picking_completed_at BETWEEN $2 AND $3`;
      params.push(start_date as string, end_date as string);
    }

    const result = await pool.query(
      `SELECT
         COUNT(DISTINCT so.order_id) as orders_completed,
         SUM(so.total_items) as total_items_picked,
         AVG(EXTRACT(EPOCH FROM (so.picking_completed_at - so.picking_started_at)) / 60)::DECIMAL(10,2) as avg_minutes_per_order,
         MAX(so.picking_completed_at) as last_pick_time
       FROM shipment_orders so
       WHERE so.assigned_picker_id = $1
         AND so.status IN ('PICKED', 'SHIPPED')
         ${dateFilter}`,
      params
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    logger.error('Get picker performance error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};
