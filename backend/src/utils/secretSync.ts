// ============================================
// JWT SECRET SYNC — Apps-SSO Internal Endpoint
// ============================================
// SwiftStock generates its own JWTs (generateToken / generateRefreshToken).
// When Apps-SSO rotates JWT_SECRET, SwiftStock must use the new value or its
// tokens will be rejected by Apps-SSO's verify endpoint.
//
// Solution: Poll Apps-SSO's internal endpoint every 5 minutes.
// Fallback: If Apps-SSO is unreachable, continue with the last known value.
// ============================================

import axios from 'axios';
import logger from '../config/logger';

// Initialise from env so SwiftStock works even before the first successful sync
let cachedJwtSecret: string = process.env.JWT_SECRET || '';

const SSO_INTERNAL_URL = process.env.SSO_INTERNAL_URL || 'http://localhost:3005';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

/**
 * Fetch the current JWT_SECRET from Apps-SSO and update the in-memory cache.
 * Safe to call at any time — never throws; failures are logged as warnings.
 */
export async function syncJwtSecret(): Promise<void> {
  try {
    const res = await axios.get<{ secret: string }>(
      `${SSO_INTERNAL_URL}/api/internal/jwt-secret`,
      {
        headers: { 'X-Internal-API-Key': INTERNAL_API_KEY },
        timeout: 5000,
      }
    );

    if (res.data?.secret) {
      cachedJwtSecret = res.data.secret;
      logger.info('JWT_SECRET synced from Apps-SSO');
    } else {
      logger.warn('Apps-SSO internal endpoint returned empty secret — keeping cached value');
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn(`Failed to sync JWT_SECRET from Apps-SSO (${message}) — using cached/env value`);
    // Graceful degradation: continue with the last known value
  }
}

/**
 * Return the current JWT_SECRET.
 * Priority: synced value from Apps-SSO → process.env.JWT_SECRET
 */
export function getJwtSecret(): string {
  return cachedJwtSecret || process.env.JWT_SECRET || '';
}

/**
 * Start a background interval that keeps the secret in sync.
 * Default interval: 5 minutes (300 000 ms).
 */
export function startSecretPolling(intervalMs = 5 * 60 * 1000): void {
  setInterval(() => {
    syncJwtSecret().catch(() => {
      // Already handled inside syncJwtSecret — this prevents unhandled rejections
    });
  }, intervalMs);

  logger.info(`JWT_SECRET polling started (interval: ${intervalMs / 1000}s)`);
}
