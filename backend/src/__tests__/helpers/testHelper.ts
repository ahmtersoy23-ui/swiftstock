// ============================================
// TEST HELPER UTILITIES
// ============================================

import { Application } from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app';

const JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';

export interface TestUser {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'MANAGER' | 'OPERATOR' | 'VIEWER';
  warehouse_code?: string;
}

export const testUsers = {
  admin: {
    user_id: 1,
    username: 'admin',
    email: 'admin@test.com',
    full_name: 'Test Admin',
    role: 'ADMIN' as const,
    warehouse_code: 'WH001',
  },
  manager: {
    user_id: 2,
    username: 'manager',
    email: 'manager@test.com',
    full_name: 'Test Manager',
    role: 'MANAGER' as const,
    warehouse_code: 'WH001',
  },
  operator: {
    user_id: 3,
    username: 'operator',
    email: 'operator@test.com',
    full_name: 'Test Operator',
    role: 'OPERATOR' as const,
    warehouse_code: 'WH001',
  },
  viewer: {
    user_id: 4,
    username: 'viewer',
    email: 'viewer@test.com',
    full_name: 'Test Viewer',
    role: 'VIEWER' as const,
    warehouse_code: 'WH001',
  },
};

/**
 * Generate a test JWT token for a user
 */
export function generateTestToken(user: TestUser): string {
  return jwt.sign(
    {
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      warehouse_code: user.warehouse_code,
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Create an authenticated request helper
 */
export function authRequest(app: Application, user: TestUser = testUsers.admin) {
  const token = generateTestToken(user);

  return {
    get: (url: string) => request(app).get(url).set('Authorization', `Bearer ${token}`),
    post: (url: string) => request(app).post(url).set('Authorization', `Bearer ${token}`),
    put: (url: string) => request(app).put(url).set('Authorization', `Bearer ${token}`),
    delete: (url: string) => request(app).delete(url).set('Authorization', `Bearer ${token}`),
    patch: (url: string) => request(app).patch(url).set('Authorization', `Bearer ${token}`),
  };
}

/**
 * Create a test app instance
 */
export function getTestApp(): Application {
  return createApp();
}

/**
 * Wait for a specified time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
