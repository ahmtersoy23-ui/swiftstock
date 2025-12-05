// Mock uuid module for Jest
export const v4 = jest.fn(() => 'test-uuid-12345678-1234-1234-1234-123456789abc');
export const v1 = jest.fn(() => 'test-uuid-v1');
export const validate = jest.fn(() => true);
