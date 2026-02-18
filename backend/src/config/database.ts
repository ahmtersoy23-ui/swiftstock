import { Pool } from 'pg';
import dotenv from 'dotenv';
import logger from './logger';
import { DB_MAX_CONNECTIONS, DB_IDLE_TIMEOUT_MS, DB_CONNECTION_TIMEOUT_MS } from '../constants';

dotenv.config();

const pool = new Pool({
  // Use Unix socket for local connections (much faster than TCP)
  host: process.env.DB_HOST || '/var/run/postgresql',
  port: process.env.DB_HOST ? parseInt(process.env.DB_PORT || '5432') : undefined,
  database: process.env.DB_NAME || 'swiftstock_db',
  user: process.env.DB_USER || 'swiftstock',
  password: process.env.DB_PASSWORD,
  // Pool configuration (configurable via env vars, see constants.ts)
  max: DB_MAX_CONNECTIONS,
  idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
  // Allow the pool to remove idle connections down to 0 when not under load
  allowExitOnIdle: false,
});

// Log connection events
pool.on('connect', () => {
  logger.info('[DB] New client connected to pool');
});

// Pool-level error handler for idle clients
// This catches errors on idle clients sitting in the pool (e.g., server restart, network drop).
// We log but do NOT exit -- pg Pool will remove the errored client and create a new one on demand.
pool.on('error', (err: Error) => {
  logger.error('[DB] Unexpected error on idle database client:', err.message);
  // Only exit on truly fatal errors (e.g., authentication failures that will never recover)
  if (err.message.includes('password authentication failed') ||
      err.message.includes('database') && err.message.includes('does not exist')) {
    logger.error('[DB] Fatal database configuration error. Shutting down.');
    process.exit(1);
  }
  // For transient errors (network issues, server restarts), the pool will self-heal
});

pool.on('remove', () => {
  logger.info('[DB] Client removed from pool');
});

export default pool;
