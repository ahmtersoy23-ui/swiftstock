import { Request, Response } from 'express';
import pool from '../config/database';
import { TransactionCreateRequest, ApiResponse } from '../types';

/**
 * Create a new transaction (IN or OUT)
 * Handles continuous scan accumulation
 */
export const createTransaction = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const {
      transaction_type,
      warehouse_code,
      location_qr,
      items,
      reference_no,
      notes,
      created_by,
      device_id,
    } = req.body as TransactionCreateRequest;

    // Validation
    if (!transaction_type || !warehouse_code || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
      } as ApiResponse);
    }

    await client.query('BEGIN');

    // Get warehouse_id
    const warehouseResult = await client.query(
      'SELECT warehouse_id FROM wms_warehouses WHERE code = $1',
      [warehouse_code]
    );

    if (warehouseResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Warehouse not found',
      } as ApiResponse);
    }

    const warehouse_id = warehouseResult.rows[0].warehouse_id;

    // Get location_id if location_qr provided
    let location_id = null;
    if (location_qr) {
      const locationResult = await client.query(
        'SELECT location_id FROM wms_locations WHERE qr_code = $1 AND warehouse_id = $2',
        [location_qr, warehouse_id]
      );

      if (locationResult.rows.length > 0) {
        location_id = locationResult.rows[0].location_id;
      } else {
        // Use default MAIN location
        const mainLocationResult = await client.query(
          `SELECT location_id FROM wms_locations 
           WHERE warehouse_id = $1 AND qr_code LIKE '%-MAIN'`,
          [warehouse_id]
        );
        if (mainLocationResult.rows.length > 0) {
          location_id = mainLocationResult.rows[0].location_id;
        }
      }
    } else {
      // Use default MAIN location
      const mainLocationResult = await client.query(
        `SELECT location_id FROM wms_locations 
         WHERE warehouse_id = $1 AND qr_code LIKE '%-MAIN'`,
        [warehouse_id]
      );
      if (mainLocationResult.rows.length > 0) {
        location_id = mainLocationResult.rows[0].location_id;
      }
    }

    // Create transaction
    const transactionResult = await client.query(
      `INSERT INTO transactions 
       (transaction_type, warehouse_id, location_id, reference_no, notes, created_by, device_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [transaction_type, warehouse_id, location_id, reference_no, notes, created_by, device_id]
    );

    const transaction = transactionResult.rows[0];

    // Process items - Batch query optimization to avoid N+1 problem
    const processedItems = [];

    // Step 1: Collect all SKU codes and barcodes
    const skuCodes = items.map(item => item.sku_code).filter(Boolean);
    const barcodes = items.map(item => item.barcode).filter(Boolean);

    // Step 2: Fetch all products in one query
    const allIdentifiers = [...skuCodes, ...barcodes];
    const productDetailsResult = await client.query(
      `SELECT product_sku, barcode, units_per_box, boxes_per_pallet
       FROM products
       WHERE product_sku = ANY($1) OR barcode = ANY($1)`,
      [allIdentifiers]
    );

    // Create lookup maps for O(1) access
    const productBySku = new Map();
    const productByBarcode = new Map();
    productDetailsResult.rows.forEach(p => {
      productBySku.set(p.product_sku, p);
      if (p.barcode) productByBarcode.set(p.barcode, p);
    });

    // Step 3: Fetch all inventory data in one query (for OUT transactions)
    let inventoryMap = new Map();
    if (transaction_type === 'OUT') {
      const skuList = items.map(item => {
        let sku = item.sku_code;
        if (!sku && item.barcode) {
          const product = productByBarcode.get(item.barcode);
          sku = product?.sku_code;
        }
        return sku;
      }).filter(Boolean);

      const inventoryResult = await client.query(
        `SELECT product_sku, quantity_each
         FROM inventory
         WHERE product_sku = ANY($1) AND warehouse_id = $2 AND location_id = $3`,
        [skuList, warehouse_id, location_id]
      );

      inventoryResult.rows.forEach(inv => {
        inventoryMap.set(inv.product_sku, inv.quantity_each);
      });
    }

    // Step 4: Process items with in-memory data
    for (const item of items) {
      let product_sku = item.sku_code;

      // Resolve barcode to SKU if needed
      if (item.barcode && !product_sku) {
        const product = productByBarcode.get(item.barcode);
        if (!product) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            error: `Product not found for barcode: ${item.barcode}`,
          } as ApiResponse);
        }
        product_sku = product.sku_code;
      }

      // Get product details from map
      const product = productBySku.get(product_sku);
      if (!product) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: `Product not found: ${product_sku}`,
        } as ApiResponse);
      }

      const { units_per_box, boxes_per_pallet } = product;

      // Convert to EACH units
      const unit_type = item.unit_type || 'EACH';
      let quantity_each = item.quantity;

      if (unit_type === 'BOX') {
        quantity_each = item.quantity * units_per_box;
      } else if (unit_type === 'PALLET') {
        quantity_each = item.quantity * units_per_box * boxes_per_pallet;
      }

      // Check stock for OUT transactions
      if (transaction_type === 'OUT') {
        const currentStock = inventoryMap.get(product_sku) || 0;
        if (currentStock < quantity_each) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: `Insufficient stock for ${product_sku}. Available: ${currentStock}, Requested: ${quantity_each}`,
          } as ApiResponse);
        }
      }

      // Insert transaction item
      const itemResult = await client.query(
        `INSERT INTO transaction_items
         (transaction_id, product_sku, quantity, unit_type, quantity_each, to_location_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [transaction.transaction_id, product_sku, item.quantity, unit_type, quantity_each, location_id]
      );

      processedItems.push(itemResult.rows[0]);

      // Update inventory table
      const inventoryDelta = transaction_type === 'IN' ? quantity_each : -quantity_each;

      // Check if inventory record exists for this SKU + warehouse + location
      const existingInventory = await client.query(
        `SELECT inventory_id, quantity_each FROM inventory
         WHERE product_sku = $1 AND warehouse_id = $2 AND location_id = $3
         FOR UPDATE`,
        [product_sku, warehouse_id, location_id]
      );

      if (existingInventory.rows.length > 0) {
        // Update existing inventory
        await client.query(
          `UPDATE inventory
           SET quantity_each = quantity_each + $1, last_updated = NOW()
           WHERE inventory_id = $2`,
          [inventoryDelta, existingInventory.rows[0].inventory_id]
        );
      } else {
        // Insert new inventory record (only for IN transactions)
        if (transaction_type === 'IN') {
          await client.query(
            `INSERT INTO inventory (product_sku, warehouse_id, location_id, quantity_each, quantity_box, quantity_pallet)
             VALUES ($1, $2, $3, $4, 0, 0)`,
            [product_sku, warehouse_id, location_id, quantity_each]
          );
        }
      }
    }

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      data: {
        transaction,
        items: processedItems,
      },
      message: `Transaction ${transaction_type} completed successfully`,
    } as ApiResponse);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Transaction error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during transaction',
    } as ApiResponse);
  } finally {
    client.release();
  }
};

/**
 * Get recent transactions
 */
export const getRecentTransactions = async (req: Request, res: Response) => {
  try {
    const { warehouse_code } = req.query;
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 500);

    let query = `
      SELECT 
        t.*,
        w.code as warehouse_code,
        l.qr_code as location_code,
        COUNT(ti.item_id) as item_count
      FROM transactions t
      JOIN wms_warehouses w ON t.warehouse_id = w.warehouse_id
      LEFT JOIN wms_locations l ON t.location_id = l.location_id
      LEFT JOIN transaction_items ti ON t.transaction_id = ti.transaction_id
    `;

    const params: any[] = [];
    if (warehouse_code) {
      query += ' WHERE w.code = $1';
      params.push(warehouse_code);
    }

    query += `
      GROUP BY t.transaction_id, w.code, l.qr_code
      ORDER BY t.created_at DESC
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const result = await pool.query(query, params);

    return res.json({
      success: true,
      data: result.rows,
    } as ApiResponse);

  } catch (error) {
    console.error('Get transactions error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};

/**
 * Get transaction details with items
 */
export const getTransactionDetails = async (req: Request, res: Response) => {
  try {
    const { transaction_id } = req.params;

    const transactionResult = await pool.query(
      `SELECT t.*, w.code as warehouse_code, l.qr_code as location_code
       FROM transactions t
       JOIN wms_warehouses w ON t.warehouse_id = w.warehouse_id
       LEFT JOIN wms_locations l ON t.location_id = l.location_id
       WHERE t.transaction_id = $1`,
      [transaction_id]
    );

    if (transactionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      } as ApiResponse);
    }

    const transaction = transactionResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT ti.*, p.product_name, p.barcode
       FROM transaction_items ti
       JOIN products p ON ti.product_sku = p.sku_code
       WHERE ti.transaction_id = $1`,
      [transaction_id]
    );

    return res.json({
      success: true,
      data: {
        ...transaction,
        items: itemsResult.rows,
      },
    } as ApiResponse);

  } catch (error) {
    console.error('Get transaction details error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
    } as ApiResponse);
  }
};

/**
 * Undo last transaction (soft delete or reverse)
 */
export const undoTransaction = async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const { transaction_id } = req.params;
    const { user } = req.body;

    await client.query('BEGIN');

    // Get transaction details
    const transactionResult = await client.query(
      'SELECT * FROM transactions WHERE transaction_id = $1',
      [transaction_id]
    );

    if (transactionResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Transaction not found',
      } as ApiResponse);
    }

    const transaction = transactionResult.rows[0];

    // Get items
    const itemsResult = await client.query(
      'SELECT * FROM transaction_items WHERE transaction_id = $1',
      [transaction_id]
    );

    // Create reverse transaction
    const reverseType = transaction.transaction_type === 'IN' ? 'OUT' : 'IN';

    const reverseTransactionResult = await client.query(
      `INSERT INTO transactions 
       (transaction_type, warehouse_id, location_id, reference_no, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        reverseType,
        transaction.warehouse_id,
        transaction.location_id,
        `UNDO-${transaction.transaction_id}`,
        `Undo of transaction ${transaction.transaction_id}`,
        user,
      ]
    );

    const reverseTransaction = reverseTransactionResult.rows[0];

    // Reverse all items (batched INSERT)
    if (itemsResult.rows.length > 0) {
      const valuesClauses: string[] = [];
      const insertParams: any[] = [];
      itemsResult.rows.forEach((item: any, idx: number) => {
        const offset = idx * 6;
        valuesClauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
        insertParams.push(
          reverseTransaction.transaction_id,
          item.product_sku,
          item.quantity,
          item.unit_type,
          item.quantity_each,
          item.to_location_id,
        );
      });
      await client.query(
        `INSERT INTO transaction_items
         (transaction_id, product_sku, quantity, unit_type, quantity_each, to_location_id)
         VALUES ${valuesClauses.join(', ')}`,
        insertParams
      );
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      data: reverseTransaction,
      message: 'Transaction undone successfully',
    } as ApiResponse);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Undo transaction error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error during undo',
    } as ApiResponse);
  } finally {
    client.release();
  }
};
