/**
 * @file analytics.service.test.ts
 * @description Unit tests for analytics service
 */

// Track all query results
let queryResults: { data: unknown; error: unknown } = { data: [], error: null };

jest.mock("../../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn().mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockImplementation(() => Promise.resolve(queryResults)),
    })),
  },
}));

jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

// Import after mocks
import { AnalyticsService } from "../../../src/services/analytics.service";

describe("AnalyticsService", () => {
  let analyticsService: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    analyticsService = new AnalyticsService();
    // Reset query results
    queryResults = { data: [], error: null };
  });

  describe("getUserAnalytics", () => {
    it("should return user analytics with empty data", async () => {
      queryResults = { data: [], error: null };

      const result = await analyticsService.getUserAnalytics("user-123", "tenant-123", "30d");

      expect(result).toHaveProperty("totalQueries");
      expect(result).toHaveProperty("uniqueAgents");
      expect(result).toHaveProperty("avgResponseLength");
      expect(result).toHaveProperty("period");
      expect(result).toHaveProperty("recentQueries");
      expect(result.totalQueries).toBe(0);
      expect(result.period).toBe("30d");
    });

    it("should calculate analytics from data", async () => {
      queryResults = {
        data: [
          {
            id: "1",
            user_id: "user-123",
            tenant_id: "tenant-123",
            agent_id: "agent-1",
            query: "test query 1",
            response: "test response 1",
            created_at: new Date().toISOString(),
          },
          {
            id: "2",
            user_id: "user-123",
            tenant_id: "tenant-123",
            agent_id: "agent-2",
            query: "test query 2",
            response: "test response 2",
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      };

      const result = await analyticsService.getUserAnalytics("user-123", "tenant-123", "30d");

      expect(result.totalQueries).toBe(2);
      expect(result.uniqueAgents).toBe(2);
      expect(result.avgResponseLength).toBeGreaterThan(0);
    });

    it("should handle different periods", async () => {
      const periods = ["7d", "30d", "90d"];

      for (const period of periods) {
        queryResults = { data: [], error: null };
        const result = await analyticsService.getUserAnalytics("user-123", "tenant-123", period);
        expect(result.period).toBe(period);
      }
    });
  });

  describe("getTenantAnalytics", () => {
    it("should return tenant analytics", async () => {
      queryResults = { data: [], error: null };

      const result = await analyticsService.getTenantAnalytics("tenant-123", "30d");

      expect(result).toHaveProperty("tenantId");
      expect(result).toHaveProperty("totalQueries");
      expect(result).toHaveProperty("uniqueUsers");
      expect(result).toHaveProperty("uniqueAgents");
      expect(result).toHaveProperty("dailyStats");
      expect(result).toHaveProperty("topAgents");
      expect(result.tenantId).toBe("tenant-123");
    });

    it("should calculate daily stats correctly", async () => {
      const today = new Date().toISOString();
      const yesterday = new Date(Date.now() - 86400000).toISOString();

      queryResults = {
        data: [
          { id: "1", user_id: "user-1", agent_id: "agent-1", response: "resp", created_at: today },
          { id: "2", user_id: "user-1", agent_id: "agent-1", response: "resp", created_at: today },
          {
            id: "3",
            user_id: "user-2",
            agent_id: "agent-2",
            response: "resp",
            created_at: yesterday,
          },
        ],
        error: null,
      };

      const result = await analyticsService.getTenantAnalytics("tenant-123", "30d");

      expect(result.totalQueries).toBe(3);
      expect(result.uniqueUsers).toBe(2);
      expect(result.uniqueAgents).toBe(2);
      expect(Object.keys(result.dailyStats).length).toBeGreaterThan(0);
    });

    it("should support custom date range", async () => {
      queryResults = { data: [], error: null };

      const result = await analyticsService.getTenantAnalytics(
        "tenant-123",
        undefined,
        "2024-01-01",
        "2024-01-31"
      );

      expect(result.period).toBe("custom");
    });

    it("should return top agents", async () => {
      queryResults = {
        data: [
          {
            id: "1",
            agent_id: "agent-1",
            user_id: "u1",
            response: "r",
            created_at: new Date().toISOString(),
          },
          {
            id: "2",
            agent_id: "agent-1",
            user_id: "u1",
            response: "r",
            created_at: new Date().toISOString(),
          },
          {
            id: "3",
            agent_id: "agent-1",
            user_id: "u1",
            response: "r",
            created_at: new Date().toISOString(),
          },
          {
            id: "4",
            agent_id: "agent-2",
            user_id: "u1",
            response: "r",
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      };

      const result = await analyticsService.getTenantAnalytics("tenant-123", "30d");

      expect(result.topAgents.length).toBeGreaterThan(0);
      expect(result.topAgents[0].agentId).toBe("agent-1");
      expect(result.topAgents[0].count).toBe(3);
    });
  });

  describe("getAgentAnalytics", () => {
    it("should return agent analytics", async () => {
      queryResults = { data: [], error: null };

      const result = await analyticsService.getAgentAnalytics(
        "agent-123",
        "user-123",
        "tenant-123"
      );

      expect(result).toHaveProperty("agentId");
      expect(result).toHaveProperty("totalQueries");
      expect(result).toHaveProperty("avgResponseLength");
      expect(result).toHaveProperty("recentQueries");
      expect(result.agentId).toBe("agent-123");
    });

    it("should calculate agent-specific metrics", async () => {
      queryResults = {
        data: [
          {
            id: "1",
            agent_id: "agent-123",
            user_id: "user-123",
            tenant_id: "tenant-123",
            query: "query",
            response: "This is a longer response for testing",
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      };

      const result = await analyticsService.getAgentAnalytics(
        "agent-123",
        "user-123",
        "tenant-123"
      );

      expect(result.totalQueries).toBe(1);
      expect(result.avgResponseLength).toBeGreaterThan(0);
      expect(result.recentQueries.length).toBe(1);
    });
  });

  describe("error handling", () => {
    it("should throw error when database query fails", async () => {
      queryResults = { data: null, error: { message: "Database error" } };

      await expect(
        analyticsService.getUserAnalytics("user-123", "tenant-123", "30d")
      ).rejects.toThrow("Database error");
    });
  });

  describe("helper methods", () => {
    it("should handle empty analytics array for calculations", async () => {
      queryResults = { data: [], error: null };

      const result = await analyticsService.getUserAnalytics("user-123", "tenant-123", "30d");

      expect(result.avgResponseLength).toBe(0);
      expect(result.recentQueries).toEqual([]);
    });

    it("should handle null response in analytics", async () => {
      queryResults = {
        data: [
          {
            id: "1",
            agent_id: "agent-1",
            user_id: "user-123",
            tenant_id: "tenant-123",
            query: "query",
            response: null,
            created_at: new Date().toISOString(),
          },
        ],
        error: null,
      };

      const result = await analyticsService.getUserAnalytics("user-123", "tenant-123", "30d");

      expect(result.avgResponseLength).toBe(0);
    });
  });
});
