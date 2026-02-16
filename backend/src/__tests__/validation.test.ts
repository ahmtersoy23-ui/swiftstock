// ============================================
// VALIDATION MIDDLEWARE TESTS
// ============================================

import request from 'supertest';
import { getTestApp } from './helpers/testHelper';
import { Application } from 'express';

describe('Validation Middleware', () => {
  let app: Application;

  beforeAll(() => {
    app = getTestApp();
  });

  describe('Login Validation', () => {
    it('should reject login without username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'test123' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.details).toContainEqual(
        expect.objectContaining({ field: 'username' })
      );
    });

    it('should reject login without password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.details).toContainEqual(
        expect.objectContaining({ field: 'password' })
      );
    });

    it('should reject login with empty body', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Scan Validation', () => {
    it('should reject scan without barcode', async () => {
      const response = await request(app)
        .post('/api/scan')
        .send({ scan_type: 'PRODUCT' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.details).toContainEqual(
        expect.objectContaining({ field: 'barcode' })
      );
    });

    it('should reject scan with empty barcode', async () => {
      const response = await request(app)
        .post('/api/scan')
        .send({ barcode: '' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Product Validation', () => {
    it('should reject product creation without sku_code', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({
          name: 'Test Product',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.details).toContainEqual(
        expect.objectContaining({ field: 'sku_code' })
      );
    });

    it('should reject product creation without name', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({
          sku_code: 'SKU001',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body.details).toContainEqual(
        expect.objectContaining({ field: 'name' })
      );
    });
  });

  describe('Transaction Validation', () => {
    it('should reject transaction without transaction_type', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          warehouse_code: 'WH001',
          sku_code: 'SKU001',
          quantity: 10,
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject transaction with invalid type', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          transaction_type: 'INVALID',
          warehouse_code: 'WH001',
          sku_code: 'SKU001',
          quantity: 10,
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject transaction without sku_code', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          transaction_type: 'RECEIVE',
          warehouse_code: 'WH001',
          quantity: 10,
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject transaction with negative quantity', async () => {
      const response = await request(app)
        .post('/api/transactions')
        .send({
          transaction_type: 'RECEIVE',
          warehouse_code: 'WH001',
          sku_code: 'SKU001',
          quantity: -5,
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Location Validation', () => {
    it('should reject location without warehouse_code', async () => {
      const response = await request(app)
        .post('/api/locations')
        .send({
          location_code: 'LOC001',
          qr_code: 'QR001',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject location without location_code', async () => {
      const response = await request(app)
        .post('/api/locations')
        .send({
          warehouse_code: 'WH001',
          qr_code: 'QR001',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject location without qr_code', async () => {
      const response = await request(app)
        .post('/api/locations')
        .send({
          warehouse_code: 'WH001',
          location_code: 'LOC001',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Container Validation', () => {
    it('should reject container without container_type', async () => {
      const response = await request(app)
        .post('/api/containers')
        .send({
          warehouse_code: 'WH001',
          created_by: 'testuser',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject container with invalid type', async () => {
      const response = await request(app)
        .post('/api/containers')
        .send({
          container_type: 'INVALID',
          warehouse_code: 'WH001',
          created_by: 'testuser',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should reject container without created_by', async () => {
      const response = await request(app)
        .post('/api/containers')
        .send({
          container_type: 'BOX',
          warehouse_code: 'WH001',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });
});
