// ============================================
// USER SERVICE (Shared)
// Centralised user lookup used by all modules.
// Auth logic stays in auth.service.ts.
// ============================================

import pool from '../../../config/database';
import logger from '../../../utils/logger';
import { UserProfile } from '../types';

class UserService {
  /**
   * Get user by ID
   */
  async getUserById(userId: number): Promise<UserProfile | null> {
    try {
      const result = await pool.query(
        `SELECT user_id, username, email, full_name, role, warehouse_code
         FROM users
         WHERE user_id = $1`,
        [userId]
      );
      return result.rows[0] ?? null;
    } catch (error) {
      logger.error('[UserService] getUserById error:', error);
      throw error;
    }
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserProfile | null> {
    try {
      const result = await pool.query(
        `SELECT user_id, username, email, full_name, role, warehouse_code
         FROM users
         WHERE email = $1`,
        [email]
      );
      return result.rows[0] ?? null;
    } catch (error) {
      logger.error('[UserService] getUserByEmail error:', error);
      throw error;
    }
  }

  /**
   * Get all users — optionally filtered by role
   */
  async getAllUsers(role?: string): Promise<UserProfile[]> {
    try {
      let query = `SELECT user_id, username, email, full_name, role, warehouse_code, is_active, created_at
                   FROM users`;
      const params: string[] = [];

      if (role) {
        query += ' WHERE role = $1';
        params.push(role);
      }

      query += ' ORDER BY full_name';

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('[UserService] getAllUsers error:', error);
      throw error;
    }
  }

  /**
   * Get users by role (e.g. all OPERATORs in a warehouse for picker assignment)
   */
  async getUsersByRole(
    role: UserProfile['role'],
    warehouseCode?: string
  ): Promise<UserProfile[]> {
    try {
      let query = `SELECT user_id, username, email, full_name, role, warehouse_code
                   FROM users
                   WHERE role = $1 AND is_active = true`;
      const params: (string | null)[] = [role];

      if (warehouseCode) {
        query += ' AND warehouse_code = $2';
        params.push(warehouseCode);
      }

      query += ' ORDER BY full_name';

      const result = await pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('[UserService] getUsersByRole error:', error);
      throw error;
    }
  }

  /**
   * Check if a user exists
   */
  async userExists(userId: number): Promise<boolean> {
    try {
      const result = await pool.query(
        'SELECT 1 FROM users WHERE user_id = $1 LIMIT 1',
        [userId]
      );
      return result.rows.length > 0;
    } catch (error) {
      logger.error('[UserService] userExists error:', error);
      throw error;
    }
  }
}

export const userService = new UserService();
