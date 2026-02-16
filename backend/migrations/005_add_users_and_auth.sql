-- ============================================
-- USERS & AUTHENTICATION SYSTEM
-- ============================================
-- This migration adds user management and authentication tables

-- Users table - Stores user accounts and basic info
CREATE TABLE IF NOT EXISTS users (
  user_id SERIAL PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100),
  role VARCHAR(20) NOT NULL DEFAULT 'OPERATOR',
  warehouse_code VARCHAR(10),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  created_by VARCHAR(50),

  CONSTRAINT chk_role CHECK (role IN ('ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER')),
  CONSTRAINT fk_warehouse FOREIGN KEY (warehouse_code)
    REFERENCES warehouses(code) ON DELETE SET NULL
);

-- User permissions table - Granular permission control
CREATE TABLE IF NOT EXISTS user_permissions (
  permission_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  permission_type VARCHAR(50) NOT NULL,
  resource VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT unique_user_permission UNIQUE (user_id, permission_type, resource)
);

-- Refresh tokens table - For JWT refresh token management
CREATE TABLE IF NOT EXISTS refresh_tokens (
  token_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  device_id VARCHAR(100),
  is_revoked BOOLEAN DEFAULT false,

  CONSTRAINT fk_user_token FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE CASCADE
);

-- Audit log table - Track user actions
CREATE TABLE IF NOT EXISTS audit_logs (
  log_id SERIAL PRIMARY KEY,
  user_id INTEGER,
  username VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id VARCHAR(100),
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_audit_user FOREIGN KEY (user_id)
    REFERENCES users(user_id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Users table indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active_role ON users(is_active, role);
CREATE INDEX IF NOT EXISTS idx_users_warehouse ON users(warehouse_code, is_active);

-- Permissions indexes
CREATE INDEX IF NOT EXISTS idx_permissions_user ON user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_permissions_type ON user_permissions(permission_type);

-- Refresh tokens indexes
CREATE INDEX IF NOT EXISTS idx_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_tokens_expires ON refresh_tokens(expires_at);

-- Audit logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_id);

-- ============================================
-- DEFAULT DATA
-- ============================================

-- Insert default admin user (password: Admin123!)
-- Note: This is a bcrypt hash of "Admin123!" - should be changed in production
INSERT INTO users (username, email, password_hash, full_name, role, is_active, created_by)
VALUES (
  'admin',
  'admin@wms.com',
  '$2b$10$YourBcryptHashHere', -- Will be replaced with actual hash
  'System Administrator',
  'ADMIN',
  true,
  'SYSTEM'
) ON CONFLICT (username) DO NOTHING;

-- Default permissions for ADMIN role (full access)
INSERT INTO user_permissions (user_id, permission_type, resource)
SELECT
  u.user_id,
  perm.permission_type,
  perm.resource
FROM users u
CROSS JOIN (
  VALUES
    ('CREATE', 'products'),
    ('READ', 'products'),
    ('UPDATE', 'products'),
    ('DELETE', 'products'),
    ('CREATE', 'transactions'),
    ('READ', 'transactions'),
    ('UPDATE', 'transactions'),
    ('DELETE', 'transactions'),
    ('CREATE', 'inventory'),
    ('READ', 'inventory'),
    ('UPDATE', 'inventory'),
    ('DELETE', 'inventory'),
    ('CREATE', 'users'),
    ('READ', 'users'),
    ('UPDATE', 'users'),
    ('DELETE', 'users'),
    ('CREATE', 'locations'),
    ('READ', 'locations'),
    ('UPDATE', 'locations'),
    ('DELETE', 'locations'),
    ('CREATE', 'containers'),
    ('READ', 'containers'),
    ('UPDATE', 'containers'),
    ('DELETE', 'containers'),
    ('CREATE', 'reports'),
    ('READ', 'reports'),
    ('EXPORT', 'reports'),
    ('MANAGE', 'settings')
) AS perm(permission_type, resource)
WHERE u.username = 'admin' AND u.role = 'ADMIN'
ON CONFLICT (user_id, permission_type, resource) DO NOTHING;

-- ============================================
-- TRIGGERS
-- ============================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger to clean expired refresh tokens
CREATE OR REPLACE FUNCTION clean_expired_tokens()
RETURNS void AS $$
BEGIN
  DELETE FROM refresh_tokens
  WHERE expires_at < CURRENT_TIMESTAMP
    OR is_revoked = true;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE users IS 'User accounts for WMS system authentication';
COMMENT ON TABLE user_permissions IS 'Granular permission control for users';
COMMENT ON TABLE refresh_tokens IS 'JWT refresh tokens for session management';
COMMENT ON TABLE audit_logs IS 'Audit trail of all user actions in the system';

COMMENT ON COLUMN users.role IS 'ADMIN: Full access, MANAGER: Warehouse management, OPERATOR: Day-to-day operations, VIEWER: Read-only';
COMMENT ON COLUMN users.warehouse_code IS 'Default warehouse assignment for user (NULL = all warehouses)';
COMMENT ON COLUMN user_permissions.permission_type IS 'CREATE, READ, UPDATE, DELETE, EXPORT, MANAGE';
COMMENT ON COLUMN user_permissions.resource IS 'products, transactions, inventory, users, locations, containers, reports, settings';
