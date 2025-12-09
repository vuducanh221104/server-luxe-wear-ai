/**
 * @file ai.service.test.ts
 * @description Unit tests for AIService
 */

import { AIService } from "../../../src/services/ai.service";
import { GeminiApiIntegration } from "../../../src/integrations/gemini.api";

// Mock dependencies
jest.mock("../../../src/integrations/gemini.api", () => ({
  geminiApi: {
    generateContent: jest.fn(),
    countTokens: jest.fn(),
    healthCheck: jest.fn(),
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

jest.mock("../../../src/tools", () => ({
  functionCallingService: {
    chatWithTools: jest.fn(),
  },
}));

describe("AIService", () => {
  let aiService: AIService;
  let mockGeminiApi: jest.Mocked<GeminiApiIntegration>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockGeminiApi = {
      generateContent: jest.fn(),
      countTokens: jest.fn(),
      healthCheck: jest.fn(),
    } as unknown as jest.Mocked<GeminiApiIntegration>;

    aiService = new AIService(mockGeminiApi);
  });

  describe("generateResponse", () => {
    it("should generate response from stream", async () => {
      const chunks = ["Hello", " ", "World"];
      mockGeminiApi.generateContent = jest.fn().mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      });

      const result = await aiService.generateResponse("test message", "context", "prompt");

      expect(result).toBe("Hello World");
    });

    it("should handle empty response", async () => {
      mockGeminiApi.generateContent = jest.fn().mockImplementation(async function* () {
        // Empty generator
      });

      const result = await aiService.generateResponse("test", "", "prompt");

      expect(result).toBe("");
    });
  });

  describe("generateResponseStream", () => {
    it("should yield chunks from generator", async () => {
      const chunks = ["chunk1", "chunk2", "chunk3"];
      mockGeminiApi.generateContent = jest.fn().mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      });

      const result: string[] = [];
      for await (const chunk of aiService.generateResponseStream("test", "context")) {
        result.push(chunk);
      }

      expect(result).toEqual(chunks);
    });
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
      mockGeminiApi.countTokens = jest.fn().mockResolvedValue(50);

      const result = await serviceWithoutCache.countTokens("test text");

      expect(result).toBe(50);
    });

    it("should return 0 as fallback on error", async () => {
      const { getCachedTokenCount } = require("../../../src/utils/cache");
      getCachedTokenCount.mockRejectedValue(new Error("Cache error"));

      const result = await aiService.countTokens("test text");

      expect(result).toBe(0);
    });
  });

  describe("healthCheck", () => {
    it("should return health status with service stats", async () => {
      mockGeminiApi.healthCheck = jest.fn().mockResolvedValue({
        isHealthy: true,
        model: "gemini-pro",
      });

      const result = await aiService.healthCheck();

      expect(result.success).toBe(true);
      expect(result.serviceStats).toBeDefined();
      expect(result.serviceStats.requestCount).toBeDefined();
    });
  });

  describe("getStats", () => {
    it("should return service statistics", () => {
      const stats = aiService.getStats();

      expect(stats).toHaveProperty("requestCount");
      expect(stats).toHaveProperty("cacheStats");
      expect(stats).toHaveProperty("config");
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
  });

  describe("gemini getter", () => {
    it("should return gemini api instance", () => {
      const gemini = aiService.gemini;

      expect(gemini).toBe(mockGeminiApi);
    });
  });

  describe("analyzeSentiment", () => {
    it("should analyze text sentiment", async () => {
      const mockResponse = JSON.stringify({
        sentiment: "positive",
        confidence: 0.95,
        explanation: "The text expresses positive emotions",
      });

      mockGeminiApi.generateContent = jest.fn().mockImplementation(async function* () {
        yield mockResponse;
      });

      const result = await aiService.analyzeSentiment("I love this product!");

      expect(result.sentiment).toBe("positive");
      expect(result.confidence).toBe(0.95);
    });

    it("should throw error when parsing fails", async () => {
      mockGeminiApi.generateContent = jest.fn().mockImplementation(async function* () {
        yield "invalid json";
      });

      await expect(aiService.analyzeSentiment("test")).rejects.toThrow();
    });
  });

  describe("extractKeywords", () => {
    it("should extract keywords from text", async () => {
      mockGeminiApi.generateContent = jest.fn().mockImplementation(async function* () {
        yield "fashion, style, trend, clothing, design";
      });

      const result = await aiService.extractKeywords("Fashion trends for 2024", 5);

      expect(result).toContain("fashion");
      expect(result).toContain("style");
      expect(result.length).toBeLessThanOrEqual(5);
    });

    it("should return empty array for non-string response", async () => {
      mockGeminiApi.generateContent = jest.fn().mockImplementation(async function* () {
        // Empty response
      });

      const result = await aiService.extractKeywords("test");

      expect(result).toEqual([]);
    });
  });

  describe("summarizeText", () => {
    it("should summarize text", async () => {
      const summary = "This is a summary.";
      mockGeminiApi.generateContent = jest.fn().mockImplementation(async function* () {
        yield summary;
      });

      const result = await aiService.summarizeText("Long text to summarize...", 200);

      expect(result).toBe(summary);
    });
  });

  describe("translateText", () => {
    it("should translate text to target language", async () => {
      const translation = "Bonjour le monde";
      mockGeminiApi.generateContent = jest.fn().mockImplementation(async function* () {
        yield translation;
      });

      const result = await aiService.translateText("Hello world", "French");

      expect(result).toBe(translation);
    });
  });

  describe("generateResponseWithTools", () => {
    it("should generate response with function calling", async () => {
      const { functionCallingService } = require("../../../src/tools");
      functionCallingService.chatWithTools.mockResolvedValue({
        response: "AI response",
        toolsCalled: ["search_knowledge"],
        toolResults: [],
        executionTime: 100,
      });

      const context = {
        agentId: "agent-1",
        tenantId: "tenant-1",
        userId: "user-1",
      };

      const result = await aiService.generateResponseWithTools(
        "Search my knowledge base",
        context,
        "You are helpful",
        ["search_knowledge"]
      );

      expect(result.response).toBe("AI response");
      expect(result.toolsCalled).toContain("search_knowledge");
    });
  });
});
