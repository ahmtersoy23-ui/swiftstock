// ============================================
// TRANSACTION SERVICE — Module 4 (Inventory Core)
// Transaction iş mantığı. HTTP ve event listener tarafından kullanılır.
// Tablolar: transactions, transaction_items, inventory
// Coupling: 3/10 — düşük
// ============================================

import pool from '../../../config/database';
import logger from '../../../config/logger';

// ── Domain Error ──────────────────────────────────────────────────────────────

export class TransactionError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TransactionItem {
  product_sku?: string;
  sku_code?: string;
  barcode?: string;
  quantity: number;
  unit_type?: string;
}

export interface CreateTransactionInput {
  transaction_type: string;
  // HTTP path: warehouse_code + optional location_qr
  warehouse_code?: string;
  location_qr?: string;
  // Event path: direct IDs (skip DB lookup)
  warehouse_id?: number;
  location_id?: number;
  items: TransactionItem[];
  reference_no?: string;
  notes?: string;
  created_by?: string;
  device_id?: string;
}

export interface TransactionFilters {
  warehouse_code?: string;
  limit?: string | number;
}

// ── Service ───────────────────────────────────────────────────────────────────

class TransactionService {
  async createTransaction(data: CreateTransactionInput) {
    const {
      transaction_type,
      warehouse_code,
      location_qr,
      items,
      reference_no,
      notes,
      created_by,
      device_id,
    } = data;

    if (!transaction_type || !items || items.length === 0) {
      throw new TransactionError(400, 'Missing required fields');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ── Resolve warehouse_id ──────────────────────────────────────────────
      let warehouse_id = data.warehouse_id ?? null;
      if (warehouse_id == null) {
        if (!warehouse_code) {
          throw new TransactionError(400, 'warehouse_code or warehouse_id is required');
        }
        const warehouseResult = await client.query(
          'SELECT warehouse_id FROM warehouses WHERE code = $1',
          [warehouse_code],
        );
        if (warehouseResult.rows.length === 0) {
          throw new TransactionError(404, 'Warehouse not found');
        }
        warehouse_id = warehouseResult.rows[0].warehouse_id;
      }

      // ── Resolve location_id ───────────────────────────────────────────────
      let location_id: number | null = data.location_id ?? null;
      if (location_id == null) {
        if (location_qr) {
          const locationResult = await client.query(
            'SELECT location_id FROM locations WHERE qr_code = $1 AND warehouse_id = $2',
            [location_qr, warehouse_id],
          );
          if (locationResult.rows.length > 0) {
            location_id = locationResult.rows[0].location_id;
          }
        }
        if (location_id == null) {
          const mainResult = await client.query(
            `SELECT location_id FROM locations WHERE warehouse_id = $1 AND qr_code LIKE '%-MAIN'`,
            [warehouse_id],
          );
          if (mainResult.rows.length > 0) {
            location_id = mainResult.rows[0].location_id;
          }
        }
      }

      // ── Create transaction record ─────────────────────────────────────────
      const transactionResult = await client.query(
        `INSERT INTO transactions
         (transaction_type, warehouse_id, location_id, reference_no, notes, created_by, device_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [transaction_type, warehouse_id, location_id, reference_no, notes, created_by, device_id],
      );
      const transaction = transactionResult.rows[0];

      // ── Batch-fetch products ──────────────────────────────────────────────
      const skuCodes = items.map((i) => i.product_sku ?? i.sku_code).filter(Boolean) as string[];
      const barcodes = items.map((i) => i.barcode).filter(Boolean) as string[];
      const allIdentifiers = [...skuCodes, ...barcodes];

      const productDetailsResult = await client.query(
        `SELECT product_sku, barcode, units_per_box, boxes_per_pallet
         FROM products
         WHERE product_sku = ANY($1) OR barcode = ANY($1)`,
        [allIdentifiers],
      );
      const productBySku = new Map<string, Record<string, unknown>>();
      const productByBarcode = new Map<string, Record<string, unknown>>();
      productDetailsResult.rows.forEach((p) => {
        productBySku.set(p.product_sku, p);
        if (p.barcode) productByBarcode.set(p.barcode, p);
      });

      // ── Batch-fetch inventory (OUT check) ─────────────────────────────────
      const inventoryMap = new Map<string, number>();
      if (transaction_type === 'OUT') {
        const skuList = items.map((item) => {
          let sku = item.product_sku ?? item.sku_code;
          if (!sku && item.barcode) {
            sku = (productByBarcode.get(item.barcode) as { product_sku: string } | undefined)?.product_sku;
          }
          return sku;
        }).filter(Boolean) as string[];

        const inventoryResult = await client.query(
          `SELECT product_sku, quantity_each
           FROM inventory
           WHERE product_sku = ANY($1) AND warehouse_id = $2 AND location_id = $3`,
          [skuList, warehouse_id, location_id],
        );
        inventoryResult.rows.forEach((inv) => {
          inventoryMap.set(inv.product_sku, inv.quantity_each);
        });
      }

      // ── Process each item ─────────────────────────────────────────────────
      const processedItems = [];
      for (const item of items) {
        let product_sku = item.product_sku ?? item.sku_code;

        if (item.barcode && !product_sku) {
          const product = productByBarcode.get(item.barcode) as { product_sku: string } | undefined;
          if (!product) {
            throw new TransactionError(404, `Product not found for barcode: ${item.barcode}`);
          }
          product_sku = product.product_sku;
        }

        const product = productBySku.get(product_sku!) as
          | { product_sku: string; units_per_box: number; boxes_per_pallet: number }
          | undefined;
        if (!product) {
          throw new TransactionError(404, `Product not found: ${product_sku}`);
        }

        const { units_per_box, boxes_per_pallet } = product;
        const unit_type = item.unit_type ?? 'EACH';
        let quantity_each = item.quantity;
        if (unit_type === 'BOX') quantity_each = item.quantity * units_per_box;
        else if (unit_type === 'PALLET') quantity_each = item.quantity * units_per_box * boxes_per_pallet;

        if (transaction_type === 'OUT') {
          const currentStock = inventoryMap.get(product_sku!) ?? 0;
          if (currentStock < quantity_each) {
            throw new TransactionError(
              400,
              `Insufficient stock for ${product_sku}. Available: ${currentStock}, Requested: ${quantity_each}`,
            );
          }
        }

        const itemResult = await client.query(
          `INSERT INTO transaction_items
           (transaction_id, product_sku, quantity, unit_type, quantity_each, to_location_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING *`,
          [transaction.transaction_id, product_sku, item.quantity, unit_type, quantity_each, location_id],
        );
        processedItems.push(itemResult.rows[0]);

        const inventoryDelta = transaction_type === 'IN' ? quantity_each : -quantity_each;
        const existingInventory = await client.query(
          `SELECT inventory_id, quantity_each FROM inventory
           WHERE product_sku = $1 AND warehouse_id = $2 AND location_id = $3
           FOR UPDATE`,
          [product_sku, warehouse_id, location_id],
        );

        // A4: FOR UPDATE sonrası OUT için stok tekrar kontrol — concurrent race condition önler
        if (transaction_type === 'OUT') {
          const lockedStock = existingInventory.rows[0]?.quantity_each ?? 0;
          if (lockedStock < quantity_each) {
            throw new TransactionError(
              400,
              `Insufficient stock for ${product_sku}. Available: ${lockedStock}, Requested: ${quantity_each}`,
            );
          }
        }

        if (existingInventory.rows.length > 0) {
          await client.query(
            `UPDATE inventory SET quantity_each = quantity_each + $1, last_updated = NOW()
             WHERE inventory_id = $2`,
            [inventoryDelta, existingInventory.rows[0].inventory_id],
          );
        } else if (transaction_type === 'IN') {
          await client.query(
            `INSERT INTO inventory (product_sku, warehouse_id, location_id, quantity_each)
             VALUES ($1, $2, $3, $4)`,
            [product_sku, warehouse_id, location_id, quantity_each],
          );
        }
      }

      await client.query('COMMIT');
      return { transaction, items: processedItems };
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof TransactionError) throw error;
      logger.error('[TransactionService] createTransaction error:', error);
      throw new TransactionError(500, 'Internal server error during transaction');
    } finally {
      client.release();
    }
  }

  async getRecentTransactions(filters: TransactionFilters) {
    const { warehouse_code } = filters;
    const limit = Math.min(Math.max(1, parseInt(String(filters.limit ?? '20')) || 20), 500);

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

    const params: (string | number | boolean | null)[] = [];
    if (warehouse_code) {
      query += ' WHERE w.code = $1';
      params.push(warehouse_code as string);
    }
    query += `
      GROUP BY t.transaction_id, w.code, l.qr_code
      ORDER BY t.created_at DESC
      LIMIT $${params.length + 1}
    `;
    params.push(limit);

    const result = await pool.query(query, params);
    return result.rows;
  }

  async getTransactionDetails(transaction_id: string) {
    const transactionResult = await pool.query(
      `SELECT t.*, w.code as warehouse_code, l.qr_code as location_code
       FROM transactions t
       JOIN warehouses w ON t.warehouse_id = w.warehouse_id
       LEFT JOIN locations l ON t.location_id = l.location_id
       WHERE t.transaction_id = $1`,
      [transaction_id],
    );

    if (transactionResult.rows.length === 0) {
      throw new TransactionError(404, 'Transaction not found');
    }

    const transaction = transactionResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT ti.*, p.product_name, p.barcode
       FROM transaction_items ti
       JOIN products p ON ti.product_sku = p.product_sku
       WHERE ti.transaction_id = $1`,
      [transaction_id],
    );

    return { ...transaction, items: itemsResult.rows };
  }

  async undoTransaction(transaction_id: string, user: string) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const transactionResult = await client.query(
        'SELECT * FROM transactions WHERE transaction_id = $1',
        [transaction_id],
      );
      if (transactionResult.rows.length === 0) {
        throw new TransactionError(404, 'Transaction not found');
      }
      const transaction = transactionResult.rows[0];

      const itemsResult = await client.query(
        'SELECT * FROM transaction_items WHERE transaction_id = $1',
        [transaction_id],
      );

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
        ],
      );
      const reverseTransaction = reverseTransactionResult.rows[0];

      if (itemsResult.rows.length > 0) {
        const valuesClauses: string[] = [];
        const insertParams: (string | number | boolean | null)[] = [];
        itemsResult.rows.forEach((item: Record<string, unknown>, idx: number) => {
          const offset = idx * 6;
          valuesClauses.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`,
          );
          insertParams.push(
            reverseTransaction.transaction_id,
            item.product_sku as string,
            item.quantity as number,
            item.unit_type as string,
            item.quantity_each as number,
            (item.to_location_id as number) || null,
          );
        });
        await client.query(
          `INSERT INTO transaction_items
           (transaction_id, product_sku, quantity, unit_type, quantity_each, to_location_id)
           VALUES ${valuesClauses.join(', ')}`,
          insertParams,
        );
      }

      await client.query('COMMIT');
      return reverseTransaction;
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof TransactionError) throw error;
      logger.error('[TransactionService] undoTransaction error:', error);
      throw new TransactionError(500, 'Internal server error during undo');
    } finally {
      client.release();
    }
  }
}

export const transactionService = new TransactionService();
