// ============================================
// ORDER SERVICE — Module 3
// Sipariş & Picking iş mantığı. Controller sadece req/res yönetir.
// Tablolar: shipment_orders, shipment_order_items, pick_lists,
//           pick_list_orders, pick_confirmations, packing_records
// Coupling: 4/10 — düşük-orta
// ============================================

import pool from '../../../config/database';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../constants';

// ── Domain Error ──────────────────────────────────────────────────────────────

export class OrderError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'OrderError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OrderFilters {
  page?: string | number;
  limit?: string | number;
  warehouse_code?: string;
  status?: string;
  priority?: string;
  assigned_picker_id?: string;
  search?: string;
}

export interface OrderItem {
  sku_code?: string;
  product_sku?: string;
  quantity: number;
}

export interface CreateOrderInput {
  order_number: string;
  external_order_id?: string;
  warehouse_code: string;
  customer_name: string;
  customer_address?: string;
  customer_email?: string;
  customer_phone?: string;
  requested_ship_date?: string;
  priority?: string;
  items: OrderItem[];
  notes?: string;
}

export interface RecordPickInput {
  item_id: number;
  product_sku: string;
  location_id?: number;
  quantity_picked: number;
  device_uuid?: string;
  notes?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

class OrderService {
  async getAllOrders(filters: OrderFilters) {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      warehouse_code,
      status,
      priority,
      assigned_picker_id,
      search,
    } = filters;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(MAX_PAGE_SIZE, parseInt(limit as string));
    const offset = (pageNum - 1) * limitNum;

    const whereConditions: string[] = [];
    const queryParams: (string | number | boolean | null)[] = [];
    let paramIndex = 1;

    if (warehouse_code) {
      whereConditions.push(`so.warehouse_code = $${paramIndex++}`);
      queryParams.push(warehouse_code);
    }
    if (status) {
      whereConditions.push(`so.status = $${paramIndex++}`);
      queryParams.push(status);
    }
    if (priority) {
      whereConditions.push(`so.priority = $${paramIndex++}`);
      queryParams.push(priority);
    }
    if (assigned_picker_id) {
      whereConditions.push(`so.assigned_picker_id = $${paramIndex++}`);
      queryParams.push(assigned_picker_id);
    }
    if (search) {
      whereConditions.push(
        `(so.order_number ILIKE $${paramIndex} OR so.customer_name ILIKE $${paramIndex})`,
      );
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause =
      whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM shipment_orders so ${whereClause}`,
      queryParams,
    );
    const total = parseInt(countResult.rows[0].total);

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
      [...queryParams, limitNum, offset],
    );

    return {
      data: ordersResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  }

  async getOrderById(order_id: string) {
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
      [order_id],
    );

    if (orderResult.rows.length === 0) {
      throw new OrderError(404, 'Sipariş bulunamadı.');
    }

    const itemsResult = await pool.query(
      `SELECT
         soi.*,
         p.name AS product_name,
 
         l.location_code,
         u.username as picked_by_username
       FROM shipment_order_items soi
       LEFT JOIN products p ON soi.product_sku = p.product_sku
       LEFT JOIN wms_locations l ON soi.location_id = l.location_id
       LEFT JOIN wms_users u ON soi.picked_by = u.user_id
       WHERE soi.order_id = $1
       ORDER BY l.aisle NULLS LAST, l.bay NULLS LAST, l.level NULLS LAST, soi.line_number`,
      [order_id],
    );

    return { ...orderResult.rows[0], items: itemsResult.rows };
  }

  async createOrder(
    data: CreateOrderInput,
    createdBy: string,
    userId?: number,
    username?: string,
  ) {
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
    } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existingOrder = await client.query(
        `SELECT order_id FROM shipment_orders WHERE order_number = $1`,
        [order_number],
      );

      if (existingOrder.rows.length > 0) {
        throw new OrderError(409, 'Bu sipariş numarası zaten mevcut.');
      }

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
          createdBy,
        ],
      );

      const newOrder = orderResult.rows[0];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Normalize: OrderItem accepts both sku_code and product_sku for backward compat
        const sku = item.product_sku ?? item.sku_code;

        const productResult = await client.query(
          `SELECT product_sku, name AS product_name FROM products WHERE product_sku = $1`,
          [sku],
        );

        if (productResult.rows.length === 0) {
          throw new Error(`Ürün bulunamadı: ${sku}`);
        }

        const product = productResult.rows[0];

        const locationResult = await client.query(
          `SELECT li.location_id, l.location_code, li.quantity
           FROM location_inventory li
           JOIN wms_locations l ON li.location_id = l.location_id
           WHERE li.product_sku = $1
             AND l.warehouse_id = (SELECT warehouse_id FROM wms_warehouses WHERE code = $2)
             AND li.quantity > 0
           ORDER BY li.quantity DESC
           LIMIT 1`,
          [sku, warehouse_code],
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
            item.quantity,
            location?.location_id,
            location?.location_code,
          ],
        );
      }

      await client.query(
        `INSERT INTO wms_audit_logs (user_id, username, action, resource_type, resource_id, details)
         VALUES ($1, $2, 'CREATE_ORDER', 'shipment_orders', $3, $4)`,
        [
          userId ?? null,
          username,
          newOrder.order_id.toString(),
          JSON.stringify({ order_number, customer_name, items_count: items.length }),
        ],
      );

      await client.query('COMMIT');

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
        [newOrder.order_id],
      );

      return completeOrder.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async assignPicker(order_id: string, picker_id: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const pickerResult = await client.query(
        `SELECT user_id, username FROM wms_users WHERE user_id = $1 AND is_active = true`,
        [picker_id],
      );

      if (pickerResult.rows.length === 0) {
        throw new OrderError(404, 'Toplayıcı bulunamadı.');
      }

      await client.query(
        `UPDATE shipment_orders
         SET assigned_picker_id = $1, status = 'READY_TO_PICK', updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2`,
        [picker_id, order_id],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async startPicking(order_id: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const orderResult = await client.query(
        `SELECT order_id, status FROM shipment_orders WHERE order_id = $1`,
        [order_id],
      );

      if (orderResult.rows.length === 0) {
        throw new OrderError(404, 'Sipariş bulunamadı.');
      }

      const order = orderResult.rows[0];

      if (order.status !== 'READY_TO_PICK' && order.status !== 'PENDING') {
        throw new OrderError(400, 'Bu sipariş toplanmaya başlanamaz.');
      }

      await client.query(
        `UPDATE shipment_orders
         SET status = 'PICKING', picking_started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1`,
        [order_id],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async recordPick(order_id: string, data: RecordPickInput, pickedBy?: number) {
    const { item_id, product_sku, location_id, quantity_picked, device_uuid, notes } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const itemResult = await client.query(
        `SELECT * FROM shipment_order_items WHERE item_id = $1 AND order_id = $2`,
        [item_id, order_id],
      );

      if (itemResult.rows.length === 0) {
        throw new OrderError(404, 'Sipariş kalemi bulunamadı.');
      }

      const item = itemResult.rows[0];

      const newQuantityPicked = item.quantity_picked + quantity_picked;
      const newStatus = newQuantityPicked >= item.quantity_ordered ? 'PICKED' : 'PICKING';

      await client.query(
        `UPDATE shipment_order_items
         SET quantity_picked = $1,
             status = $2,
             picked_by = $3,
             picked_at = CURRENT_TIMESTAMP
         WHERE item_id = $4`,
        [newQuantityPicked, newStatus, pickedBy, item_id],
      );

      await client.query(
        `INSERT INTO pick_confirmations (
          order_id, item_id, product_sku, location_id, quantity_picked,
          picked_by, device_uuid, scan_method, notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'BARCODE', $8)`,
        [order_id, item_id, product_sku, location_id, quantity_picked, pickedBy, device_uuid, notes],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async completePicking(order_id: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const itemsResult = await client.query(
        `SELECT COUNT(*) as total,
                COUNT(CASE WHEN status IN ('PICKED', 'PACKED') THEN 1 END) as picked
         FROM shipment_order_items
         WHERE order_id = $1`,
        [order_id],
      );

      const { total, picked } = itemsResult.rows[0];

      if (parseInt(picked) < parseInt(total)) {
        throw new OrderError(400, 'Tüm ürünler toplanmadı.');
      }

      await client.query(
        `UPDATE shipment_orders
         SET status = 'PICKED', picking_completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $1`,
        [order_id],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelOrder(
    order_id: string,
    reason?: string,
    user?: { user_id?: number; username?: string },
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE shipment_orders
         SET status = 'CANCELLED', notes = COALESCE(notes || E'\\n', '') || $1, updated_at = CURRENT_TIMESTAMP
         WHERE order_id = $2`,
        [`İptal Nedeni: ${reason || 'Belirtilmedi'}`, order_id],
      );

      await client.query(
        `INSERT INTO wms_audit_logs (user_id, username, action, resource_type, resource_id, details)
         VALUES ($1, $2, 'CANCEL_ORDER', 'shipment_orders', $3, $4)`,
        [user?.user_id, user?.username, order_id, JSON.stringify({ reason })],
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getPickerPerformance(
    picker_id: string,
    start_date?: string,
    end_date?: string,
  ) {
    let dateFilter = '';
    const params: (string | number | boolean | null)[] = [picker_id];

    if (start_date && end_date) {
      dateFilter = `AND so.picking_completed_at BETWEEN $2 AND $3`;
      params.push(start_date, end_date);
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
      params,
    );

    return result.rows[0];
  }
}

export const orderService = new OrderService();
export default orderService;
