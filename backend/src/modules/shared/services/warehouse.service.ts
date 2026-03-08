// ============================================
// WAREHOUSE SERVICE (Shared / READ-ONLY + In-Memory Cache)
// Only 2–3 active warehouses → cache them in memory on first access.
// All modules use this service instead of querying wms_warehouses directly.
// ============================================

import pool from '../../../config/database';
import logger from '../../../utils/logger';
import { Warehouse } from '../types';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: Warehouse[];
  expiresAt: number;
}

class WarehouseService {
  private cache: CacheEntry | null = null;

  // ── Cache Helpers ──────────────────────────────────────────────────────────

  private isCacheValid(): boolean {
    return this.cache !== null && Date.now() < this.cache.expiresAt;
  }

  private setCache(warehouses: Warehouse[]): void {
    this.cache = { data: warehouses, expiresAt: Date.now() + CACHE_TTL_MS };
  }

  /** Invalidate cache (call after warehouse config changes) */
  invalidateCache(): void {
    this.cache = null;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Get all active warehouses (cached)
   */
  async getAllWarehouses(): Promise<Warehouse[]> {
    if (this.isCacheValid()) {
      return this.cache!.data;
    }

    try {
      const result = await pool.query(
        'SELECT * FROM wms_warehouses WHERE is_active = true ORDER BY code'
      );
      this.setCache(result.rows);
      return result.rows;
    } catch (error) {
      logger.error('[WarehouseService] getAllWarehouses error:', error);
      throw error;
    }
  }

  /**
   * Get all warehouses including inactive (no cache — used for admin UI)
   */
  async getAllWarehousesIncludingInactive(): Promise<Warehouse[]> {
    try {
      const result = await pool.query(
        'SELECT * FROM wms_warehouses ORDER BY is_active DESC, code'
      );
      return result.rows;
    } catch (error) {
      logger.error('[WarehouseService] getAllWarehousesIncludingInactive error:', error);
      throw error;
    }
  }

  /**
   * Get warehouse by code (e.g. 'USA', 'TUR')
   */
  async getByCode(code: string): Promise<Warehouse | null> {
    const warehouses = await this.getAllWarehouses();
    return warehouses.find((w) => w.code === code) ?? null;
  }

  /**
   * Get warehouse by ID
   */
  async getById(warehouseId: number): Promise<Warehouse | null> {
    const warehouses = await this.getAllWarehouses();
    const cached = warehouses.find((w) => w.warehouse_id === warehouseId);
    if (cached) return cached;

    // Cache miss — might be inactive, query directly
    try {
      const result = await pool.query(
        'SELECT * FROM wms_warehouses WHERE warehouse_id = $1',
        [warehouseId]
      );
      return result.rows[0] ?? null;
    } catch (error) {
      logger.error('[WarehouseService] getById error:', error);
      throw error;
    }
  }

  /**
   * Resolve warehouse_id from code — convenience helper used by many controllers
   */
  async resolveWarehouseId(code: string): Promise<number | null> {
    const warehouse = await this.getByCode(code);
    return warehouse?.warehouse_id ?? null;
  }

  /**
   * Assert warehouse exists — throws if not found
   */
  async assertExists(warehouseId: number): Promise<Warehouse> {
    const warehouse = await this.getById(warehouseId);
    if (!warehouse) {
      throw new Error(`Warehouse ${warehouseId} not found`);
    }
    return warehouse;
  }
}

export const warehouseService = new WarehouseService();
