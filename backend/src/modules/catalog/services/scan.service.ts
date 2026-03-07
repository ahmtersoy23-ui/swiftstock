// ============================================
// SCAN SERVICE — Module 1 (Catalog)
// Barkod/QR tarama iş mantığı. Facade: product, container, location, operation, serial.
// ============================================

import pool from '../../../config/database';
import { parseSerialBarcode } from './serial.service';

// ── Service ───────────────────────────────────────────────────────────────────

class ScanService {
  async scanCode(barcode: string, warehouse_code: string) {
    // Get warehouse_id
    const warehouseResult = await pool.query(
      'SELECT warehouse_id FROM wms_warehouses WHERE code = $1',
      [warehouse_code],
    );

    if (warehouseResult.rows.length === 0) {
      return { notFound: true, reason: 'Warehouse not found' };
    }

    const warehouse_id = warehouseResult.rows[0].warehouse_id;

    // Check if it's a product SKU (barcode field removed from products)
    const productResult = await pool.query(
      'SELECT * FROM products WHERE product_sku = $1',
      [barcode],
    );

    if (productResult.rows.length > 0) {
      const product = productResult.rows[0];

      const inventoryResult = await pool.query(
        `SELECT i.*, l.qr_code as location_code
         FROM wms_inventory i
         LEFT JOIN wms_locations l ON i.location_id = l.location_id
         WHERE i.product_sku = $1 AND i.warehouse_id = $2`,
        [product.product_sku, warehouse_id],
      );

      return {
        type: 'PRODUCT',
        data: { product, inventory: inventoryResult.rows[0] ?? null },
      };
    }

    // Check if it's a container barcode
    const containerResult = await pool.query(
      `SELECT c.*, w.code as warehouse_code
       FROM wms_containers c
       JOIN wms_warehouses w ON c.warehouse_id = w.warehouse_id
       WHERE c.barcode = $1`,
      [barcode],
    );

    if (containerResult.rows.length > 0) {
      const container = containerResult.rows[0];

      const contentsResult = await pool.query(
        `SELECT cc.*, p.name AS product_name
         FROM wms_container_contents cc
         JOIN products p ON cc.product_sku = p.product_sku
         WHERE cc.container_id = $1`,
        [container.container_id],
      );

      return {
        type: 'CONTAINER',
        data: { type: 'CONTAINER', container, contents: contentsResult.rows },
      };
    }

    // Check if it's a location QR code
    const locationResult = await pool.query(
      `SELECT l.*, w.code as warehouse_code
       FROM wms_locations l
       JOIN wms_warehouses w ON l.warehouse_id = w.warehouse_id
       WHERE l.qr_code = $1 AND l.is_active = true`,
      [barcode],
    );

    if (locationResult.rows.length > 0) {
      const location = locationResult.rows[0];

      const inventoryResult = await pool.query(
        `SELECT i.*, p.name AS product_name
         FROM wms_inventory i
         JOIN products p ON i.product_sku = p.product_sku
         WHERE i.location_id = $1 AND i.quantity > 0`,
        [location.location_id],
      );

      return {
        type: 'LOCATION',
        data: { type: 'LOCATION', location, inventory: inventoryResult.rows },
      };
    }

    // Check if it's an operation mode code
    const operationModeResult = await pool.query(
      'SELECT * FROM operation_modes WHERE mode_code = $1 AND is_active = true',
      [barcode],
    );

    if (operationModeResult.rows.length > 0) {
      return {
        type: 'OPERATION_MODE',
        data: { type: 'OPERATION_MODE', operationMode: operationModeResult.rows[0] },
      };
    }

    // Check if it's a serial number barcode format (SKU-XXXXXX)
    const serialParsed = parseSerialBarcode(barcode);
    if (serialParsed) {
      const serialResult = await pool.query(
        `SELECT sn.*, p.name AS product_name
         FROM wms_serial_numbers sn
         JOIN products p ON p.product_sku = sn.sku_code
         WHERE sn.full_barcode = $1`,
        [barcode],
      );

      if (serialResult.rows.length > 0) {
        const serial = serialResult.rows[0];

        const productFromSerial = await pool.query(
          'SELECT * FROM products WHERE product_sku = $1',
          [serial.sku_code],
        );
        const product = productFromSerial.rows[0];

        const inventoryResult = await pool.query(
          `SELECT i.*, l.qr_code as location_code
           FROM wms_inventory i
           LEFT JOIN wms_locations l ON i.location_id = l.location_id
           WHERE i.product_sku = $1 AND i.warehouse_id = $2`,
          [serial.product_sku, warehouse_id],
        );

        return {
          type: 'PRODUCT',
          data: {
            type: 'PRODUCT',
            product,
            inventory: inventoryResult.rows[0] ?? null,
            serial: {
              serial_no: serial.serial_no,
              full_barcode: serial.full_barcode,
              status: serial.status,
            },
          },
        };
      }

      // Serial not in DB, check if SKU part exists
      const productFromSerial = await pool.query(
        'SELECT * FROM products WHERE product_sku = $1',
        [serialParsed.sku_code],
      );

      if (productFromSerial.rows.length > 0) {
        const product = productFromSerial.rows[0];

        const inventoryResult = await pool.query(
          `SELECT i.*, l.qr_code as location_code
           FROM wms_inventory i
           LEFT JOIN wms_locations l ON i.location_id = l.location_id
           WHERE i.product_sku = $1 AND i.warehouse_id = $2`,
          [product.product_sku, warehouse_id],
        );

        return {
          type: 'PRODUCT',
          data: {
            type: 'PRODUCT',
            product,
            inventory: inventoryResult.rows[0] ?? null,
            serial: {
              serial_no: serialParsed.serial_no,
              full_barcode: barcode,
              status: 'UNKNOWN',
            },
          },
        };
      }
    }

    // Check if it's a SKU code (for products without barcode)
    const skuResult = await pool.query(
      'SELECT * FROM products WHERE product_sku = $1',
      [barcode],
    );

    if (skuResult.rows.length > 0) {
      const product = skuResult.rows[0];

      const inventoryResult = await pool.query(
        `SELECT i.*, l.qr_code as location_code
         FROM wms_inventory i
         LEFT JOIN wms_locations l ON i.location_id = l.location_id
         WHERE i.product_sku = $1 AND i.warehouse_id = $2`,
        [product.product_sku, warehouse_id],
      );

      return {
        type: 'PRODUCT',
        data: { product, inventory: inventoryResult.rows[0] ?? null },
      };
    }

    return null;
  }

  async lookupBySku(product_sku: string, warehouse_code: string) {
    const result = await pool.query(
      `SELECT
        p.*,
        i.quantity,
        i.last_updated_at,
        l.qr_code as location_code
       FROM products p
       LEFT JOIN wms_inventory i ON p.product_sku = i.product_sku
       LEFT JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       LEFT JOIN wms_locations l ON i.location_id = l.location_id
       WHERE p.product_sku = $1
         AND w.code = $2`,
      [product_sku, warehouse_code],
    );

    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0];
  }
}

export const scanService = new ScanService();
export default scanService;
