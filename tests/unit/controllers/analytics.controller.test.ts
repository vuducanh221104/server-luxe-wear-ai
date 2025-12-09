/**
 * @file analytics.controller.test.ts
 * @description Unit tests for analytics controller
 */

// Mock external dependencies before imports
const mockGetUserAnalytics = jest.fn();
const mockGetTenantAnalytics = jest.fn();
const mockGetAgentAnalytics = jest.fn();
const mockLogAnalytics = jest.fn();

jest.mock("../../../src/services/analytics.service", () => ({
  __esModule: true,
  default: {
    getUserAnalytics: (...args: unknown[]) => mockGetUserAnalytics(...args),
    getTenantAnalytics: (...args: unknown[]) => mockGetTenantAnalytics(...args),
    getAgentAnalytics: (...args: unknown[]) => mockGetAgentAnalytics(...args),
    logAnalytics: (...args: unknown[]) => mockLogAnalytics(...args),
  },
  AnalyticsService: jest.fn().mockImplementation(() => ({
    getUserAnalytics: mockGetUserAnalytics,
    getTenantAnalytics: mockGetTenantAnalytics,
    getAgentAnalytics: mockGetAgentAnalytics,
    logAnalytics: mockLogAnalytics,
  })),
}));

jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("express-validator", () => ({
  validationResult: jest.fn().mockReturnValue({
    isEmpty: () => true,
    array: () => [],
  }),
}));

// Import after mocks
import { Request, Response } from "express";
import { AnalyticsController } from "../../../src/controllers/analytics.controller";
import { validationResult } from "express-validator";

describe("AnalyticsController", () => {
  let analyticsController: AnalyticsController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    analyticsController = new AnalyticsController();

    jsonMock = jest.fn().mockReturnThis();
    statusMock = jest.fn().mockReturnThis();

    mockResponse = {
      json: jsonMock,
      status: statusMock,
    };

    mockRequest = {
      user: {
        id: "user-123",
        email: "test@example.com",
        name: "Test User",
        role: "member",
        is_active: true,
        email_verified: true,
        password_hash: "hash",
        avatar_url: null,
        phone: null,
        website: null,
        preferences: {},
        last_login: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      tenant: {
        id: "tenant-123",
        name: "Test Tenant",
        plan: "free",
        status: "active",
        role: "owner",
      },
      query: {},
      params: {},
    };
  });

  describe("getUserAnalytics", () => {
    it("should return user analytics successfully", async () => {
      const mockAnalytics = {
        totalQueries: 10,
        uniqueAgents: 3,
        avgResponseLength: 150,
        period: "30d",
        recentQueries: [],
      };

      mockGetUserAnalytics.mockResolvedValueOnce(mockAnalytics);

      await analyticsController.getUserAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockGetUserAnalytics).toHaveBeenCalledWith("user-123", "tenant-123", "30d");
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockAnalytics,
        })
      );
    });

    it("should use custom period from query", async () => {
      mockRequest.query = { period: "7d" };
      mockGetUserAnalytics.mockResolvedValueOnce({ totalQueries: 5 });

      await analyticsController.getUserAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockGetUserAnalytics).toHaveBeenCalledWith("user-123", "tenant-123", "7d");
    });

    it("should return error when user not authenticated", async () => {
      mockRequest.user = undefined;

      await analyticsController.getUserAnalytics(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "User not authenticated",
        })
      );
    });

    it("should return error when tenant context missing", async () => {
      mockRequest.tenant = undefined;

      await analyticsController.getUserAnalytics(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: "Tenant context not found",
        })
      );
    });

    it("should return validation error when validation fails", async () => {
      (validationResult as unknown as jest.Mock).mockReturnValueOnce({
        isEmpty: () => false,
        array: () => [{ msg: "Invalid period" }],
      });

      await analyticsController.getUserAnalytics(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("getTenantAnalytics", () => {
    it("should return tenant analytics successfully", async () => {
      const mockAnalytics = {
        tenantId: "tenant-123",
        totalQueries: 100,
        uniqueUsers: 5,
        uniqueAgents: 10,
        avgResponseLength: 200,
        period: "30d",
        dailyStats: {},
        topAgents: [],
        recentQueries: [],
      };

      mockGetTenantAnalytics.mockResolvedValueOnce(mockAnalytics);

      await analyticsController.getTenantAnalytics(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockGetTenantAnalytics).toHaveBeenCalledWith(
        "tenant-123",
        "30d",
        undefined,
        undefined
      );
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should support custom date range", async () => {
      mockRequest.query = {
        startDate: "2024-01-01",
        endDate: "2024-01-31",
      };

      mockGetTenantAnalytics.mockResolvedValueOnce({ totalQueries: 50 });

      await analyticsController.getTenantAnalytics(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockGetTenantAnalytics).toHaveBeenCalledWith(
        "tenant-123",
        "30d",
        "2024-01-01",
        "2024-01-31"
      );
    });

    it("should return error when user not authenticated", async () => {
      mockRequest.user = undefined;

      await analyticsController.getTenantAnalytics(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe("getAgentAnalytics", () => {
    it("should return agent analytics successfully", async () => {
      mockRequest.params = { agentId: "agent-123" };

      const mockAnalytics = {
        agentId: "agent-123",
        totalQueries: 25,
        avgResponseLength: 180,
        recentQueries: [],
      };

      mockGetAgentAnalytics.mockResolvedValueOnce(mockAnalytics);

      await analyticsController.getAgentAnalytics(mockRequest as Request, mockResponse as Response);

      expect(mockGetAgentAnalytics).toHaveBeenCalledWith("agent-123", "user-123", "tenant-123");
      expect(statusMock).toHaveBeenCalledWith(200);
    });

    it("should return error when user not authenticated", async () => {
      mockRequest.user = undefined;
      mockRequest.params = { agentId: "agent-123" };

      await analyticsController.getAgentAnalytics(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it("should return error when tenant context missing", async () => {
      mockRequest.tenant = undefined;
      mockRequest.params = { agentId: "agent-123" };

      await analyticsController.getAgentAnalytics(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });
  });

  describe("error handling", () => {
    it("should handle validation errors correctly", async () => {
      (validationResult as unknown as jest.Mock).mockReturnValueOnce({
        isEmpty: () => false,
        array: () => [{ msg: "Invalid agent ID" }],
      });

      mockRequest.params = { agentId: "agent-123" };

      await analyticsController.getAgentAnalytics(mockRequest as Request, mockResponse as Response);

      expect(statusMock).toHaveBeenCalledWith(400);
    });

    it("should return proper error structure", async () => {
      mockRequest.user = undefined;

      await analyticsController.getUserAnalytics(mockRequest as Request, mockResponse as Response);

      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          message: expect.any(String),
          timestamp: expect.any(String),
        })
      );
    });
  });
});
