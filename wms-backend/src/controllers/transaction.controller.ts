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
      'SELECT warehouse_id FROM warehouses WHERE code = $1',
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
        'SELECT location_id FROM locations WHERE qr_code = $1 AND warehouse_id = $2',
        [location_qr, warehouse_id]
      );

      if (locationResult.rows.length > 0) {
        location_id = locationResult.rows[0].location_id;
      } else {
        // Use default MAIN location
        const mainLocationResult = await client.query(
          `SELECT location_id FROM locations 
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
        `SELECT location_id FROM locations 
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
      `SELECT sku_code, barcode, units_per_box, boxes_per_pallet
       FROM products
       WHERE sku_code = ANY($1) OR barcode = ANY($1)`,
      [allIdentifiers]
    );

    // Create lookup maps for O(1) access
    const productBySku = new Map();
    const productByBarcode = new Map();
    productDetailsResult.rows.forEach(p => {
      productBySku.set(p.sku_code, p);
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
        `SELECT sku_code, quantity_each
         FROM inventory
         WHERE sku_code = ANY($1) AND warehouse_id = $2 AND location_id = $3`,
        [skuList, warehouse_id, location_id]
      );

      inventoryResult.rows.forEach(inv => {
        inventoryMap.set(inv.sku_code, inv.quantity_each);
      });
    }

    // Step 4: Process items with in-memory data
    for (const item of items) {
      let sku_code = item.sku_code;

      // Resolve barcode to SKU if needed
      if (item.barcode && !sku_code) {
        const product = productByBarcode.get(item.barcode);
        if (!product) {
          await client.query('ROLLBACK');
          return res.status(404).json({
            success: false,
            error: `Product not found for barcode: ${item.barcode}`,
          } as ApiResponse);
        }
        sku_code = product.sku_code;
      }

      // Get product details from map
      const product = productBySku.get(sku_code);
      if (!product) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          success: false,
          error: `Product not found: ${sku_code}`,
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
        const currentStock = inventoryMap.get(sku_code) || 0;
        if (currentStock < quantity_each) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: `Insufficient stock for ${sku_code}. Available: ${currentStock}, Requested: ${quantity_each}`,
          } as ApiResponse);
        }
      }

      // Insert transaction item
      const itemResult = await client.query(
        `INSERT INTO transaction_items
         (transaction_id, sku_code, quantity, unit_type, quantity_each, to_location_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [transaction.transaction_id, sku_code, item.quantity, unit_type, quantity_each, location_id]
      );

      processedItems.push(itemResult.rows[0]);
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
    const { warehouse_code, limit = 20 } = req.query;

    let query = `
      SELECT 
        t.*,
        w.code as warehouse_code,
        l.qr_code as location_code,
        COUNT(ti.item_id) as item_count
      FROM transactions t
      JOIN warehouses w ON t.warehouse_id = w.warehouse_id
      LEFT JOIN locations l ON t.location_id = l.location_id
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
       JOIN warehouses w ON t.warehouse_id = w.warehouse_id
       LEFT JOIN locations l ON t.location_id = l.location_id
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
       JOIN products p ON ti.sku_code = p.sku_code
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

    // Reverse all items
    for (const item of itemsResult.rows) {
      await client.query(
        `INSERT INTO transaction_items 
         (transaction_id, sku_code, quantity, unit_type, quantity_each, to_location_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          reverseTransaction.transaction_id,
          item.sku_code,
          item.quantity,
          item.unit_type,
          item.quantity_each,
          item.to_location_id,
        ]
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
