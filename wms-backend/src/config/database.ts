import { Pool } from 'pg';
import dotenv from 'dotenv';
import { DB_MAX_CONNECTIONS, DB_IDLE_TIMEOUT_MS, DB_CONNECTION_TIMEOUT_MS } from '../constants';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'pricelab_db',  // Shared database
  user: process.env.DB_USER || 'swiftstock',       // SwiftStock user
  password: process.env.DB_PASSWORD,
  max: DB_MAX_CONNECTIONS,
  idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DB_CONNECTION_TIMEOUT_MS,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

export default pool;
