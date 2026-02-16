// ============================================
// AUTHENTICATION TESTS
// ============================================

import request from 'supertest';
import { getTestApp, authRequest, testUsers, generateTestToken } from './helpers/testHelper';
import { Application } from 'express';

describe('Authentication Endpoints', () => {
  let app: Application;

  beforeAll(() => {
    app = getTestApp();
  });

  describe('POST /api/auth/login', () => {
    it('should validate request body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('details');
    });

    it('should require username and password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'test' })
        .expect(400);

      expect(response.body.details).toContainEqual(
        expect.objectContaining({ field: 'password' })
      );
    });
  });

  describe('GET /api/auth/profile', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should accept valid token', async () => {
      const token = generateTestToken(testUsers.admin);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('username', 'admin');
      expect(response.body.data).toHaveProperty('role', 'ADMIN');
    });

    it('should not return password in profile', async () => {
      const token = generateTestToken(testUsers.admin);

      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.data).not.toHaveProperty('password');
      expect(response.body.data).not.toHaveProperty('password_hash');
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/change-password')
        .send({
          current_password: 'oldpass',
          new_password: 'newpass123',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate password requirements', async () => {
      const token = generateTestToken(testUsers.admin);

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          current_password: 'old',
          new_password: '12', // too short
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should require refresh_token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should validate refresh_token format', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refresh_token: '' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should accept logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    it('should accept logout with token', async () => {
      const token = generateTestToken(testUsers.admin);

      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });
  });
});

describe('Protected Endpoints (No Auth)', () => {
  let app: Application;

  beforeAll(() => {
    app = getTestApp();
  });

  describe('Endpoints requiring authentication', () => {
    const protectedEndpoints = [
      { method: 'get', path: '/api/users' },
      { method: 'get', path: '/api/orders' },
      { method: 'get', path: '/api/cycle-counts' },
      { method: 'get', path: '/api/rma' },
    ];

    protectedEndpoints.forEach(({ method, path }) => {
      it(`should require auth for ${method.toUpperCase()} ${path}`, async () => {
        const response = await (request(app) as any)[method](path);
        expect(response.status).toBe(401);
      });
    });
  });

  describe('Admin-only endpoints validation', () => {
    it('should reject user creation without auth', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          username: 'newuser',
          password: 'testpass123',
          email: 'new@test.com',
          role: 'OPERATOR',
        })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject user deletion without auth', async () => {
      const response = await request(app)
        .delete('/api/users/1')
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject password reset without auth', async () => {
      const response = await request(app)
        .post('/api/users/1/reset-password')
        .send({ new_password: 'newpass123' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});

// Note: RBAC integration tests requiring database would go here
// These tests verify that tokens are properly validated but
// full RBAC testing requires database mocking or integration tests
