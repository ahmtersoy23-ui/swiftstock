// ============================================
// USER MANAGEMENT CONTROLLER
// ============================================

import { Response } from 'express';
import bcrypt from 'bcrypt';
import pool from '../config/database';
import { HTTP_STATUS, ERROR_MESSAGES, SUCCESS_MESSAGES, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../constants';
import { AuthRequest } from '../middleware/auth.middleware';

const SALT_ROUNDS = 10;

/**
 * Get all users with pagination and filters
 */
export const getAllUsers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = DEFAULT_PAGE_SIZE,
      role,
      warehouse_code,
      is_active,
      search,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(MAX_PAGE_SIZE, parseInt(limit as string));
    const offset = (pageNum - 1) * limitNum;

    // Build query
    let whereConditions: string[] = [];
    let queryParams: any[] = [];
    let paramIndex = 1;

    if (role) {
      whereConditions.push(`u.role = $${paramIndex++}`);
      queryParams.push(role);
    }

    if (warehouse_code) {
      whereConditions.push(`u.warehouse_code = $${paramIndex++}`);
      queryParams.push(warehouse_code);
    }

    if (is_active !== undefined) {
      whereConditions.push(`u.is_active = $${paramIndex++}`);
      queryParams.push(is_active === 'true');
    }

    if (search) {
      whereConditions.push(`(u.username ILIKE $${paramIndex} OR u.full_name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM users u ${whereClause}`,
      queryParams
    );

    const total = parseInt(countResult.rows[0].total);

    // Get users
    const usersResult = await pool.query(
      `SELECT
         u.user_id,
         u.username,
         u.email,
         u.full_name,
         u.role,
         u.warehouse_code,
         w.name as warehouse_name,
         u.is_active,
         u.created_at,
         u.last_login,
         u.created_by
       FROM users u
       LEFT JOIN warehouses w ON u.warehouse_code = w.code
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...queryParams, limitNum, offset]
    );

    res.json({
      success: true,
      data: usersResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Get user by ID
 */
export const getUserById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user_id } = req.params;

    const userResult = await pool.query(
      `SELECT
         u.user_id,
         u.username,
         u.email,
         u.full_name,
         u.role,
         u.warehouse_code,
         w.name as warehouse_name,
         u.is_active,
         u.created_at,
         u.updated_at,
         u.last_login,
         u.created_by,
         COALESCE(
           json_agg(
             json_build_object('permission_type', up.permission_type, 'resource', up.resource)
           ) FILTER (WHERE up.permission_id IS NOT NULL),
           '[]'
         ) as permissions
       FROM users u
       LEFT JOIN warehouses w ON u.warehouse_code = w.code
       LEFT JOIN user_permissions up ON u.user_id = up.user_id
       WHERE u.user_id = $1
       GROUP BY u.user_id, w.name`,
      [user_id]
    );

    if (userResult.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Kullanıcı bulunamadı.',
      });
      return;
    }

    res.json({
      success: true,
      data: userResult.rows[0],
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Create new user
 */
export const createUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      username,
      email,
      password,
      full_name,
      role,
      warehouse_code,
      is_active = true,
      permissions = [],
    } = req.body;

    // Validate required fields
    if (!username || !password || !role) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Kullanıcı adı, şifre ve rol gereklidir.',
      });
      return;
    }

    // Validate password length
    if (password.length < 6) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Şifre en az 6 karakter olmalıdır.',
      });
      return;
    }

    // Check if username already exists
    const existingUser = await client.query(
      `SELECT user_id FROM users WHERE username = $1`,
      [username]
    );

    if (existingUser.rows.length > 0) {
      res.status(HTTP_STATUS.CONFLICT).json({
        success: false,
        error: 'Bu kullanıcı adı zaten kullanılıyor.',
      });
      return;
    }

    // Check if email already exists
    if (email) {
      const existingEmail = await client.query(
        `SELECT user_id FROM users WHERE email = $1`,
        [email]
      );

      if (existingEmail.rows.length > 0) {
        res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          error: 'Bu email adresi zaten kullanılıyor.',
        });
        return;
      }
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user with must_change_password = true
    const newUserResult = await client.query(
      `INSERT INTO users (username, email, password_hash, full_name, role, warehouse_code, is_active, created_by, must_change_password)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING user_id, username, email, full_name, role, warehouse_code, is_active, created_at`,
      [username, email, password_hash, full_name, role, warehouse_code, is_active, req.user?.username || 'SYSTEM']
    );

    const newUser = newUserResult.rows[0];

    // Add permissions if provided
    if (permissions && permissions.length > 0) {
      for (const perm of permissions) {
        await client.query(
          `INSERT INTO user_permissions (user_id, permission_type, resource)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, permission_type, resource) DO NOTHING`,
          [newUser.user_id, perm.permission_type, perm.resource]
        );
      }
    }

    // Log audit event
    await client.query(
      `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'CREATE_USER', 'users', $3, $4)`,
      [req.user?.user_id, req.user?.username, newUser.user_id.toString(), JSON.stringify({ created_user: username })]
    );

    await client.query('COMMIT');

    res.status(HTTP_STATUS.CREATED).json({
      success: true,
      data: newUser,
      message: 'Kullanıcı başarıyla oluşturuldu.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create user error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Update user
 */
export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { user_id } = req.params;
    const {
      email,
      full_name,
      role,
      warehouse_code,
      is_active,
      permissions,
    } = req.body;

    // Check if user exists
    const userCheck = await client.query(
      `SELECT user_id FROM users WHERE user_id = $1`,
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Kullanıcı bulunamadı.',
      });
      return;
    }

    // Check if email is already used by another user
    if (email) {
      const existingEmail = await client.query(
        `SELECT user_id FROM users WHERE email = $1 AND user_id != $2`,
        [email, user_id]
      );

      if (existingEmail.rows.length > 0) {
        res.status(HTTP_STATUS.CONFLICT).json({
          success: false,
          error: 'Bu email adresi başka bir kullanıcı tarafından kullanılıyor.',
        });
        return;
      }
    }

    // Build update query
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
    }

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(full_name);
    }

    if (role !== undefined) {
      updates.push(`role = $${paramIndex++}`);
      values.push(role);
    }

    if (warehouse_code !== undefined) {
      updates.push(`warehouse_code = $${paramIndex++}`);
      values.push(warehouse_code);
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(is_active);
    }

    if (updates.length > 0) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(user_id);

      await client.query(
        `UPDATE users SET ${updates.join(', ')} WHERE user_id = $${paramIndex}`,
        values
      );
    }

    // Update permissions if provided
    if (permissions !== undefined) {
      // Delete existing permissions
      await client.query(
        `DELETE FROM user_permissions WHERE user_id = $1`,
        [user_id]
      );

      // Add new permissions
      if (permissions.length > 0) {
        for (const perm of permissions) {
          await client.query(
            `INSERT INTO user_permissions (user_id, permission_type, resource)
             VALUES ($1, $2, $3)`,
            [user_id, perm.permission_type, perm.resource]
          );
        }
      }
    }

    // Get updated user
    const updatedUserResult = await client.query(
      `SELECT
         u.user_id,
         u.username,
         u.email,
         u.full_name,
         u.role,
         u.warehouse_code,
         w.name as warehouse_name,
         u.is_active,
         u.created_at,
         u.updated_at,
         u.last_login
       FROM users u
       LEFT JOIN warehouses w ON u.warehouse_code = w.code
       WHERE u.user_id = $1`,
      [user_id]
    );

    // Log audit event
    await client.query(
      `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'UPDATE_USER', 'users', $3, $4)`,
      [req.user?.user_id, req.user?.username, user_id, JSON.stringify(req.body)]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: updatedUserResult.rows[0],
      message: 'Kullanıcı başarıyla güncellendi.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update user error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Delete user (soft delete - set is_active to false)
 */
export const deleteUser = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { user_id } = req.params;

    // Check if user exists
    const userCheck = await client.query(
      `SELECT user_id, username FROM users WHERE user_id = $1`,
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Kullanıcı bulunamadı.',
      });
      return;
    }

    const deletedUsername = userCheck.rows[0].username;

    // Prevent deleting yourself
    if (req.user && req.user.user_id === parseInt(user_id)) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Kendi hesabınızı silemezsiniz.',
      });
      return;
    }

    // Soft delete (set is_active to false)
    await client.query(
      `UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
      [user_id]
    );

    // Revoke all refresh tokens
    await client.query(
      `UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`,
      [user_id]
    );

    // Close all active device sessions
    await client.query(
      `UPDATE device_sessions SET is_active = false, ended_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
      [user_id]
    );

    // Log audit event
    await client.query(
      `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'DELETE_USER', 'users', $3, $4)`,
      [req.user?.user_id, req.user?.username, user_id, JSON.stringify({ deleted_user: deletedUsername })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Kullanıcı başarıyla silindi.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete user error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Reset user password (Admin only)
 */
export const resetUserPassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { user_id } = req.params;
    const { new_password } = req.body;

    if (!new_password) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Yeni şifre gereklidir.',
      });
      return;
    }

    if (new_password.length < 6) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Yeni şifre en az 6 karakter olmalıdır.',
      });
      return;
    }

    // Check if user exists
    const userCheck = await client.query(
      `SELECT user_id, username FROM users WHERE user_id = $1`,
      [user_id]
    );

    if (userCheck.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Kullanıcı bulunamadı.',
      });
      return;
    }

    // Hash new password
    const password_hash = await bcrypt.hash(new_password, SALT_ROUNDS);

    // Update password and set must_change_password = true
    await client.query(
      `UPDATE users SET password_hash = $1, must_change_password = true, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
      [password_hash, user_id]
    );

    // Revoke all refresh tokens (force re-login)
    await client.query(
      `UPDATE refresh_tokens SET is_revoked = true WHERE user_id = $1`,
      [user_id]
    );

    // Log audit event
    await client.query(
      `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details)
       VALUES ($1, $2, 'RESET_PASSWORD', 'users', $3, $4)`,
      [req.user?.user_id, req.user?.username, user_id, JSON.stringify({ reset_for: userCheck.rows[0].username })]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Kullanıcı şifresi başarıyla sıfırlandı.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Reset password error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Get user's audit logs
 */
export const getUserAuditLogs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { user_id } = req.params;
    const { limit = 50 } = req.query;

    const logsResult = await pool.query(
      `SELECT
         log_id,
         action,
         resource_type,
         resource_id,
         details,
         ip_address,
         created_at
       FROM audit_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [user_id, limit]
    );

    res.json({
      success: true,
      data: logsResult.rows,
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};
