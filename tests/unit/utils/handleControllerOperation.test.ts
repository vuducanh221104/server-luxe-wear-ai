/**
 * @file handleControllerOperation.test.ts
 * @description Unit tests for handleControllerOperation utility
 */

import { Response } from "express";
import { handleControllerOperation } from "../../../src/utils/errorHandler";

// Mock logger
jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe("handleControllerOperation", () => {
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockRes = {
      status: mockStatus,
      json: mockJson,
    };
  });

  describe("successful operations", () => {
    it("should return result when operation succeeds", async () => {
      const expectedResult = { success: true, data: "test" };
      const operation = jest.fn().mockResolvedValue(expectedResult);

      const result = await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(result).toEqual(expectedResult);
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockStatus).not.toHaveBeenCalled();
    });

    it("should handle async operations correctly", async () => {
      const operation = jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "delayed result";
      });

      const result = await handleControllerOperation(
        operation,
        "async operation",
        mockRes as Response
      );

      expect(result).toBe("delayed result");
    });
  });

  describe("error handling", () => {
    it("should return 500 error for generic errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Something went wrong"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Something went wrong",
        })
      );
    });

    it("should return 404 for not found errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("User not found"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(404);
    });

    it("should return 409 for already exists errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("User already exists"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(409);
    });

    it("should return 409 for duplicate errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Duplicate entry"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(409);
    });

    it("should return 400 for invalid errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Invalid email format"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it("should return 400 for validation errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Validation failed"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(400);
    });

    it("should return 401 for unauthorized errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Unauthorized access"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    it("should return 401 for authentication errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Authentication required"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(401);
    });

    it("should return 403 for forbidden errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Forbidden resource"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(403);
    });

    it("should return 403 for permission errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Permission denied"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(403);
    });

    it("should return 429 for rate limit errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Rate limit exceeded"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(429);
    });

    it("should return 429 for too many requests errors", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Too many requests"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(429);
    });

    it("should handle non-Error objects", async () => {
      const operation = jest.fn().mockRejectedValue("string error");

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "An unexpected error occurred",
        })
      );
    });
  });

  describe("logging", () => {
    it("should log errors by default", async () => {
      const { error } = require("../../../src/config/logger");
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(error).toHaveBeenCalled();
    });

    it("should not log when shouldLog is false", async () => {
      const { error } = require("../../../src/config/logger");
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response,
        { shouldLog: false }
      );

      expect(error).not.toHaveBeenCalled();
    });

    it("should include context in error logs", async () => {
      const { error } = require("../../../src/config/logger");
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response,
        { context: { userId: "123", action: "test" } }
      );

      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("test operation"),
        expect.objectContaining({
          userId: "123",
          action: "test",
        })
      );
    });
  });

  describe("response format", () => {
    it("should include timestamp in error response", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String),
        })
      );
    });

    it("should format timestamp as ISO string", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("Test error"));

      await handleControllerOperation(
        operation,
        "test operation",
        mockRes as Response
      );

      const call = mockJson.mock.calls[0][0];
      expect(() => new Date(call.timestamp).toISOString()).not.toThrow();
    });
  });
});
