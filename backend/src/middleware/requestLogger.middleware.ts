// ============================================
// REQUEST LOGGER MIDDLEWARE
// ============================================

import { Request, Response, NextFunction } from 'express';
import logger, { logResponse } from '../config/logger';

/**
 * Express middleware for logging HTTP requests and responses
 */
export const requestLoggerMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Skip logging in test environment
  if (process.env.NODE_ENV === 'test') {
    return next();
  }

  const startTime = Date.now();

  // Log request
  logger.http('Incoming request', {
    method: req.method,
    path: req.path,
    query: Object.keys(req.query).length > 0 ? req.query : undefined,
    ip: req.ip || req.socket.remoteAddress,
    userAgent: req.get('user-agent'),
  });

  // Capture response
  const originalSend = res.send;
  res.send = function (body): Response {
    const duration = Date.now() - startTime;
    logResponse(req.method, req.path, res.statusCode, duration);
    return originalSend.call(this, body);
  };

  next();
};

export default requestLoggerMiddleware;
