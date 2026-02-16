// ============================================
// WINSTON LOGGER CONFIGURATION
// ============================================

import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

// Custom log format for development
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let log = `${timestamp} [${level}]: ${message}`;
  if (stack) {
    log += `\n${stack}`;
  }
  if (Object.keys(meta).length > 0) {
    log += ` ${JSON.stringify(meta)}`;
  }
  return log;
});

// Custom log format for production (JSON)
const prodFormat = combine(
  timestamp({ format: 'ISO' }),
  errors({ stack: true }),
  json()
);

// Determine log level based on environment
const getLogLevel = (): string => {
  const env = process.env.NODE_ENV || 'development';
  if (env === 'test') return 'error';
  if (env === 'production') return 'info';
  return 'debug';
};

// Create logger instance
const logger = winston.createLogger({
  level: getLogLevel(),
  defaultMeta: { service: 'wms-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? prodFormat
        : combine(
            colorize({ all: true }),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            errors({ stack: true }),
            devFormat
          ),
    }),
  ],
});

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  const logsDir = process.env.LOGS_DIR || 'logs';

  // Error log file
  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: prodFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Combined log file
  logger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: prodFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Log HTTP request
 */
export const logRequest = (req: {
  method: string;
  path: string;
  ip?: string;
  user?: { user_id?: number; username?: string };
}) => {
  logger.http('HTTP Request', {
    method: req.method,
    path: req.path,
    ip: req.ip,
    userId: req.user?.user_id,
    username: req.user?.username,
  });
};

/**
 * Log HTTP response
 */
export const logResponse = (
  method: string,
  path: string,
  statusCode: number,
  duration: number
) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'http';
  logger.log(level, 'HTTP Response', {
    method,
    path,
    statusCode,
    duration: `${duration}ms`,
  });
};

/**
 * Log database query
 */
export const logDbQuery = (query: string, params?: unknown[], duration?: number) => {
  logger.debug('DB Query', {
    query: query.substring(0, 200),
    paramCount: params?.length || 0,
    duration: duration ? `${duration}ms` : undefined,
  });
};

/**
 * Log authentication event
 */
export const logAuth = (
  event: 'login' | 'logout' | 'token_refresh' | 'login_failed' | 'password_change',
  userId?: number,
  username?: string,
  details?: Record<string, unknown>
) => {
  const level = event === 'login_failed' ? 'warn' : 'info';
  logger.log(level, `Auth: ${event}`, {
    event,
    userId,
    username,
    ...details,
  });
};

/**
 * Log business event
 */
export const logBusiness = (
  event: string,
  data: Record<string, unknown>
) => {
  logger.info(`Business: ${event}`, data);
};

/**
 * Log error with context
 */
export const logError = (
  error: Error,
  context?: Record<string, unknown>
) => {
  logger.error(error.message, {
    error: error.name,
    stack: error.stack,
    ...context,
  });
};

export default logger;
