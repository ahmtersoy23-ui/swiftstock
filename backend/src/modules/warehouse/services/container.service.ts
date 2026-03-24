// ============================================
// CONTAINER SERVICE — Module 2 (Warehouse Placement)
// Koli/Palet yönetimi iş mantığı.
// Tablolar: wms_containers, wms_container_contents
// Coupling: 4/10 — openContainer decoupled via eventBus
// ============================================

import pool from '../../../config/database';
import { eventBus } from '../../shared/events/event-bus';

// ── Domain Error ──────────────────────────────────────────────────────────────

export class ContainerError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ContainerError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GetContainersFilters {
  warehouse_code?: string;
  status?: string;
  type?: string;
  search?: string;
  shipment_id?: string | number;
  page?: string | number;
  limit?: string | number;
}

export interface ContainerItem {
  product_sku: string;
  quantity: number;
}

export interface CreateContainerInput {
  container_type: string;
  warehouse_code: string;
  items: ContainerItem[];
  created_by: string;
  display_name?: string;       // kullanıcı tanımlı isim (zorunlu — UI enforces)
  shipment_id?: number;        // opsiyonel sevkiyat bağlantısı
  notes?: string;
  parent_container_id?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

class ContainerService {
  async createContainer(data: CreateContainerInput) {
    const { container_type, warehouse_code, items, created_by, display_name, shipment_id, notes, parent_container_id } = data;

    const warehouseResult = await pool.query(
      'SELECT warehouse_id FROM wms_warehouses WHERE code = $1',
      [warehouse_code],
    );

    if (warehouseResult.rows.length === 0) {
      throw new ContainerError(404, 'Warehouse not found');
    }

    const warehouse_id = warehouseResult.rows[0].warehouse_id;

    // Uniqueness check for display_name within the same warehouse
    if (display_name) {
      const nameCheck = await pool.query(
        `SELECT container_id FROM wms_containers WHERE display_name = $1 AND warehouse_id = $2`,
        [display_name, warehouse_id],
      );
      if (nameCheck.rows.length > 0) {
        throw new ContainerError(409, `Bu isimde bir koli/palet zaten var: ${display_name}`);
      }
    }

    // Validate shipment exists if provided
    if (shipment_id) {
      const shipmentCheck = await pool.query(
        'SELECT shipment_id FROM virtual_shipments WHERE shipment_id = $1',
        [shipment_id],
      );
      if (shipmentCheck.rows.length === 0) {
        throw new ContainerError(404, 'Sevkiyat bulunamadi');
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert first with a temp barcode, then derive the final barcode from the
      // auto-increment container_id — eliminates the COUNT-based race condition.
      const tempBarcode = `TEMP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const containerResult = await client.query(
        `INSERT INTO wms_containers
         (barcode, container_type, warehouse_id, parent_container_id, status, created_by, display_name, shipment_id, notes)
         VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6, $7, $8)
         RETURNING *`,
        [tempBarcode, container_type, warehouse_id, parent_container_id ?? null, created_by, display_name ?? null, shipment_id ?? null, notes ?? null],
      );

      const { container_id } = containerResult.rows[0];
      const prefix = container_type === 'BOX' ? 'KOL' : 'PAL';
      const barcode = `${prefix}-${String(container_id).padStart(5, '0')}`;
      await client.query(
        `UPDATE wms_containers SET barcode = $1 WHERE container_id = $2`,
        [barcode, container_id],
      );

      const container = { ...containerResult.rows[0], barcode };

      if (items.length > 0) {
        const valuesClauses: string[] = [];
        const insertParams: (string | number | boolean | null)[] = [];
        items.forEach((item, idx) => {
          const offset = idx * 3;
          valuesClauses.push(`($${offset + 1}, $${offset + 2}, $${offset + 3})`);
          insertParams.push(container.container_id, item.product_sku, item.quantity);
        });
        await client.query(
          `INSERT INTO wms_container_contents (container_id, product_sku, quantity)
           VALUES ${valuesClauses.join(', ')}`,
          insertParams,
        );
      }

      await client.query('COMMIT');

      return { container, barcode: container.barcode, items_count: items.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getContainerByBarcode(barcode: string) {
    const containerResult = await pool.query(
      'SELECT * FROM wms_containers WHERE barcode = $1',
      [barcode],
    );

    if (containerResult.rows.length === 0) {
      throw new ContainerError(404, 'Container not found');
    }

    const container = containerResult.rows[0];

    const contentsResult = await pool.query(
      `SELECT cc.*, p.name AS product_name
       FROM wms_container_contents cc
       JOIN products p ON cc.product_sku = p.product_sku
       WHERE cc.container_id = $1`,
      [container.container_id],
    );

    return { container, contents: contentsResult.rows };
  }

  async getAllContainers(filters: GetContainersFilters) {
    const { warehouse_code, status, type, search, shipment_id, page = 1, limit = 50 } = filters;

    const pageNum = Math.max(1, parseInt(page as string) || 1);
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string) || 50));
    const offset = (pageNum - 1) * limitNum;

    let whereClause = ' WHERE 1=1';
    const params: (string | number | boolean | null)[] = [];
    let paramCount = 1;

    if (warehouse_code) {
      whereClause += ` AND w.code = $${paramCount++}`;
      params.push(warehouse_code as string);
    }
    if (status) {
      whereClause += ` AND c.status = $${paramCount++}`;
      params.push(status as string);
    }
    if (type) {
      whereClause += ` AND c.container_type = $${paramCount++}`;
      params.push(type as string);
    }
    if (shipment_id) {
      whereClause += ` AND c.shipment_id = $${paramCount++}`;
      params.push(Number(shipment_id));
    }
    if (search) {
      whereClause += ` AND (c.barcode ILIKE $${paramCount} OR c.display_name ILIKE $${paramCount} OR c.notes ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) FROM wms_containers c
       JOIN wms_warehouses w ON c.warehouse_id = w.warehouse_id
       ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await pool.query(
      `SELECT
        c.*,
        w.code as warehouse_code,
        w.name as warehouse_name,
        l.location_code,
        l.qr_code as location_qr,
        vs.name AS shipment_name,
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
       LEFT JOIN virtual_shipments vs ON vs.shipment_id = c.shipment_id
       LEFT JOIN (
         SELECT container_id, COUNT(*) as current_items, COUNT(*) as original_items
         FROM wms_container_contents
         GROUP BY container_id
       ) cc ON c.container_id = cc.container_id
       ${whereClause}
       ORDER BY c.created_at DESC
       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, limitNum, offset],
    );

    return { rows: result.rows, page: pageNum, limit: limitNum, total };
  }

  async linkContainerToShipment(container_id: number, shipment_id: number | null) {
    if (shipment_id !== null) {
      const check = await pool.query(
        'SELECT shipment_id FROM virtual_shipments WHERE shipment_id = $1',
        [shipment_id],
      );
      if (check.rows.length === 0) {
        throw new ContainerError(404, 'Sevkiyat bulunamadi');
      }
    }
    const result = await pool.query(
      `UPDATE wms_containers SET shipment_id = $1 WHERE container_id = $2 RETURNING *`,
      [shipment_id, container_id],
    );
    if (result.rows.length === 0) {
      throw new ContainerError(404, 'Container bulunamadi');
    }
    return result.rows[0];
  }

  /**
   * Open/unpack a container.
   * Container OPENED olarak işaretlenir, sonra eventBus üzerinden
   * 'container:opened' event'i emit edilir.
   * Modül 4 (Inventory Core) bu event'i dinleyerek transaction + inventory update yapar.
   */
  async openContainer(
    barcode: string,
    location_qr: string | undefined,
    openedByUserId: number,
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const containerResult = await client.query(
        "SELECT * FROM wms_containers WHERE barcode = $1 AND status = 'ACTIVE'",
        [barcode],
      );

      if (containerResult.rows.length === 0) {
        throw new ContainerError(404, 'Active container not found');
      }

      const container = containerResult.rows[0];

      const contentsResult = await client.query(
        'SELECT * FROM wms_container_contents WHERE container_id = $1',
        [container.container_id],
      );

      // Resolve location_id from QR code (if provided)
      let locationId: number | null = null;
      if (location_qr) {
        const locResult = await client.query(
          'SELECT location_id FROM wms_locations WHERE qr_code = $1 LIMIT 1',
          [location_qr],
        );
        locationId = locResult.rows[0]?.location_id ?? null;
      }

      // Mark container as OPENED
      await client.query(
        `UPDATE wms_containers SET status = 'OPENED', opened_at = NOW() WHERE container_id = $1`,
        [container.container_id],
      );

      await client.query('COMMIT');

      // Emit AFTER commit — Modül 4 (Inventory Core) creates the IN transaction
      const contents = contentsResult.rows.map(
        (row: { product_sku: string; quantity: number }) => ({
          productSku: row.product_sku,
          quantity: row.quantity,
        }),
      );

      eventBus.emit('container:opened', {
        containerId: container.container_id as number,
        containerBarcode: barcode,
        warehouseId: container.warehouse_id as number,
        locationId,
        contents,
        openedByUserId,
      });

      return { items_returned: contents.length };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
  /**
   * Break (dağıt) a container by extracting a single product.
   * - Removes the specified product from container contents
   * - If remaining items exist, each is registered individually at the container's location
   * - Container is marked as OPENED
   * - Emits 'container:opened' so inventory module picks up remaining items
   *
   * Returns: { broken: true, container_barcode, extracted_sku, remaining_items }
   */
  async breakContainer(
    containerId: number,
    extractedProductSku: string,
    openedByUserId: number,
  ) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Get container
      const containerResult = await client.query(
        "SELECT * FROM wms_containers WHERE container_id = $1 AND status = 'ACTIVE'",
        [containerId],
      );

      if (containerResult.rows.length === 0) {
        throw new ContainerError(404, 'Active container not found');
      }

      const container = containerResult.rows[0];

      // Get contents
      const contentsResult = await client.query(
        'SELECT * FROM wms_container_contents WHERE container_id = $1',
        [containerId],
      );

      const contents = contentsResult.rows;
      const extractedItem = contents.find(
        (c: { product_sku: string }) => c.product_sku === extractedProductSku,
      );

      if (!extractedItem) {
        throw new ContainerError(404, `Ürün (${extractedProductSku}) bu container içinde bulunamadı`);
      }

      // Remove extracted product from container contents
      await client.query(
        'DELETE FROM wms_container_contents WHERE container_id = $1 AND product_sku = $2',
        [containerId, extractedProductSku],
      );

      // Mark container as OPENED
      await client.query(
        "UPDATE wms_containers SET status = 'OPENED', opened_at = NOW() WHERE container_id = $1",
        [containerId],
      );

      await client.query('COMMIT');

      // Remaining items (excluding extracted) — emit so inventory module registers them
      const remainingContents = contents
        .filter((c: { product_sku: string }) => c.product_sku !== extractedProductSku)
        .map((row: { product_sku: string; quantity: number }) => ({
          productSku: row.product_sku,
          quantity: row.quantity,
        }));

      // Resolve location_id from container
      const locationId: number | null = container.location_id ?? null;

      if (remainingContents.length > 0) {
        eventBus.emit('container:opened', {
          containerId: container.container_id as number,
          containerBarcode: container.barcode as string,
          warehouseId: container.warehouse_id as number,
          locationId,
          contents: remainingContents,
          openedByUserId,
        });
      }

      return {
        broken: true,
        container_barcode: container.barcode,
        extracted_sku: extractedProductSku,
        remaining_items: remainingContents.length,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a product_sku is inside any ACTIVE container in a given warehouse.
   * Returns the container info if found, null otherwise.
   */
  async findContainerByProduct(productSku: string, warehouseId: number) {
    const result = await pool.query(
      `SELECT c.container_id, c.barcode, c.display_name, c.container_type, c.status
       FROM wms_container_contents cc
       JOIN wms_containers c ON cc.container_id = c.container_id
       WHERE cc.product_sku = $1 AND c.warehouse_id = $2 AND c.status = 'ACTIVE'
       LIMIT 1`,
      [productSku, warehouseId],
    );

    return result.rows.length > 0 ? result.rows[0] : null;
  }
}

export const containerService = new ContainerService();
export default containerService;
