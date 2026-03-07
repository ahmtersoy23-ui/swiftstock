// ============================================
// OPERATION SERVICE — Module 8
// Operasyon motoru iş mantığı. Controller sadece req/res yönetir.
// Tablolar: operation_modes, wms_scan_sessions, wms_scan_operations
// Coupling: 3/10 — düşük
// ============================================

import pool from '../../../config/database';

// ── Domain Error ──────────────────────────────────────────────────────────────

export class OperationError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'OperationError';
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CreateScanSessionInput {
  warehouse_code: string;
  user_name: string;
  mode_type: string;
  notes?: string;
}

export interface AddScanOperationInput {
  session_id: number;
  operation_type: string;
  product_sku?: string;
  location_id?: number;
  from_location_id?: number;
  to_location_id?: number;
  quantity?: number;
  unit_type?: string;
  notes?: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

class OperationService {
  // ── Operation Modes ──────────────────────────────────────────────────────

  async getAllOperationModes() {
    const result = await pool.query(
      'SELECT * FROM operation_modes WHERE is_active = true ORDER BY mode_type, mode_code',
    );
    return result.rows;
  }

  async getOperationModeByCode(mode_code: string) {
    const result = await pool.query(
      'SELECT * FROM operation_modes WHERE mode_code = $1',
      [mode_code],
    );

    if (result.rows.length === 0) {
      throw new OperationError(404, 'Operation mode not found');
    }

    return result.rows[0];
  }

  // ── Scan Sessions ─────────────────────────────────────────────────────────

  private async generateSessionCode(): Promise<string> {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    const result = await pool.query(
      `SELECT COUNT(*) as count FROM wms_scan_sessions WHERE session_code LIKE $1`,
      [`SESSION-${yearMonth}-%`],
    );

    const count = parseInt(result.rows[0].count) + 1;
    const sessionNumber = String(count).padStart(5, '0');

    return `SESSION-${yearMonth}-${sessionNumber}`;
  }

  async createScanSession(data: CreateScanSessionInput) {
    const { warehouse_code, user_name, mode_type, notes } = data;

    const validModes = ['RECEIVING', 'PICKING', 'TRANSFER', 'COUNT'];
    if (!validModes.includes(mode_type)) {
      throw new OperationError(400, `mode_type must be one of: ${validModes.join(', ')}`);
    }

    const warehouseResult = await pool.query(
      'SELECT warehouse_id FROM wms_warehouses WHERE code = $1',
      [warehouse_code],
    );

    if (warehouseResult.rows.length === 0) {
      throw new OperationError(404, 'Warehouse not found');
    }

    const warehouse_id = warehouseResult.rows[0].warehouse_id;

    // session_code generated before transaction (COUNT query — minor staleness is acceptable)
    const session_code = await this.generateSessionCode();

    // BEGIN wraps active session check + INSERT atomically — reduces race condition window
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const activeSessionCheck = await client.query(
        `SELECT session_id, session_code FROM wms_scan_sessions
         WHERE user_name = $1 AND status = 'ACTIVE'`,
        [user_name],
      );

      if (activeSessionCheck.rows.length > 0) {
        throw new OperationError(
          400,
          `User already has an active session: ${activeSessionCheck.rows[0].session_code}`,
        );
      }

      const result = await client.query(
        `INSERT INTO wms_scan_sessions (session_code, warehouse_id, user_name, mode_type, notes)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [session_code, warehouse_id, user_name, mode_type, notes],
      );

      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getScanSession(session_id: string) {
    const result = await pool.query(
      `SELECT s.*, w.code as warehouse_code, w.name as warehouse_name
       FROM wms_scan_sessions s
       JOIN wms_warehouses w ON s.warehouse_id = w.warehouse_id
       WHERE s.session_id = $1`,
      [session_id],
    );

    if (result.rows.length === 0) {
      throw new OperationError(404, 'Session not found');
    }

    return result.rows[0];
  }

  async getActiveScanSession(user_name: string) {
    const result = await pool.query(
      `SELECT s.*, w.code as warehouse_code, w.name as warehouse_name
       FROM wms_scan_sessions s
       JOIN wms_warehouses w ON s.warehouse_id = w.warehouse_id
       WHERE s.user_name = $1 AND s.status = 'ACTIVE'
       ORDER BY s.started_at DESC
       LIMIT 1`,
      [user_name],
    );

    if (result.rows.length === 0) {
      throw new OperationError(404, 'No active session found for user');
    }

    return result.rows[0];
  }

  async completeScanSession(session_id: string, notes?: string) {
    const result = await pool.query(
      `UPDATE wms_scan_sessions
       SET status = 'COMPLETED', completed_at = NOW(), notes = COALESCE($2, notes)
       WHERE session_id = $1 AND status = 'ACTIVE'
       RETURNING *`,
      [session_id, notes],
    );

    if (result.rows.length === 0) {
      throw new OperationError(404, 'Active session not found');
    }

    return result.rows[0];
  }

  async cancelScanSession(session_id: string, notes?: string) {
    const result = await pool.query(
      `UPDATE wms_scan_sessions
       SET status = 'CANCELLED', completed_at = NOW(), notes = COALESCE($2, notes)
       WHERE session_id = $1 AND status = 'ACTIVE'
       RETURNING *`,
      [session_id, notes],
    );

    if (result.rows.length === 0) {
      throw new OperationError(404, 'Active session not found');
    }

    return result.rows[0];
  }

  // ── Scan Operations ───────────────────────────────────────────────────────

  async addScanOperation(data: AddScanOperationInput) {
    const {
      session_id,
      operation_type,
      product_sku,
      location_id,
      from_location_id,
      to_location_id,
      quantity,
      unit_type,
      notes,
    } = data;

    const sessionCheck = await pool.query(
      'SELECT status FROM wms_scan_sessions WHERE session_id = $1',
      [session_id],
    );

    if (sessionCheck.rows.length === 0) {
      throw new OperationError(404, 'Session not found');
    }

    if (sessionCheck.rows[0].status !== 'ACTIVE') {
      throw new OperationError(400, 'Session is not active');
    }

    const result = await pool.query(
      `INSERT INTO wms_scan_operations (
        session_id, operation_type, product_sku, location_id,
        from_location_id, to_location_id, quantity, unit_type, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        session_id,
        operation_type,
        product_sku,
        location_id,
        from_location_id,
        to_location_id,
        quantity,
        unit_type,
        notes,
      ],
    );

    return result.rows[0];
  }

  async getSessionOperations(session_id: string) {
    const result = await pool.query(
      `SELECT
        so.*,
        p.name AS product_name,

        l.location_code,
        fl.location_code as from_location_code,
        tl.location_code as to_location_code
       FROM wms_scan_operations so
       LEFT JOIN products p ON so.product_sku = p.product_sku
       LEFT JOIN wms_locations l ON so.location_id = l.location_id
       LEFT JOIN wms_locations fl ON so.from_location_id = fl.location_id
       LEFT JOIN wms_locations tl ON so.to_location_id = tl.location_id
       WHERE so.session_id = $1
       ORDER BY so.scanned_at DESC`,
      [session_id],
    );

    return result.rows;
  }
}

export const operationService = new OperationService();
export default operationService;
