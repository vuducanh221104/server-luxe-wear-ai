/**
 * @file setup.ts
 * @description Test setup and utilities
 */

import dotenv from "dotenv";

// Load environment variables for testing
dotenv.config({ path: ".env.test" });

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "error"; // Reduce log noise during tests

// Mock external services for unit tests
if (process.env.TEST_TYPE === "unit") {
  jest.mock("../../../src/config/logger", () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  }));
}

// Global test timeout
jest.setTimeout(30000);

// Test cleanup
afterEach(() => {
  jest.clearAllMocks();
});

// Global test utilities
(global as any).testUtils = {
  generateTestEmail: () => `test${Date.now()}@example.com`,
  generateTestPassword: () => "TestPassword123",
  generateTestName: () => `Test User ${Date.now()}`,
};
