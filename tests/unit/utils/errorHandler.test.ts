/**
 * @file errorHandler.test.ts
 * @description Unit tests for error handling utilities
 */

import {
  handleAsyncOperation,
  handleAsyncOperationStrict,
  handleAsyncOperationWithFallback,
  handleVoidOperation,
  handleAsyncOperationWithRetry,
  handleBatchOperations,
} from "../../../src/utils/errorHandler";

// Mock logger
jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe("Error Handler Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleAsyncOperation", () => {
    it("should return result when operation succeeds", async () => {
      const operation = jest.fn().mockResolvedValue("success");
      const result = await handleAsyncOperation(operation, "test operation");

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should return fallback value when operation fails and fallback provided", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));
      const result = await handleAsyncOperation(operation, "test operation", "fallback");

      expect(result).toBe("fallback");
    });

    it("should throw error when operation fails and no fallback provided", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));

      await expect(handleAsyncOperation(operation, "test operation")).rejects.toThrow(
        "Failed to test operation"
      );
    });

    it("should not throw when shouldThrow is false", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));
      const result = await handleAsyncOperation(operation, "test operation", undefined, {
        shouldThrow: false,
      });

      expect(result).toBeUndefined();
    });

    it("should not log when shouldLog is false", async () => {
      const { error } = require("../../../src/config/logger");
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));

      await handleAsyncOperation(operation, "test operation", "fallback", {
        shouldLog: false,
      });

      expect(error).not.toHaveBeenCalled();
    });

    it("should include custom context in error logs", async () => {
      const { error } = require("../../../src/config/logger");
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));

      await handleAsyncOperation(operation, "test operation", "fallback", {
        context: { userId: "123", action: "test" },
      });

      expect(error).toHaveBeenCalledWith("Failed to test operation", {
        error: "Test error",
        operation: "test operation",
        userId: "123",
        action: "test",
      });
    });
  });

  describe("handleAsyncOperationStrict", () => {
    it("should always throw on failure", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));

      await expect(handleAsyncOperationStrict(operation, "test operation")).rejects.toThrow(
        "Failed to test operation"
      );
    });

    it("should return result when operation succeeds", async () => {
      const operation = jest.fn().mockResolvedValue("success");
      const result = await handleAsyncOperationStrict(operation, "test operation");

      expect(result).toBe("success");
    });
  });

  describe("handleAsyncOperationWithFallback", () => {
    it("should return fallback value on failure", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));
      const result = await handleAsyncOperationWithFallback(
        operation,
        "test operation",
        "fallback"
      );

      expect(result).toBe("fallback");
    });

    it("should return result when operation succeeds", async () => {
      const operation = jest.fn().mockResolvedValue("success");
      const result = await handleAsyncOperationWithFallback(
        operation,
        "test operation",
        "fallback"
      );

      expect(result).toBe("success");
    });
  });

  describe("handleVoidOperation", () => {
    it("should complete successfully for void operations", async () => {
      const operation = jest.fn().mockResolvedValue(undefined);

      await expect(handleVoidOperation(operation, "test operation")).resolves.toBeUndefined();
    });

    it("should throw error for failed void operations", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));

      await expect(handleVoidOperation(operation, "test operation")).rejects.toThrow(
        "Failed to test operation"
      );
    });
  });

  describe("handleAsyncOperationWithRetry", () => {
    it("should succeed on first attempt", async () => {
      const operation = jest.fn().mockResolvedValue("success");
      const result = await handleAsyncOperationWithRetry(operation, "test operation", 3, 100);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and eventually succeed", async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error("First attempt"))
        .mockRejectedValueOnce(new Error("Second attempt"))
        .mockResolvedValue("success");

      const result = await handleAsyncOperationWithRetry(operation, "test operation", 3, 10);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should fail after max retries", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));

      await expect(
        handleAsyncOperationWithRetry(operation, "test operation", 2, 10)
      ).rejects.toThrow("Failed to test operation after 3 attempts");

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should use exponential backoff", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));
      const setTimeoutSpy = jest.spyOn(global, "setTimeout");

      await expect(
        handleAsyncOperationWithRetry(operation, "test operation", 2, 100)
      ).rejects.toThrow();

      // Check that setTimeout was called with exponential delays
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 100); // First retry
      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 200); // Second retry

      setTimeoutSpy.mockRestore();
    });
  });

  describe("handleBatchOperations", () => {
    it("should execute all operations and return successful results", async () => {
      const operations = [
        jest.fn().mockResolvedValue("result1"),
        jest.fn().mockResolvedValue("result2"),
        jest.fn().mockResolvedValue("result3"),
      ];

      const results = await handleBatchOperations(operations, "batch test");

      expect(results).toEqual(["result1", "result2", "result3"]);
      operations.forEach((op) => expect(op).toHaveBeenCalledTimes(1));
    });

    it("should continue executing even if some operations fail", async () => {
      const operations = [
        jest.fn().mockResolvedValue("result1"),
        jest.fn().mockRejectedValue(new Error("Operation 2 failed")),
        jest.fn().mockResolvedValue("result3"),
      ];

      const results = await handleBatchOperations(operations, "batch test");

      expect(results).toEqual(["result1", "result3"]);
      operations.forEach((op) => expect(op).toHaveBeenCalledTimes(1));
    });

    it("should log batch completion with failure count", async () => {
      const { error } = require("../../../src/config/logger");
      const operations = [
        jest.fn().mockResolvedValue("result1"),
        jest.fn().mockRejectedValue(new Error("Operation 2 failed")),
        jest.fn().mockRejectedValue(new Error("Operation 3 failed")),
      ];

      await handleBatchOperations(operations, "batch test");

      expect(error).toHaveBeenCalledWith("Batch batch test completed with 2 failures", {
        totalOperations: 3,
        successfulOperations: 1,
        failedOperations: 2,
      });
    });

    it("should handle empty operations array", async () => {
      const results = await handleBatchOperations([], "empty batch");

      expect(results).toEqual([]);
    });
  });
});
