/**
 * @file ai.service.test.ts
 * @description Unit tests for AIService
 */

import { AIService } from "../../../src/services/ai.service";
import { GeminiApiIntegration } from "../../../src/integrations/gemini.api";

// Mock dependencies
jest.mock("../../../src/integrations/gemini.api", () => ({
  geminiApi: {
    countTokens: jest.fn(),
    healthCheck: jest.fn(),
    streamGenerateRAGResponse: jest.fn(),
  },
  GeminiApiIntegration: jest.fn(),
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../../src/utils/cache", () => ({
  getCachedTokenCount: jest.fn(),
  getCacheStats: jest.fn(() => ({
    hits: 0,
    misses: 0,
    size: 0,
  })),
  clearCacheByPattern: jest.fn(() => 0),
}));

describe("AIService", () => {
  let aiService: AIService;
  let mockGeminiApi: jest.Mocked<GeminiApiIntegration>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGeminiApi = {
      countTokens: jest.fn(),
      healthCheck: jest.fn(),
      streamGenerateRAGResponse: jest.fn(),
    } as unknown as jest.Mocked<GeminiApiIntegration>;

    aiService = new AIService(mockGeminiApi);
  });

  describe("countTokens", () => {
    it("should count tokens with caching enabled", async () => {
      const { getCachedTokenCount } = require("../../../src/utils/cache");
      getCachedTokenCount.mockResolvedValue(100);

      const result = await aiService.countTokens("test text");

      expect(result).toBe(100);
      expect(getCachedTokenCount).toHaveBeenCalled();
    });

    it("should count tokens without caching", async () => {
      const serviceWithoutCache = new AIService(mockGeminiApi, { enableCaching: false });
      mockGeminiApi.countTokens = jest.fn().mockResolvedValue({ success: true, data: 50 });

      const result = await serviceWithoutCache.countTokens("test text");

      expect(result).toBe(50);
    });

    it("should return 0 as fallback on error", async () => {
      const { getCachedTokenCount } = require("../../../src/utils/cache");
      getCachedTokenCount.mockRejectedValue(new Error("Cache error"));

      const result = await aiService.countTokens("test text");

      expect(result).toBe(0);
    });

    it("should pass userId for logging", async () => {
      const { getCachedTokenCount } = require("../../../src/utils/cache");
      getCachedTokenCount.mockResolvedValue(75);

      const result = await aiService.countTokens("test text", "user-123");

      expect(result).toBe(75);
    });
  });

  describe("healthCheck", () => {
    it("should return health status with service stats", async () => {
      mockGeminiApi.healthCheck = jest.fn().mockResolvedValue({
        success: true,
        isHealthy: true,
        model: "gemini-pro",
      });

      const result = await aiService.healthCheck();

      expect(result.success).toBe(true);
      expect(result.serviceStats).toBeDefined();
      expect(result.serviceStats.requestCount).toBeDefined();
    });

    it("should include cache stats in health check", async () => {
      mockGeminiApi.healthCheck = jest.fn().mockResolvedValue({
        success: true,
        isHealthy: true,
      });

      const result = await aiService.healthCheck();

      expect(result.serviceStats.cacheStats).toBeDefined();
    });
  });

  describe("getStats", () => {
    it("should return service statistics", () => {
      const stats = aiService.getStats();

      expect(stats).toHaveProperty("requestCount");
      expect(stats).toHaveProperty("cacheStats");
      expect(stats).toHaveProperty("config");
    });

    it("should track request count", () => {
      const initialStats = aiService.getStats();
      expect(initialStats.requestCount).toBe(0);
    });
  });

  describe("clearCache", () => {
    it("should clear all AI-related cache", () => {
      const { clearCacheByPattern } = require("../../../src/utils/cache");

      aiService.clearCache();

      expect(clearCacheByPattern).toHaveBeenCalledWith("embedding:");
      expect(clearCacheByPattern).toHaveBeenCalledWith("ai_response:");
      expect(clearCacheByPattern).toHaveBeenCalledWith("tokens:");
    });
  });

  describe("updateConfig", () => {
    it("should update service configuration", () => {
      aiService.updateConfig({ maxRetries: 5 });

      const config = aiService.getConfig();
      expect(config.maxRetries).toBe(5);
    });

    it("should preserve existing config values", () => {
      const originalConfig = aiService.getConfig();
      aiService.updateConfig({ timeout: 60000 });

      const newConfig = aiService.getConfig();
      expect(newConfig.enableCaching).toBe(originalConfig.enableCaching);
      expect(newConfig.timeout).toBe(60000);
    });

    it("should update multiple config values", () => {
      aiService.updateConfig({ maxRetries: 5, timeout: 45000 });

      const config = aiService.getConfig();
      expect(config.maxRetries).toBe(5);
      expect(config.timeout).toBe(45000);
    });
  });

  describe("getConfig", () => {
    it("should return current configuration", () => {
      const config = aiService.getConfig();

      expect(config).toHaveProperty("enableCaching");
      expect(config).toHaveProperty("defaultSystemPrompt");
      expect(config).toHaveProperty("maxRetries");
      expect(config).toHaveProperty("timeout");
    });

    it("should return a copy of config (immutable)", () => {
      const config1 = aiService.getConfig();
      const config2 = aiService.getConfig();

      expect(config1).not.toBe(config2);
      expect(config1).toEqual(config2);
    });

    it("should have default values", () => {
      const config = aiService.getConfig();

      expect(config.enableCaching).toBe(true);
      expect(config.maxRetries).toBe(3);
      expect(config.timeout).toBe(30000);
    });
  });

  describe("gemini getter", () => {
    it("should return gemini api instance", () => {
      const gemini = aiService.gemini;

      expect(gemini).toBe(mockGeminiApi);
    });
  });

  describe("streamGenerateResponse", () => {
    it("should stream response chunks", async () => {
      const chunks = ["Hello", " ", "World"];
      mockGeminiApi.streamGenerateRAGResponse = jest.fn().mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      });

      const result: string[] = [];
      for await (const chunk of aiService.streamGenerateResponse(
        "test message",
        "context",
        "system prompt"
      )) {
        result.push(chunk);
      }

      expect(result).toEqual(chunks);
    });

    it("should increment request count", async () => {
      mockGeminiApi.streamGenerateRAGResponse = jest.fn().mockImplementation(async function* () {
        yield "chunk";
      });

      const initialCount = aiService.getStats().requestCount;

      for await (const _ of aiService.streamGenerateResponse("test", "context")) {
        // consume
      }

      const newCount = aiService.getStats().requestCount;
      expect(newCount).toBe(initialCount + 1);
    });

    it("should use default system prompt when not provided", async () => {
      mockGeminiApi.streamGenerateRAGResponse = jest.fn().mockImplementation(async function* () {
        yield "response";
      });

      for await (const _ of aiService.streamGenerateResponse("test", "context")) {
        // consume
      }

      expect(mockGeminiApi.streamGenerateRAGResponse).toHaveBeenCalledWith(
        "test",
        "context",
        "You are a helpful fashion AI assistant."
      );
    });

    it("should handle empty response", async () => {
      mockGeminiApi.streamGenerateRAGResponse = jest.fn().mockImplementation(async function* () {
        // Empty generator
      });

      const result: string[] = [];
      for await (const chunk of aiService.streamGenerateResponse("test", "context")) {
        result.push(chunk);
      }

      expect(result).toEqual([]);
    });

    it("should pass userId for logging", async () => {
      mockGeminiApi.streamGenerateRAGResponse = jest.fn().mockImplementation(async function* () {
        yield "chunk";
      });

      for await (const _ of aiService.streamGenerateResponse(
        "test",
        "context",
        "prompt",
        "user-123"
      )) {
        // consume
      }

      expect(mockGeminiApi.streamGenerateRAGResponse).toHaveBeenCalled();
    });
  });

  describe("constructor", () => {
    it("should use default gemini instance when not provided", () => {
      // This tests the fallback to singleton
      const service = new AIService();
      expect(service.gemini).toBeDefined();
    });

    it("should apply custom config", () => {
      const customConfig = {
        enableCaching: false,
        maxRetries: 5,
        timeout: 60000,
      };

      const service = new AIService(mockGeminiApi, customConfig);
      const config = service.getConfig();

      expect(config.enableCaching).toBe(false);
      expect(config.maxRetries).toBe(5);
      expect(config.timeout).toBe(60000);
    });
  });
});
