// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants';
import pool from '../config/database';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || '24h';

export interface AuthUser {
  user_id: number;
  username: string;
  email?: string;
  full_name?: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  warehouse_code?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

/**
 * Verify JWT token and attach user to request
 */
export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Token bulunamadı. Lütfen giriş yapın.',
      });
      return;
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

    // Check if user still exists and is active
    const userResult = await pool.query(
      `SELECT user_id, username, email, full_name, role, warehouse_code, is_active
       FROM users
       WHERE user_id = $1`,
      [decoded.user_id]
    );

    if (userResult.rows.length === 0) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Kullanıcı bulunamadı.',
      });
      return;
    }

    const user = userResult.rows[0];

    if (!user.is_active) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: 'Hesabınız devre dışı bırakıldı.',
      });
      return;
    }

    // Attach user to request
    req.user = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      warehouse_code: user.warehouse_code,
    };

    next();
  } catch (error: unknown) {
    const err = error as Error & { name?: string };

    if (err.name === 'TokenExpiredError') {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Token süresi doldu. Lütfen tekrar giriş yapın.',
      });
      return;
    }

    if (err.name === 'JsonWebTokenError') {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Geçersiz token.',
      });
      return;
    }

    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Check if user has required role
 */
export const requireRole = (...allowedRoles: Array<'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER'>) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Yetkilendirme gerekli.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: 'Bu işlem için yetkiniz bulunmuyor.',
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has specific permission
 */
export const requirePermission = (permissionType: string, resource?: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: 'Yetkilendirme gerekli.',
        });
        return;
      }

      // ADMIN always has all permissions
      if (req.user.role === 'ADMIN') {
        next();
        return;
      }

      // Check specific permission
      const permissionQuery = resource
        ? `SELECT 1 FROM user_permissions
           WHERE user_id = $1 AND permission_type = $2 AND resource = $3`
        : `SELECT 1 FROM user_permissions
           WHERE user_id = $1 AND permission_type = $2`;

      const params = resource ? [req.user.user_id, permissionType, resource] : [req.user.user_id, permissionType];

      const result = await pool.query(permissionQuery, params);

      if (result.rows.length === 0) {
        res.status(HTTP_STATUS.FORBIDDEN).json({
          success: false,
          error: 'Bu işlem için yetkiniz bulunmuyor.',
        });
        return;
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: ERROR_MESSAGES.INTERNAL_ERROR,
      });
    }
  };
};

/**
 * Check if user is assigned to specific warehouse
 */
export const requireWarehouse = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(HTTP_STATUS.UNAUTHORIZED).json({
      success: false,
      error: 'Yetkilendirme gerekli.',
    });
    return;
  }

  // ADMIN can access all warehouses
  if (req.user.role === 'ADMIN') {
    next();
    return;
  }

  // Get warehouse_code from request (query, params, or body)
  const requestedWarehouse = req.query.warehouse_code || req.params.warehouse_code || req.body.warehouse_code;

  if (!requestedWarehouse) {
    next();
    return;
  }

  // Check if user's warehouse matches requested warehouse
  if (req.user.warehouse_code && req.user.warehouse_code !== requestedWarehouse) {
    res.status(HTTP_STATUS.FORBIDDEN).json({
      success: false,
      error: 'Bu depoya erişim yetkiniz bulunmuyor.',
    });
    return;
  }

  next();
};

/**
 * Optional authentication - doesn't fail if no token
 */
export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      next();
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;

    const userResult = await pool.query(
      `SELECT user_id, username, email, full_name, role, warehouse_code, is_active
       FROM users
       WHERE user_id = $1 AND is_active = true`,
      [decoded.user_id]
    );

    if (userResult.rows.length > 0) {
      const user = userResult.rows[0];
      req.user = {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
        warehouse_code: user.warehouse_code,
      };
    }

    next();
  } catch (error) {
    // Silently fail for optional auth
    next();
  }
};

/**
 * Generate JWT token
 */
export const generateToken = (user: AuthUser): string => {
  const payload = {
    user_id: user.user_id,
    username: user.username,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    warehouse_code: user.warehouse_code,
  };
  // @ts-ignore - JWT_EXPIRES_IN is valid but TypeScript is strict
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Generate refresh token (longer expiration)
 */
export const generateRefreshToken = (user: AuthUser): string => {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};
