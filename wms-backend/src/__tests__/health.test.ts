// ============================================
// HEALTH ENDPOINT TESTS
// ============================================

import request from 'supertest';
import { getTestApp } from './helpers/testHelper';
import { Application } from 'express';

describe('Health Check Endpoint', () => {
  let app: Application;

  beforeAll(() => {
    app = getTestApp();
  });

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'WMS API is running');
      expect(response.body).toHaveProperty('timestamp');
    });

    it('should return valid timestamp', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(timestamp.getTime()).not.toBeNaN();
    });
  });

  describe('GET /api/v1/health', () => {
    it('should return health status from versioned endpoint', async () => {
      const response = await request(app)
        .get('/api/v1/health')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'WMS API is running');
    });
  });

  describe('GET /', () => {
    it('should return API info at root', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'WMS Backend API');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('apiVersion', 'v1');
      expect(response.body).toHaveProperty('endpoints');
    });
  });
});
