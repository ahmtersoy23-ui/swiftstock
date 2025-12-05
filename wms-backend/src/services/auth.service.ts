// ============================================
// AUTH SERVICE
// ============================================

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database';
import { AuthUser, generateToken, generateRefreshToken } from '../middleware/auth.middleware';
import logger from '../utils/logger';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const BCRYPT_ROUNDS = 12;

export interface LoginResult {
  success: boolean;
  user?: AuthUser;
  accessToken?: string;
  refreshToken?: string;
  must_change_password?: boolean;
  error?: string;
}

export interface RefreshResult {
  success: boolean;
  accessToken?: string;
  error?: string;
}

interface DecodedRefreshToken {
  user_id: number;
  username: string;
  type: string;
}

class AuthService {
  /**
   * Authenticate user and generate tokens
   */
  async login(
    username: string,
    password: string,
    deviceUuid?: string,
    deviceName?: string
  ): Promise<LoginResult> {
    const client = await pool.connect();

    try {
      // Find user
      const userResult = await client.query(
        `SELECT user_id, username, email, full_name, password_hash, role, warehouse_code, is_active, must_change_password
         FROM users
         WHERE username = $1`,
        [username]
      );

      if (userResult.rows.length === 0) {
        return { success: false, error: 'Kullanıcı bulunamadı' };
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return { success: false, error: 'Hesabınız devre dışı bırakıldı' };
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (!passwordValid) {
        return { success: false, error: 'Hatalı şifre' };
      }

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

      // Hash and store refresh token
      const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_ROUNDS);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, device_uuid, device_name, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.user_id, refreshTokenHash, deviceUuid, deviceName, expiresAt]
      );

      // Update last login
      await client.query(
        `UPDATE users SET last_login = NOW() WHERE user_id = $1`,
        [user.user_id]
      );

      return {
        success: true,
        user: authUser,
        accessToken,
        refreshToken,
        must_change_password: user.must_change_password,
      };
    } catch (error) {
      logger.error('Login error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
    try {
      // Decode token to get user_id (without verifying - just to find it)
      let decoded: DecodedRefreshToken | null;
      try {
        decoded = jwt.decode(refreshToken) as DecodedRefreshToken | null;
      } catch {
        return { success: false, error: 'Geçersiz token formatı' };
      }

      if (!decoded || decoded.type !== 'refresh' || !decoded.user_id) {
        return { success: false, error: 'Geçersiz refresh token' };
      }

      // Get all refresh tokens for this user
      const tokensResult = await pool.query(
        `SELECT rt.token_id, rt.token_hash, u.user_id, u.username, u.email, u.full_name, u.role, u.warehouse_code
         FROM refresh_tokens rt
         JOIN users u ON rt.user_id = u.user_id
         WHERE rt.user_id = $1 AND rt.expires_at > NOW() AND rt.revoked_at IS NULL`,
        [decoded.user_id]
      );

      if (tokensResult.rows.length === 0) {
        return { success: false, error: 'Refresh token bulunamadı veya süresi doldu' };
      }

      // Find matching token by comparing hashes
      let tokenData: typeof tokensResult.rows[0] | null = null;
      for (const row of tokensResult.rows) {
        const isMatch = await bcrypt.compare(refreshToken, row.token_hash);
        if (isMatch) {
          tokenData = row;
          break;
        }
      }

      if (!tokenData) {
        return { success: false, error: 'Geçersiz refresh token' };
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

      const accessToken = generateToken(authUser);

      return { success: true, accessToken };
    } catch (error) {
      logger.error('Refresh token error:', error);
      throw error;
    }
  }

  /**
   * Logout - revoke refresh token
   */
  async logout(refreshToken?: string, userId?: number): Promise<boolean> {
    try {
      if (!refreshToken && !userId) {
        return false;
      }

      if (refreshToken) {
        // Decode to get user_id
        let decoded: DecodedRefreshToken | null;
        try {
          decoded = jwt.decode(refreshToken) as DecodedRefreshToken | null;
        } catch {
          return false;
        }

        if (!decoded?.user_id) {
          return false;
        }

        // Get all tokens for user and find matching one
        const tokensResult = await pool.query(
          `SELECT token_id, token_hash FROM refresh_tokens
           WHERE user_id = $1 AND revoked_at IS NULL`,
          [decoded.user_id]
        );

        for (const row of tokensResult.rows) {
          const isMatch = await bcrypt.compare(refreshToken, row.token_hash);
          if (isMatch) {
            await pool.query(
              `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_id = $1`,
              [row.token_id]
            );
            return true;
          }
        }
      }

      // Fallback: revoke all tokens for user
      if (userId) {
        await pool.query(
          `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
          [userId]
        );
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Logout error:', error);
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get current password hash
      const userResult = await client.query(
        `SELECT password_hash FROM users WHERE user_id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Kullanıcı bulunamadı' };
      }

      // Verify current password
      const passwordValid = await bcrypt.compare(currentPassword, userResult.rows[0].password_hash);
      if (!passwordValid) {
        await client.query('ROLLBACK');
        return { success: false, error: 'Mevcut şifre hatalı' };
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

      // Update password
      await client.query(
        `UPDATE users SET password_hash = $1, must_change_password = false, updated_at = NOW()
         WHERE user_id = $2`,
        [newPasswordHash, userId]
      );

      // Revoke all refresh tokens (force re-login on all devices)
      await client.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
        [userId]
      );

      await client.query('COMMIT');
      return { success: true };
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Change password error:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get user profile
   */
  async getProfile(userId: number): Promise<AuthUser | null> {
    try {
      const result = await pool.query(
        `SELECT user_id, username, email, full_name, role, warehouse_code
         FROM users WHERE user_id = $1`,
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Get profile error:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
