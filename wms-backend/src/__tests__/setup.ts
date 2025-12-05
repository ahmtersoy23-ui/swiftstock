// ============================================
// TEST SETUP
// ============================================

import dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';

// Global test timeout
jest.setTimeout(10000);

// Suppress console.error for rate limiter warnings in tests
const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  const message = args[0];
  if (typeof message === 'object' && message !== null && 'code' in message) {
    const err = message as { code?: string };
    if (err.code === 'ERR_ERL_KEY_GEN_IPV6') {
      return; // Suppress rate limiter IPv6 warning
    }
  }
  originalConsoleError.apply(console, args);
};

// Clean up after all tests
afterAll(async () => {
  // Restore console.error
  console.error = originalConsoleError;

  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 100));
});
