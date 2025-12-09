/**
 * @file response.test.ts
 * @description Unit tests for response utilities
 */

import { Response } from "express";
import { successResponse, errorResponse } from "../../../src/utils/response";

describe("Response Utilities", () => {
  let mockRes: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn().mockReturnThis();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockRes = {
      status: mockStatus,
      json: mockJson,
    };
  });

  describe("successResponse", () => {
    it("should return success response with default values", () => {
      const data = { id: 1, name: "Test" };

      successResponse(mockRes as Response, data);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Success",
          data,
          timestamp: expect.any(String),
        })
      );
    });

    it("should return success response with custom message", () => {
      const data = { id: 1 };
      const message = "Created successfully";

      successResponse(mockRes as Response, data, message);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Created successfully",
          data,
        })
      );
    });

    it("should return success response with custom status code", () => {
      const data = { id: 1 };

      successResponse(mockRes as Response, data, "Created", 201);

      expect(mockStatus).toHaveBeenCalledWith(201);
    });

    it("should handle null data", () => {
      successResponse(mockRes as Response, null);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: null,
        })
      );
    });

    it("should handle array data", () => {
      const data = [{ id: 1 }, { id: 2 }];

      successResponse(mockRes as Response, data);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          data: [{ id: 1 }, { id: 2 }],
        })
      );
    });

    it("should include ISO timestamp", () => {
      const beforeTime = new Date().toISOString();
      successResponse(mockRes as Response, {});
      const afterTime = new Date().toISOString();

      const call = mockJson.mock.calls[0][0];
      const timestamp = call.timestamp;

      expect(timestamp >= beforeTime).toBe(true);
      expect(timestamp <= afterTime).toBe(true);
    });
  });

  describe("errorResponse", () => {
    it("should return error response with default values", () => {
      errorResponse(mockRes as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "An error occurred",
          timestamp: expect.any(String),
        })
      );
    });

    it("should return error response with custom message", () => {
      errorResponse(mockRes as Response, "User not found");

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User not found",
        })
      );
    });

    it("should return error response with custom status code", () => {
      errorResponse(mockRes as Response, "Not found", 404);

      expect(mockStatus).toHaveBeenCalledWith(404);
    });

    it("should include errors array when provided", () => {
      const errors = [
        { field: "email", message: "Invalid email" },
        { field: "password", message: "Too short" },
      ];

      errorResponse(mockRes as Response, "Validation failed", 400, errors);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Validation failed",
          errors,
        })
      );
    });

    it("should not include errors key when not provided", () => {
      errorResponse(mockRes as Response, "Error", 500);

      const call = mockJson.mock.calls[0][0];
      expect(call).not.toHaveProperty("errors");
    });

    it("should handle empty errors array", () => {
      errorResponse(mockRes as Response, "Error", 500, []);

      expect(mockJson).toHaveBeenCalledWith(
        expect.objectContaining({
          errors: [],
        })
      );
    });

    it("should return correct status codes for common errors", () => {
      // 400 Bad Request
      errorResponse(mockRes as Response, "Bad request", 400);
      expect(mockStatus).toHaveBeenCalledWith(400);

      // 401 Unauthorized
      errorResponse(mockRes as Response, "Unauthorized", 401);
      expect(mockStatus).toHaveBeenCalledWith(401);

      // 403 Forbidden
      errorResponse(mockRes as Response, "Forbidden", 403);
      expect(mockStatus).toHaveBeenCalledWith(403);

      // 404 Not Found
      errorResponse(mockRes as Response, "Not found", 404);
      expect(mockStatus).toHaveBeenCalledWith(404);

      // 409 Conflict
      errorResponse(mockRes as Response, "Conflict", 409);
      expect(mockStatus).toHaveBeenCalledWith(409);

      // 429 Too Many Requests
      errorResponse(mockRes as Response, "Rate limited", 429);
      expect(mockStatus).toHaveBeenCalledWith(429);
    });
  });
});
