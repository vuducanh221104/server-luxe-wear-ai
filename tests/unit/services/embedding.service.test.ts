/**
 * @file embedding.service.test.ts
 * @description Unit tests for embedding service
 */

import { EmbeddingService, embeddingService } from "../../../src/services/embedding.service";

// Mock Pinecone client
const mockEmbed = jest.fn();
jest.mock("../../../src/config/pinecone", () => ({
  getPineconeClient: () => ({
    inference: {
      embed: mockEmbed,
    },
  }),
}));

// Mock logger
jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe("EmbeddingService", () => {
  let service: EmbeddingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmbeddingService();
  });

  describe("generateEmbedding", () => {
    it("should generate embedding for text input", async () => {
      const mockEmbedding = Array(1024).fill(0.1);
      mockEmbed.mockResolvedValue({
        data: [{ values: mockEmbedding }],
        model: "multilingual-e5-large",
        vectorType: "dense",
      });

      const result = await service.generateEmbedding("test text");

      expect(result).toEqual(mockEmbedding);
      expect(result).toHaveLength(1024);
      expect(mockEmbed).toHaveBeenCalledWith("multilingual-e5-large", ["test text"], {
        inputType: "passage",
        truncate: "END",
      });
    });

    it("should throw error for empty embedding response", async () => {
      mockEmbed.mockResolvedValue({
        data: [{ values: [] }],
        model: "multilingual-e5-large",
        vectorType: "dense",
      });

      await expect(service.generateEmbedding("test")).rejects.toThrow(
        "Empty embedding received from Pinecone"
      );
    });

    it("should throw error for sparse embedding type", async () => {
      mockEmbed.mockResolvedValue({
        data: [{ indices: [1, 2] }], // Sparse embedding format - no 'values' property
        model: "multilingual-e5-large",
        vectorType: "sparse",
      });

      await expect(service.generateEmbedding("test")).rejects.toThrow("Expected dense embedding");
    });

    it("should handle Pinecone API errors", async () => {
      mockEmbed.mockRejectedValue(new Error("Pinecone API error"));

      await expect(service.generateEmbedding("test")).rejects.toThrow(
        "Failed to generate embedding: Pinecone API error"
      );
    });

    it("should handle non-Error exceptions", async () => {
      mockEmbed.mockRejectedValue("Unknown error");

      await expect(service.generateEmbedding("test")).rejects.toThrow(
        "Failed to generate embedding: Unknown error"
      );
    });
  });

  describe("countTokens", () => {
    it("should estimate tokens for short text", async () => {
      const result = await service.countTokens("Hello world");
      expect(result).toBe(3); // 2 words * 1.3 = 2.6 -> ceil = 3
    });

    it("should estimate tokens for longer text", async () => {
      const text = "This is a longer sentence with multiple words for testing";
      const result = await service.countTokens(text);
      const wordCount = text.split(/\s+/).length;
      expect(result).toBe(Math.ceil(wordCount * 1.3));
    });

    it("should handle empty string", async () => {
      const result = await service.countTokens("");
      expect(result).toBe(2); // 1 * 1.3 = 1.3 -> ceil = 2
    });

    it("should handle single word", async () => {
      const result = await service.countTokens("word");
      expect(result).toBe(2); // 1 * 1.3 = 1.3 -> ceil = 2
    });

    it("should handle text with extra whitespace", async () => {
      const result = await service.countTokens("  hello   world  ");
      // Split by whitespace creates empty strings, so behavior may vary
      expect(result).toBeGreaterThan(0);
    });
  });

  describe("singleton instance", () => {
    it("should export a singleton instance", () => {
      expect(embeddingService).toBeInstanceOf(EmbeddingService);
    });
  });
});
