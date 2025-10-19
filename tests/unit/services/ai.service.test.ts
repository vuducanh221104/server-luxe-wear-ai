/**
 * @file ai.service.test.ts
 * @description Unit tests for AIService class
 */

// Mock environment variables before importing
process.env.GEMINI_API_KEY = "test-api-key";

import { AIService, defaultAIService } from "../../../src/config/ai";
import { geminiApi } from "../../../src/integrations/gemini.api";

// Mock the Gemini API
jest.mock("../../../src/integrations/gemini.api", () => ({
  geminiApi: {
    generateEmbeddings: jest.fn(),
    generateRAGResponse: jest.fn(),
    countTokens: jest.fn(),
    healthCheck: jest.fn(),
  },
}));

describe("AIService", () => {
  let aiService: AIService;

  beforeEach(() => {
    aiService = new AIService();
    jest.clearAllMocks();
  });

  describe("generateEmbedding", () => {
    it("should generate embedding successfully", async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (geminiApi.generateEmbeddings as jest.Mock).mockResolvedValue({
        success: true,
        data: mockEmbedding,
      });

      const result = await aiService.generateEmbedding("test text");

      expect(result).toEqual(mockEmbedding);
      expect(geminiApi.generateEmbeddings).toHaveBeenCalledWith("test text");
    });

    it("should throw error when generation fails", async () => {
      (geminiApi.generateEmbeddings as jest.Mock).mockResolvedValue({
        success: false,
        error: "API error",
      });

      // Mock cache to return undefined to force API call
      jest
        .spyOn(require("../../../src/utils/cache"), "getCachedEmbedding")
        .mockImplementation(async (...args: unknown[]) => {
          const [text, generateFn] = args as [string, (text: string) => Promise<number[]>];
          return await generateFn(text);
        });

      await expect(aiService.generateEmbedding("test text")).rejects.toThrow(
        "Failed to generate text embedding"
      );
    });
  });

  describe("generateResponse", () => {
    it("should generate response successfully", async () => {
      const mockResponse = "Test response";
      (geminiApi.generateRAGResponse as jest.Mock).mockResolvedValue({
        success: true,
        data: { response: mockResponse },
      });

      const result = await aiService.generateResponse("test message", "test context");

      expect(result).toBe(mockResponse);
      expect(geminiApi.generateRAGResponse).toHaveBeenCalledWith(
        "test message",
        "test context",
        "You are a helpful fashion AI assistant.",
        { includeMetadata: true }
      );
    });

    it("should use custom system prompt", async () => {
      const mockResponse = "Test response";
      (geminiApi.generateRAGResponse as jest.Mock).mockResolvedValue({
        success: true,
        data: { response: mockResponse },
      });

      await aiService.generateResponse("test message", "test context", "Custom prompt");

      expect(geminiApi.generateRAGResponse).toHaveBeenCalledWith(
        "test message",
        "test context",
        "Custom prompt",
        { includeMetadata: true }
      );
    });
  });

  describe("countTokens", () => {
    it("should count tokens successfully", async () => {
      (geminiApi.countTokens as jest.Mock).mockResolvedValue({
        success: true,
        data: 10,
      });

      const result = await aiService.countTokens("test text");

      expect(result).toBe(10);
      expect(geminiApi.countTokens).toHaveBeenCalledWith("test text");
    });

    it("should return 0 when counting fails", async () => {
      (geminiApi.countTokens as jest.Mock).mockResolvedValue({
        success: false,
        error: "API error",
      });

      // Mock cache to return undefined to force API call
      jest
        .spyOn(require("../../../src/utils/cache"), "getCachedTokenCount")
        .mockImplementation(async (...args: unknown[]) => {
          const [text, countFn] = args as [string, (text: string) => Promise<number>];
          return await countFn(text);
        });

      const result = await aiService.countTokens("test text");

      expect(result).toBe(0);
    });
  });

  describe("getStats", () => {
    it("should return service statistics", () => {
      const stats = aiService.getStats();

      expect(stats).toHaveProperty("requestCount");
      expect(stats).toHaveProperty("cacheStats");
      expect(stats).toHaveProperty("config");
      expect(typeof stats.requestCount).toBe("number");
      expect(typeof stats.cacheStats).toBe("object");
      expect(stats.cacheStats).toHaveProperty("hits");
      expect(stats.cacheStats).toHaveProperty("misses");
      expect(stats.cacheStats).toHaveProperty("keys");
      expect(stats.cacheStats).toHaveProperty("size");
    });
  });

  describe("clearCache", () => {
    it("should clear cache successfully", () => {
      // Mock the clearCacheByPattern function
      const mockClearCacheByPattern = jest.fn().mockReturnValue(1);
      jest
        .spyOn(require("../../../src/utils/cache"), "clearCacheByPattern")
        .mockImplementation(mockClearCacheByPattern);

      aiService.clearCache();

      // Verify clearCacheByPattern was called for each pattern
      expect(mockClearCacheByPattern).toHaveBeenCalledWith("embedding:");
      expect(mockClearCacheByPattern).toHaveBeenCalledWith("ai_response:");
      expect(mockClearCacheByPattern).toHaveBeenCalledWith("tokens:");
    });
  });
});

describe("defaultAIService", () => {
  it("should be an instance of AIService", () => {
    expect(defaultAIService).toBeInstanceOf(AIService);
  });

  it("should have default configuration", () => {
    const config = defaultAIService.getConfig();
    expect(config.enableCaching).toBe(true);
    expect(config.defaultSystemPrompt).toBe("You are a helpful fashion AI assistant.");
  });
});
