// ============================================
// AUTHENTICATION MIDDLEWARE - SSO INTEGRATED
// ============================================

import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import axios from 'axios';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants';
import pool from '../config/database';

// JWT_SECRET is required - fail fast if not provided
export const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is required');
  process.exit(1);
}

const JWT_EXPIRES_IN: string | number = process.env.JWT_EXPIRES_IN || '24h';
const SSO_BASE_URL = process.env.SSO_BASE_URL || 'https://apps.iwa.web.tr';
const APP_CODE = 'swiftstock';

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
  ssoUser?: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
  ssoRole?: 'admin' | 'editor' | 'viewer';
}

/**
 * Verify SSO token with SSO backend
 */
const verifySSOToken = async (token: string): Promise<{
  success: boolean;
  data?: {
    user: {
      id: string;
      email: string;
      name: string;
      picture?: string;
    };
    role: 'admin' | 'editor' | 'viewer';
  };
} | null> => {
  try {
    const response = await axios.post(
      `${SSO_BASE_URL}/api/auth/verify`,
      { token, app_code: APP_CODE },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      }
    );

    return response.data;
  } catch (error) {
    console.error('SSO token verification failed:', error);
    return null;
  }
};

/**
 * Map SSO role to internal role
 */
const mapSSORole = (ssoRole: 'admin' | 'editor' | 'viewer'): 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER' => {
  switch (ssoRole) {
    case 'admin':
      return 'ADMIN';
    case 'editor':
      return 'MANAGER';
    case 'viewer':
      return 'VIEWER';
    default:
      return 'VIEWER';
  }
};

/**
 * Verify SSO token and attach user to request
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

    // Verify token with SSO backend
    const ssoResult = await verifySSOToken(token);

    if (!ssoResult || !ssoResult.success || !ssoResult.data) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Geçersiz token. Lütfen tekrar giriş yapın.',
      });
      return;
    }

    const { user: ssoUser, role: ssoRole } = ssoResult.data;

    // Attach SSO user info to request
    req.ssoUser = ssoUser;
    req.ssoRole = ssoRole;

    // Check if user exists in local database by SSO user_id first, then email
    let userResult = await pool.query(
      `SELECT user_id, username, email, full_name, role, warehouse_id, is_active, sso_user_id
       FROM users
       WHERE sso_user_id = $1 OR email = $2`,
      [ssoUser.id, ssoUser.email]
    );

    let user;

    if (userResult.rows.length === 0) {
      // Auto-create user from SSO
      const insertResult = await pool.query(
        `INSERT INTO users (username, email, full_name, role, is_active, sso_user_id, created_at)
         VALUES ($1, $2, $3, $4, true, $5, NOW())
         RETURNING user_id, username, email, full_name, role, warehouse_id, is_active, sso_user_id`,
        [ssoUser.email, ssoUser.email, ssoUser.name, mapSSORole(ssoRole), ssoUser.id]
      );
      user = insertResult.rows[0];
    } else {
      user = userResult.rows[0];

      // Update sso_user_id if not set
      if (!user.sso_user_id) {
        await pool.query(
          `UPDATE users SET sso_user_id = $1, updated_at = NOW() WHERE user_id = $2`,
          [ssoUser.id, user.user_id]
        );
        user.sso_user_id = ssoUser.id;
      }

      // Update role if it changed in SSO
      const mappedRole = mapSSORole(ssoRole);
      if (user.role !== mappedRole) {
        await pool.query(
          `UPDATE users SET role = $1, updated_at = NOW() WHERE user_id = $2`,
          [mappedRole, user.user_id]
        );
        user.role = mappedRole;
      }
    }

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
      warehouse_id: user.warehouse_id,
    };

    next();
  } catch (error: unknown) {
    console.error('Authentication error:', error);
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

    // SSO token verification (same as authenticateToken but no auto-create)
    const ssoResult = await verifySSOToken(token);

    if (ssoResult?.success && ssoResult.data) {
      const { user: ssoUser, role: ssoRole } = ssoResult.data;

      // DB lookup (simplified — no auto-create for optional auth)
      const userResult = await pool.query(
        `SELECT user_id, username, email, full_name, role, warehouse_code, is_active
         FROM users
         WHERE email = $1`,
        [ssoUser.email]
      );

      if (userResult.rows.length > 0 && userResult.rows[0].is_active) {
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
