// ============================================
// RATE LIMITER MIDDLEWARE
import logger from '../config/logger';
// ============================================

import rateLimit from 'express-rate-limit';
import { HTTP_STATUS } from '../constants';

/**
 * Login rate limiter - Brute force protection
 * 5 attempts per 15 minutes per IP
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Çok fazla başarısız giriş denemesi. 15 dakika sonra tekrar deneyin.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: true, // Don't count successful logins
  validate: { xForwardedForHeader: false }, // Disable IPv6 validation warning
});

/**
 * Password reset/change rate limiter
 * 3 attempts per hour
 */
export const passwordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    error: 'Çok fazla şifre değişikliği denemesi. 1 saat sonra tekrar deneyin.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * General API rate limiter
 * 100 requests per minute
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100,
  message: {
    success: false,
    error: 'Çok fazla istek gönderildi. Lütfen biraz bekleyin.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Token refresh rate limiter
 * 10 attempts per minute
 */
export const refreshTokenRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: {
    success: false,
    error: 'Çok fazla token yenileme denemesi.',
    code: 'RATE_LIMIT_EXCEEDED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
