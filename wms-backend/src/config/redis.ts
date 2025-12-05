// ============================================
// REDIS CACHE CONFIGURATION
// ============================================

import Redis from 'ioredis';
import logger from './logger';

// Default TTL values (in seconds)
export const CACHE_TTL = {
  SHORT: 60,         // 1 minute
  MEDIUM: 300,       // 5 minutes
  LONG: 3600,        // 1 hour
  VERY_LONG: 86400,  // 24 hours
} as const;

// Cache key prefixes for organization
export const CACHE_PREFIX = {
  PRODUCT: 'product:',
  INVENTORY: 'inventory:',
  USER: 'user:',
  SESSION: 'session:',
  LOCATION: 'location:',
  WAREHOUSE: 'warehouse:',
} as const;

// Redis client instance
let redisClient: Redis | null = null;

/**
 * Get or create Redis client
 */
export const getRedisClient = (): Redis | null => {
  if (process.env.NODE_ENV === 'test') {
    return null;
  }

  if (redisClient) {
    return redisClient;
  }

  const host = process.env.REDIS_HOST || 'localhost';
  const port = parseInt(process.env.REDIS_PORT || '6379', 10);
  const password = process.env.REDIS_PASSWORD;

  try {
    redisClient = new Redis({
      host,
      port,
      password: password || undefined,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          logger.warn('Redis connection failed, cache disabled', { attempts: times });
          return null;
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    redisClient.on('error', (err) => {
      logger.error('Redis error', { error: err.message });
    });

    redisClient.on('close', () => {
      logger.warn('Redis connection closed');
    });

    return redisClient;
  } catch (error) {
    logger.warn('Redis initialization failed, cache disabled', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
};

/**
 * Cache service for common operations
 */
export const cacheService = {
  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    const client = getRedisClient();
    if (!client) return null;

    try {
      const value = await client.get(key);
      if (!value) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      logger.warn('Cache get failed', { key, error: error instanceof Error ? error.message : 'Unknown' });
      return null;
    }
  },

  /**
   * Set value in cache with TTL
   */
  async set(key: string, value: unknown, ttl: number = CACHE_TTL.MEDIUM): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      await client.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.warn('Cache set failed', { key, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  },

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      await client.del(key);
      return true;
    } catch (error) {
      logger.warn('Cache delete failed', { key, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  },

  /**
   * Delete all keys matching pattern
   */
  async deletePattern(pattern: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const keys = await client.keys(pattern);
      if (keys.length > 0) {
        await client.del(...keys);
      }
      return true;
    } catch (error) {
      logger.warn('Cache deletePattern failed', { pattern, error: error instanceof Error ? error.message : 'Unknown' });
      return false;
    }
  },

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = getRedisClient();
    if (!client) return false;

    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      return false;
    }
  },

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = CACHE_TTL.MEDIUM
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Fetch fresh data
    const freshData = await fetchFn();

    // Cache the result (non-blocking)
    this.set(key, freshData, ttl);

    return freshData;
  },
};

/**
 * Close Redis connection
 */
export const closeRedisConnection = async (): Promise<void> => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis connection closed');
  }
};

export default cacheService;
