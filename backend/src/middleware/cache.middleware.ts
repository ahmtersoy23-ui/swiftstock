// ============================================
// CACHE MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from 'express';
import cacheService, { CACHE_TTL } from '../config/redis';
import logger from '../config/logger';

/**
 * Cache middleware for GET requests
 * @param ttl - Time to live in seconds
 * @param keyGenerator - Optional custom key generator function
 */
export const cacheMiddleware = (
  ttl: number = CACHE_TTL.MEDIUM,
  keyGenerator?: (req: Request) => string
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Generate cache key
    const cacheKey = keyGenerator
      ? keyGenerator(req)
      : `api:${req.originalUrl}`;

    try {
      // Try to get from cache
      const cachedResponse = await cacheService.get<{
        statusCode: number;
        body: unknown;
      }>(cacheKey);

      if (cachedResponse) {
        logger.debug('Cache hit', { key: cacheKey });
        res.status(cachedResponse.statusCode).json(cachedResponse.body);
        return;
      }

      // Store original json function
      const originalJson = res.json.bind(res);

      // Override json to cache the response
      res.json = ((body: unknown) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          cacheService.set(cacheKey, {
            statusCode: res.statusCode,
            body,
          }, ttl);
          logger.debug('Cache set', { key: cacheKey, ttl });
        }

        return originalJson(body);
      }) as Response['json'];

      next();
    } catch (error) {
      logger.warn('Cache middleware error', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      next();
    }
  };
};

/**
 * Clear cache for specific patterns
 */
export const clearCacheMiddleware = (patterns: string[]) => {
  return async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Store original json function
    const originalJson = res.json.bind(res);

    // Override json to clear cache after successful response
    res.json = ((body: unknown) => {
      // Only clear cache on successful mutations
      if (res.statusCode >= 200 && res.statusCode < 300) {
        patterns.forEach((pattern) => {
          cacheService.deletePattern(pattern);
          logger.debug('Cache cleared', { pattern });
        });
      }

      return originalJson(body);
    }) as Response['json'];

    next();
  };
};

export default cacheMiddleware;
