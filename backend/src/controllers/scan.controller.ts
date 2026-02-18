import { Request, Response } from 'express';
import pool from '../config/database';
import logger from '../config/logger';
import { ScanRequest, ScanResponse, ApiResponse } from '../types';
import { parseSerialBarcode } from './serial.controller';

// Helper to check if barcode might be a serial number format (SKU-XXXXXX)
const isSerialBarcodeFormat = (barcode: string): boolean => {
  const parsed = parseSerialBarcode(barcode);
  return parsed !== null;
};

/**
 * Scan barcode/QR code and return appropriate data
 * Handles: Product barcodes, Container barcodes, Location QR codes
 */
export const scanCode = async (req: Request, res: Response) => {
  try {
    const { barcode, warehouse_code } = req.body as ScanRequest;

    if (!barcode || !warehouse_code) {
      return res.status(400).json({
        success: false,
        error: 'Barcode and warehouse_code are required',
      } as ApiResponse);
    }

    // Get warehouse_id
    const warehouseResult = await pool.query(
      'SELECT warehouse_id FROM wms_warehouses WHERE code = $1',
      [warehouse_code]
    );

    if (warehouseResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found',
      } as ApiResponse);
    }

    const warehouse_id = warehouseResult.rows[0].warehouse_id;

    // Check if it's a product barcode
    const productResult = await pool.query(
      'SELECT * FROM products WHERE barcode = $1 AND is_active = true',
      [barcode]
    );

    if (productResult.rows.length > 0) {
      const product = productResult.rows[0];

      // Get current inventory
      const inventoryResult = await pool.query(
        `SELECT i.*, l.qr_code as location_code
         FROM inventory i
         LEFT JOIN wms_locations l ON i.location_id = l.location_id
         WHERE i.product_sku = $1 AND i.warehouse_id = $2`,
        [product.product_sku, warehouse_id]
      );

      const inventory = inventoryResult.rows[0] || null;

      return res.json({
        success: true,
        type: 'PRODUCT',
        data: {
          product,
          inventory,
        },
      } as ScanResponse);
    }

    // Check if it's a container barcode (KOL-xxxxx or PAL-xxxxx)
    const containerResult = await pool.query(
      `SELECT c.*, w.code as warehouse_code
       FROM wms_containers c
       JOIN wms_warehouses w ON c.warehouse_id = w.warehouse_id
       WHERE c.barcode = $1`,
      [barcode]
    );

    if (containerResult.rows.length > 0) {
      const container = containerResult.rows[0];

      // Get container contents
      const contentsResult = await pool.query(
        `SELECT cc.*, p.product_name, p.barcode as product_barcode
         FROM wms_container_contents cc
         JOIN products p ON cc.product_sku = p.sku_code
         WHERE cc.container_id = $1`,
        [container.container_id]
      );

      return res.json({
        success: true,
        data: {
          type: 'CONTAINER',
          container,
          contents: contentsResult.rows,
        },
      } as ApiResponse);
    }

    // Check if it's a location QR code
    const locationResult = await pool.query(
      `SELECT l.*, w.code as warehouse_code
       FROM wms_locations l
       JOIN wms_warehouses w ON l.warehouse_id = w.warehouse_id
       WHERE l.qr_code = $1 AND l.is_active = true`,
      [barcode]
    );

    if (locationResult.rows.length > 0) {
      const location = locationResult.rows[0];

      // Get inventory at this location
      const inventoryResult = await pool.query(
        `SELECT i.*, p.product_name, p.barcode
         FROM inventory i
         JOIN products p ON i.product_sku = p.sku_code
         WHERE i.location_id = $1 AND i.quantity_each > 0`,
        [location.location_id]
      );

      return res.json({
        success: true,
        data: {
          type: 'LOCATION',
          location,
          inventory: inventoryResult.rows,
        },
      } as ApiResponse);
    }

    // Check if it's an operation mode code (MODE-xxx or ACTION-xxx)
    const operationModeResult = await pool.query(
      `SELECT * FROM operation_modes WHERE mode_code = $1 AND is_active = true`,
      [barcode]
    );

    if (operationModeResult.rows.length > 0) {
      const operationMode = operationModeResult.rows[0];

      return res.json({
        success: true,
        data: {
          type: 'OPERATION_MODE',
          operationMode,
        },
      } as ApiResponse);
    }

    // Check if it's a serial number barcode format (SKU-XXXXXX)
    const serialParsed = parseSerialBarcode(barcode);
    if (serialParsed) {
      // First check if this exact serial exists in serial_numbers table
      const serialResult = await pool.query(
        `SELECT sn.*, p.product_name, p.base_unit, p.units_per_box, p.boxes_per_pallet
         FROM serial_numbers sn
         JOIN products p ON p.product_sku = sn.sku_code
         WHERE sn.full_barcode = $1`,
        [barcode]
      );

      if (serialResult.rows.length > 0) {
        const serial = serialResult.rows[0];

        // Get product info
        const productResult = await pool.query(
          'SELECT * FROM products WHERE product_sku = $1',
          [serial.sku_code]
        );
        const product = productResult.rows[0];

        // Get current inventory for this SKU
        const inventoryResult = await pool.query(
          `SELECT i.*, l.qr_code as location_code
           FROM inventory i
           LEFT JOIN wms_locations l ON i.location_id = l.location_id
           WHERE i.product_sku = $1 AND i.warehouse_id = $2`,
          [serial.product_sku, warehouse_id]
        );
        const inventory = inventoryResult.rows[0] || null;

        return res.json({
          success: true,
          data: {
            type: 'PRODUCT',
            product,
            inventory,
            serial: {
              serial_no: serial.serial_no,
              full_barcode: serial.full_barcode,
              status: serial.status,
            },
          },
        } as ApiResponse);
      }

      // Serial not in DB, but check if SKU part exists as product
      const productFromSerial = await pool.query(
        'SELECT * FROM products WHERE product_sku = $1 AND is_active = true',
        [serialParsed.sku_code]
      );

      if (productFromSerial.rows.length > 0) {
        const product = productFromSerial.rows[0];

        // Get current inventory
        const inventoryResult = await pool.query(
          `SELECT i.*, l.qr_code as location_code
           FROM inventory i
           LEFT JOIN wms_locations l ON i.location_id = l.location_id
           WHERE i.product_sku = $1 AND i.warehouse_id = $2`,
          [product.product_sku, warehouse_id]
        );
        const inventory = inventoryResult.rows[0] || null;

        return res.json({
          success: true,
          data: {
            type: 'PRODUCT',
            product,
            inventory,
            serial: {
              serial_no: serialParsed.serial_no,
              full_barcode: barcode,
              status: 'UNKNOWN', // Not registered yet
            },
          },
        } as ApiResponse);
      }
    }

    // Check if it's a SKU code (for products without barcode)
    const skuResult = await pool.query(
      'SELECT * FROM products WHERE product_sku = $1 AND is_active = true',
      [barcode]
    );

    if (skuResult.rows.length > 0) {
      const product = skuResult.rows[0];

      // Get current inventory
      const inventoryResult = await pool.query(
        `SELECT i.*, l.qr_code as location_code
         FROM inventory i
         LEFT JOIN wms_locations l ON i.location_id = l.location_id
         WHERE i.product_sku = $1 AND i.warehouse_id = $2`,
        [product.product_sku, warehouse_id]
      );

      const inventory = inventoryResult.rows[0] || null;

      return res.json({
        success: true,
        type: 'PRODUCT',
        data: {
          product,
          inventory,
        },
      } as ScanResponse);
    }

    // Code not found
    return res.status(404).json({
      success: false,
      error: 'Barcode/QR code not found',
      message: `No product, container, or location found with code: ${barcode}`,
    } as ApiResponse);

  } catch (error) {
    logger.error('Scan error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during scan',
    } as ApiResponse);
  }
};

/**
 * Quick lookup by SKU code (for manual entry)
 */
export const lookupBySku = async (req: Request, res: Response) => {
  try {
    const { product_sku, warehouse_code } = req.query;

    if (!product_sku || !warehouse_code) {
      return res.status(400).json({
        success: false,
        error: 'sku_code and warehouse_code are required',
      } as ApiResponse);
    }

    const result = await pool.query(
      `SELECT 
        p.*,
        i.quantity_each,
        i.last_updated,
        l.qr_code as location_code
       FROM products p
       LEFT JOIN inventory i ON p.product_sku = i.sku_code
       LEFT JOIN wms_warehouses w ON i.warehouse_id = w.warehouse_id
       LEFT JOIN wms_locations l ON i.location_id = l.location_id
       WHERE p.product_sku = $1 
         AND p.is_active = true
         AND w.code = $2`,
      [product_sku, warehouse_code]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Product not found',
      } as ApiResponse);
    }

    return res.json({
      success: true,
      data: result.rows[0],
    } as ApiResponse);

  } catch (error) {
    logger.error('Lookup error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during lookup',
    } as ApiResponse);
  }
};
