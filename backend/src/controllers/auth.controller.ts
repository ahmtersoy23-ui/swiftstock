// ============================================
// AUTHENTICATION CONTROLLER
// ============================================

import { Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import pool from '../config/database';
import { HTTP_STATUS, ERROR_MESSAGES } from '../constants';
import {
  AuthRequest,
  AuthUser,
  generateToken,
  generateRefreshToken,
} from '../middleware/auth.middleware';
import logger from '../config/logger';
import { getJwtSecret } from '../utils/secretSync';

const SALT_ROUNDS = 12;

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// Get allowed emails from environment
const getAllowedEmails = (): string[] => {
  const emails = process.env.GOOGLE_ALLOWED_EMAILS || '';
  return emails.split(',').map(e => e.trim().toLowerCase()).filter(e => e.length > 0);
};

// Local login removed (Phase 3) — SSO-only authentication via Google OAuth

/**
 * User logout
 */
export const logout = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    const { refreshToken } = req.body;

    if (refreshToken && req.user) {
      // Get all tokens for this user and find matching one with bcrypt.compare
      const tokensResult = await client.query(
        `SELECT token_id, token_hash FROM wms_refresh_tokens WHERE user_id = $1 AND is_revoked = false`,
        [req.user.user_id]
      );

      // Find and revoke the matching token
      for (const row of tokensResult.rows) {
        const isMatch = await bcrypt.compare(refreshToken, row.token_hash);
        if (isMatch) {
          await client.query(
            `UPDATE wms_refresh_tokens SET is_revoked = true WHERE token_id = $1`,
            [row.token_id]
          );
          break;
        }
      }

      // Log audit event
      await client.query(
        `INSERT INTO wms_audit_logs (user_id, username, action, ip_address)
         VALUES ($1, $2, 'LOGOUT', $3)`,
        [req.user.user_id, req.user.username, req.ip]
      );
    }

    res.json({
      success: true,
      message: 'Çıkış başarılı.',
    });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Refresh token gereklidir.',
      });
      return;
    }

    interface DecodedRefreshToken {
      user_id: number;
      username: string;
      type: string;
    }
    let decoded: DecodedRefreshToken | null;
    try {
      decoded = jwt.verify(refreshToken, getJwtSecret()) as DecodedRefreshToken;
    } catch (verifyErr) {
      if (verifyErr instanceof jwt.TokenExpiredError) {
        decoded = jwt.decode(refreshToken) as DecodedRefreshToken | null;
      } else {
        res.status(HTTP_STATUS.UNAUTHORIZED).json({
          success: false,
          error: 'Geçersiz refresh token.',
        });
        return;
      }
    }
    if (!decoded || !decoded.user_id) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Geçersiz refresh token formatı.',
      });
      return;
    }

    // Get all non-revoked tokens for this user and compare with bcrypt
    const tokensResult = await client.query(
      `SELECT rt.token_id, rt.token_hash, rt.expires_at, rt.is_revoked,
              u.user_id, u.username, u.email, u.full_name, u.role, w.code AS warehouse_code, u.is_active
       FROM wms_refresh_tokens rt
       JOIN users u ON rt.user_id = u.user_id
       LEFT JOIN wms_warehouses w ON u.warehouse_id = w.warehouse_id
       WHERE rt.user_id = $1 AND rt.is_revoked = false`,
      [decoded.user_id]
    );

    // Find matching token using bcrypt.compare
    let tokenData = null;
    for (const row of tokensResult.rows) {
      const isMatch = await bcrypt.compare(refreshToken, row.token_hash);
      if (isMatch) {
        tokenData = row;
        break;
      }
    }

    if (!tokenData) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Geçersiz refresh token.',
      });
      return;
    }

    // Check if token is revoked
    if (tokenData.is_revoked) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Token iptal edilmiş.',
      });
      return;
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Token süresi dolmuş.',
      });
      return;
    }

    // Check if user is still active
    if (!tokenData.is_active) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: 'Hesabınız devre dışı bırakıldı.',
      });
      return;
    }

    // Generate new access token
    const authUser: AuthUser = {
      user_id: tokenData.user_id,
      username: tokenData.username,
      email: tokenData.email,
      full_name: tokenData.full_name,
      role: tokenData.role,
      warehouse_code: tokenData.warehouse_code,
    };

    const newAccessToken = generateToken(authUser);

    res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
      },
      message: 'Token yenilendi.',
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Yetkilendirme gerekli.',
      });
      return;
    }

    // Get full user details
    const userResult = await pool.query(
      `SELECT
         u.user_id,
         u.username,
         u.email,
         u.full_name,
         u.role,
         w.code AS warehouse_code,
         w.name AS warehouse_name,
         u.created_at,
         u.last_login,
         '[]'::json AS permissions
       FROM users u
       LEFT JOIN wms_warehouses w ON u.warehouse_id = w.warehouse_id
       WHERE u.user_id = $1`,
      [req.user.user_id]
    );

    if (userResult.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: ERROR_MESSAGES.NOT_FOUND,
      });
      return;
    }

    res.json({
      success: true,
      data: userResult.rows[0],
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  }
};

/**
 * Change password
 */
export const changePassword = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    if (!req.user) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Yetkilendirme gerekli.',
      });
      return;
    }

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Mevcut ve yeni şifre gereklidir.',
      });
      return;
    }

    if (newPassword.length < 6) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Yeni şifre en az 6 karakter olmalıdır.',
      });
      return;
    }

    // Get current password hash
    const userResult = await client.query(
      `SELECT password_hash FROM users WHERE user_id = $1`,
      [req.user.user_id]
    );

    if (userResult.rows.length === 0) {
      res.status(HTTP_STATUS.NOT_FOUND).json({
        success: false,
        error: 'Kullanıcı bulunamadı.',
      });
      return;
    }

    // Verify current password
    const passwordMatch = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);

    if (!passwordMatch) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Mevcut şifre hatalı.',
      });
      return;
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password and clear must_change_password flag
    await client.query(
      `UPDATE users SET password_hash = $1, must_change_password = false, updated_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
      [newPasswordHash, req.user.user_id]
    );

    // Revoke all refresh tokens (force re-login on all devices)
    await client.query(
      `UPDATE wms_refresh_tokens SET is_revoked = true WHERE user_id = $1`,
      [req.user.user_id]
    );

    // Log audit event
    await client.query(
      `INSERT INTO wms_audit_logs (user_id, username, action, ip_address)
       VALUES ($1, $2, 'PASSWORD_CHANGE', $3)`,
      [req.user.user_id, req.user.username, req.ip]
    );

    res.json({
      success: true,
      message: 'Şifre başarıyla değiştirildi.',
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};

/**
 * Google OAuth login
 */
export const googleLogin = async (req: AuthRequest, res: Response): Promise<void> => {
  const client = await pool.connect();

  try {
    const { credential, device_uuid, device_name } = req.body;

    if (!credential) {
      res.status(HTTP_STATUS.BAD_REQUEST).json({
        success: false,
        error: 'Google credential gereklidir.',
      });
      return;
    }

    // Verify Google token
    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (err) {
      logger.error('Google token verification error:', err);
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Geçersiz Google token.',
      });
      return;
    }

    const payload = ticket.getPayload();
    if (!payload || !payload.email) {
      res.status(HTTP_STATUS.UNAUTHORIZED).json({
        success: false,
        error: 'Google hesabından email alınamadı.',
      });
      return;
    }

    const googleEmail = payload.email.toLowerCase();
    const googleName = payload.name || payload.email.split('@')[0];

    // Check if email is in allowed list
    const allowedEmails = getAllowedEmails();
    if (allowedEmails.length > 0 && !allowedEmails.includes(googleEmail)) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: 'Bu email adresi ile giriş yapma yetkiniz yok.',
      });
      return;
    }

    // Find or create user by email
    const userResult = await client.query(
      `SELECT u.user_id, u.username, u.email, u.full_name, u.role, w.code AS warehouse_code, u.is_active
       FROM users u
       LEFT JOIN wms_warehouses w ON u.warehouse_id = w.warehouse_id
       WHERE u.email = $1`,
      [googleEmail]
    );

    let user;

    if (userResult.rows.length === 0) {
      // Create new user with Google info
      const username = googleEmail.split('@')[0] + '_' + Date.now().toString().slice(-4);
      const randomPassword = uuidv4();
      const passwordHash = await bcrypt.hash(randomPassword, SALT_ROUNDS);

      const newUserResult = await client.query(
        `INSERT INTO users (username, email, password_hash, full_name, role, is_active, must_change_password)
         VALUES ($1, $2, $3, $4, 'OPERATOR', true, false)
         RETURNING user_id, username, email, full_name, role, is_active`,
        [username, googleEmail, passwordHash, googleName]
      );
      user = { ...newUserResult.rows[0], warehouse_code: null };

      logger.info(`New user created via Google OAuth: ${googleEmail}`);
    } else {
      user = userResult.rows[0];
    }

    // Check if user is active
    if (!user.is_active) {
      res.status(HTTP_STATUS.FORBIDDEN).json({
        success: false,
        error: 'Hesabınız devre dışı bırakıldı.',
      });
      return;
    }

    // Update last login
    await client.query(
      `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE user_id = $1`,
      [user.user_id]
    );

    // Create auth user object
    const authUser: AuthUser = {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      warehouse_code: user.warehouse_code,
    };

    // Generate tokens
    const accessToken = generateToken(authUser);
    const refreshToken = generateRefreshToken(authUser);

    // Store refresh token in database
    const tokenHash = await bcrypt.hash(refreshToken, SALT_ROUNDS);
    await client.query(
      `INSERT INTO wms_refresh_tokens (user_id, token_hash, device_uuid, device_name, expires_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '7 days')`,
      [user.user_id, tokenHash, device_uuid || null, device_name || null]
    );

    // Log audit event
    await client.query(
      `INSERT INTO wms_audit_logs (user_id, username, action, ip_address, user_agent)
       VALUES ($1, $2, 'GOOGLE_LOGIN', $3, $4)`,
      [user.user_id, user.username, req.ip, req.get('user-agent')]
    );

    res.json({
      success: true,
      data: {
        user: {
          user_id: user.user_id,
          username: user.username,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          warehouse_code: user.warehouse_code,
        },
        accessToken,
        refreshToken,
        must_change_password: false,
      },
      message: 'Google ile giriş başarılı.',
    });
  } catch (error) {
    logger.error('Google login error:', error);
    res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: ERROR_MESSAGES.INTERNAL_ERROR,
    });
  } finally {
    client.release();
  }
};
