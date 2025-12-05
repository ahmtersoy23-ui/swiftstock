// ============================================
// LOGGER UTILITY
// ============================================

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Simple logger that respects NODE_ENV
 * In production, only errors are logged
 */
export const logger = {
  info: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  debug: (...args: unknown[]) => {
    if (isDevelopment) {
      console.log('[DEBUG]', ...args);
    }
  },

  warn: (...args: unknown[]) => {
    if (isDevelopment) {
      console.warn('[WARN]', ...args);
    }
  },

  error: (...args: unknown[]) => {
    // Always log errors, but with less detail in production
    if (isDevelopment) {
      console.error('[ERROR]', ...args);
    } else {
      // In production, log error message without stack traces
      const sanitized = args.map((arg) => {
        if (arg instanceof Error) {
          return arg.message;
        }
        return arg;
      });
      console.error('[ERROR]', ...sanitized);
    }
  },

  // For startup messages - always shown
  startup: (...args: unknown[]) => {
    console.log(...args);
  },
};

export default logger;
