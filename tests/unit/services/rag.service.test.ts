/**
 * @file rag.service.test.ts
 * @description Unit tests for RAGService
 */

import { RAGService } from "../../../src/services/rag.service";

// Mock dependencies
jest.mock("../../../src/services/embedding.service", () => ({
  embeddingService: {
    generateEmbedding: jest.fn(),
    countTokens: jest.fn(),
  },
}));

jest.mock("../../../src/services/vector.service", () => ({
  vectorService: {
    searchKnowledgeWithVector: jest.fn(),
    buildContextOptimized: jest.fn(),
  },
}));

jest.mock("../../../src/services/ai.service", () => ({
  defaultAIService: {
    gemini: {
      generateContent: jest.fn(),
    },
  },
}));

jest.mock("../../../src/utils/cache", () => ({
  getCachedEmbedding: jest.fn(),
  getCachedSearchResults: jest.fn(),
  getCachedTokenCount: jest.fn(),
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

describe("RAGService", () => {
  let ragService: RAGService;

  beforeEach(() => {
    jest.clearAllMocks();
    ragService = new RAGService();
  });

  describe("chatWithRAGStream", () => {
    it("should stream RAG response with context", async () => {
      const {
        getCachedEmbedding,
        getCachedSearchResults,
        getCachedTokenCount,
      } = require("../../../src/utils/cache");
      const { vectorService } = require("../../../src/services/vector.service");
      const { defaultAIService } = require("../../../src/services/ai.service");

      // Mock embedding
      getCachedEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);

      // Mock token count
      getCachedTokenCount.mockResolvedValue(10);

      // Mock search results
      getCachedSearchResults.mockResolvedValue([
        { id: "1", score: 0.9, metadata: { content: "test content" } },
      ]);

      // Mock context building
      vectorService.buildContextOptimized.mockResolvedValue("Context from knowledge base");

      // Mock AI streaming
      const chunks = ["Hello", " ", "World"];
      defaultAIService.gemini.generateContent.mockImplementation(async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      });

      const result: string[] = [];
      for await (const chunk of ragService.chatWithRAGStream(
        "What is fashion?",
        "user-1",
        "You are a fashion assistant"
      )) {
        result.push(chunk);
      }

      expect(result).toEqual(chunks);
      expect(getCachedEmbedding).toHaveBeenCalled();
      expect(getCachedTokenCount).toHaveBeenCalled();
      expect(getCachedSearchResults).toHaveBeenCalled();
      expect(vectorService.buildContextOptimized).toHaveBeenCalled();
    });

    it("should handle empty search results", async () => {
      const {
        getCachedEmbedding,
        getCachedSearchResults,
        getCachedTokenCount,
      } = require("../../../src/utils/cache");
      const { vectorService } = require("../../../src/services/vector.service");
      const { defaultAIService } = require("../../../src/services/ai.service");

      getCachedEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      getCachedTokenCount.mockResolvedValue(10);
      getCachedSearchResults.mockResolvedValue([]);
      vectorService.buildContextOptimized.mockResolvedValue("");

      defaultAIService.gemini.generateContent.mockImplementation(async function* () {
        yield "No context available";
      });

      const result: string[] = [];
      for await (const chunk of ragService.chatWithRAGStream("test", "user-1")) {
        result.push(chunk);
      }

      expect(result).toEqual(["No context available"]);
    });

    it("should use default system prompt when not provided", async () => {
      const {
        getCachedEmbedding,
        getCachedSearchResults,
        getCachedTokenCount,
      } = require("../../../src/utils/cache");
      const { vectorService } = require("../../../src/services/vector.service");
      const { defaultAIService } = require("../../../src/services/ai.service");

      getCachedEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      getCachedTokenCount.mockResolvedValue(10);
      getCachedSearchResults.mockResolvedValue([]);
      vectorService.buildContextOptimized.mockResolvedValue("");

      defaultAIService.gemini.generateContent.mockImplementation(async function* () {
        yield "Response";
      });

      const result: string[] = [];
      for await (const chunk of ragService.chatWithRAGStream("test")) {
        result.push(chunk);
      }

      expect(defaultAIService.gemini.generateContent).toHaveBeenCalledWith(
        expect.stringContaining("You are a helpful fashion AI assistant"),
        expect.any(Object)
      );
    });

    it("should handle undefined userId", async () => {
      const {
        getCachedEmbedding,
        getCachedSearchResults,
        getCachedTokenCount,
      } = require("../../../src/utils/cache");
      const { vectorService } = require("../../../src/services/vector.service");
      const { defaultAIService } = require("../../../src/services/ai.service");

      getCachedEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      getCachedTokenCount.mockResolvedValue(5);
      getCachedSearchResults.mockResolvedValue([]);
      vectorService.buildContextOptimized.mockResolvedValue("");

      defaultAIService.gemini.generateContent.mockImplementation(async function* () {
        yield "Response";
      });

      const result: string[] = [];
      for await (const chunk of ragService.chatWithRAGStream("test", undefined)) {
        result.push(chunk);
      }

      expect(result).toEqual(["Response"]);
    });

    it("should calculate context size based on message tokens", async () => {
      const {
        getCachedEmbedding,
        getCachedSearchResults,
        getCachedTokenCount,
      } = require("../../../src/utils/cache");
      const { vectorService } = require("../../../src/services/vector.service");
      const { defaultAIService } = require("../../../src/services/ai.service");

      getCachedEmbedding.mockResolvedValue([0.1, 0.2, 0.3]);
      getCachedTokenCount.mockResolvedValue(1000); // Large message
      getCachedSearchResults.mockResolvedValue([
        { id: "1", score: 0.9, metadata: { content: "test" } },
      ]);
      vectorService.buildContextOptimized.mockResolvedValue("Context");

      defaultAIService.gemini.generateContent.mockImplementation(async function* () {
        yield "Response";
      });

      for await (const _ of ragService.chatWithRAGStream("test", "user-1")) {
        // consume iterator
      }

      // Context limit should be 30000 - message tokens
      expect(vectorService.buildContextOptimized).toHaveBeenCalledWith(
        expect.any(Array),
        29000 // 30000 - 1000
      );
    });
  });
});
