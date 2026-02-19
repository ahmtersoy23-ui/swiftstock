// ============================================
// EXPRESS APP (Testable Module)
// ============================================

import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import routes from './routes';
import { swaggerSpec } from './config/swagger';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, ERROR_MESSAGES } from './constants';
import { logError } from './config/logger';
import { requestLoggerMiddleware } from './middleware/requestLogger.middleware';

export function createApp(): Application {
  const app: Application = express();

  // Trust first proxy (nginx) — required for rate limiting & correct req.ip
  app.set('trust proxy', 1);

  // ============================================
  // SECURITY & PERFORMANCE MIDDLEWARE
  // ============================================

  // Helmet - Security headers
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Compression - Gzip responses
  app.use(compression());

  // Rate limiting - Prevent abuse (disabled in test environment)
  if (process.env.NODE_ENV !== 'test') {
    const limiter = rateLimit({
      windowMs: RATE_LIMIT_WINDOW_MS,
      max: RATE_LIMIT_MAX_REQUESTS,
      message: {
        success: false,
        error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    app.use('/api/', limiter);
  }

  // CORS - Cross-origin resource sharing
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3001'];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests without origin (server-to-server, health checks, Postman)
      if (!origin) {
        return callback(null, true);
      }

      if (allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    maxAge: 86400, // 24 hours
    optionsSuccessStatus: 200,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Request logging with Winston
  app.use(requestLoggerMiddleware);

  // API Versioning
  const API_VERSION = 'v1';

  // Swagger Documentation (development only)
  if (process.env.NODE_ENV === 'development') {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'WMS API Documentation',
    }));

    // Swagger JSON endpoint
    app.get('/api-docs.json', (_req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });
  }

  // Routes - versioned
  app.use(`/api/${API_VERSION}`, routes);

  // Backwards compatibility - redirect /api to /api/v1
  app.use('/api', routes);

  // Root endpoint
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: 'WMS Backend API',
      version: '1.0.0',
      apiVersion: API_VERSION,
      endpoints: {
        health: `/api/${API_VERSION}/health`,
        scan: `/api/${API_VERSION}/scan`,
        transactions: `/api/${API_VERSION}/transactions`,
        inventory: `/api/${API_VERSION}/inventory`,
        products: `/api/${API_VERSION}/products`,
        docs: '/api-docs',
      },
      legacySupport: 'API endpoints also available at /api/* for backwards compatibility',
    });
  });

  // Error handling middleware with Winston logging
  app.use((err: Error & { status?: number }, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Log error with Winston
    logError(err, {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });

    const statusCode = err.status || 500;
    res.status(statusCode).json({
      success: false,
      error: statusCode >= 500 && process.env.NODE_ENV === 'production'
        ? 'Internal Server Error'
        : (err.message || 'Internal Server Error'),
    });
  });

  return app;
}

export default createApp;
