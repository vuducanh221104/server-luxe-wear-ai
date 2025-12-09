/**
 * @file vector.service.test.ts
 * @description Unit tests for vector service
 */

import { VectorService } from "../../../src/services/vector.service";

// Mock Pinecone
const mockQuery = jest.fn();
const mockUpsert = jest.fn();
const mockDeleteOne = jest.fn();
const mockDeleteMany = jest.fn();

jest.mock("../../../src/config/pinecone", () => ({
  getPineconeIndex: () => ({
    query: mockQuery,
    upsert: mockUpsert,
    deleteOne: mockDeleteOne,
    deleteMany: mockDeleteMany,
  }),
}));

// Mock embedding service
const mockGenerateEmbedding = jest.fn();
const mockCountTokens = jest.fn();

jest.mock("../../../src/services/embedding.service", () => ({
  embeddingService: {
    generateEmbedding: (text: string) => mockGenerateEmbedding(text),
    countTokens: (text: string) => mockCountTokens(text),
  },
}));

// Mock cache
jest.mock("../../../src/utils/cache", () => ({
  getCachedEmbedding: jest.fn(async (_query, generator) => generator(_query)),
  getCachedSearchResults: jest.fn(async (vector, userId, tenantId, topK, searcher) =>
    searcher(vector, userId, tenantId, topK)
  ),
  getCachedTokenCount: jest.fn(async (text, counter) => counter(text)),
  getCachedContext: jest.fn(async (results, maxTokens, builder) => builder(results, maxTokens)),
}));

// Mock logger
jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe("VectorService", () => {
  let service: VectorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VectorService();

    // Default mock implementations
    mockGenerateEmbedding.mockResolvedValue(Array(1024).fill(0.1));
    mockCountTokens.mockReturnValue(100);
  });

  describe("searchKnowledge", () => {
    it("should search knowledge and return results", async () => {
      mockQuery.mockResolvedValue({
        matches: [
          {
            id: "doc-1",
            score: 0.95,
            metadata: { content: "Test content 1", title: "Title 1" },
          },
          {
            id: "doc-2",
            score: 0.85,
            metadata: { content: "Test content 2", title: "Title 2" },
          },
        ],
      });

      const results = await service.searchKnowledge("test query", "user-1", "tenant-1", 5);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("doc-1");
      expect(results[0].score).toBe(0.95);
      expect(mockGenerateEmbedding).toHaveBeenCalledWith("test query");
    });

    it("should filter out low-score results", async () => {
      mockQuery.mockResolvedValue({
        matches: [
          { id: "doc-1", score: 0.95, metadata: { content: "High score" } },
          { id: "doc-2", score: 0.25, metadata: { content: "Low score" } }, // Below 0.3 threshold
          { id: "doc-3", score: 0.5, metadata: { content: "Medium score" } },
        ],
      });

      const results = await service.searchKnowledge("test query");

      expect(results).toHaveLength(2);
      expect(results.map((r) => r.id)).not.toContain("doc-2");
    });

    it("should return empty array on error", async () => {
      mockGenerateEmbedding.mockRejectedValue(new Error("Embedding failed"));

      const results = await service.searchKnowledge("test query");

      expect(results).toEqual([]);
    });

    it("should respect topK parameter", async () => {
      mockQuery.mockResolvedValue({
        matches: [
          { id: "doc-1", score: 0.95, metadata: { content: "Content 1" } },
          { id: "doc-2", score: 0.9, metadata: { content: "Content 2" } },
          { id: "doc-3", score: 0.85, metadata: { content: "Content 3" } },
        ],
      });

      const results = await service.searchKnowledge("test query", undefined, undefined, 2);

      expect(results).toHaveLength(2);
    });
  });

  describe("storeKnowledge", () => {
    it("should store knowledge with embedding", async () => {
      const testVector = Array(1024).fill(0.5);
      mockGenerateEmbedding.mockResolvedValue(testVector);
      mockUpsert.mockResolvedValue({});

      await service.storeKnowledge("doc-1", "Test content", { title: "Test Title" });

      expect(mockGenerateEmbedding).toHaveBeenCalledWith("Test content");
      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          id: "doc-1",
          values: testVector,
          metadata: expect.objectContaining({
            content: "Test content",
            title: "Test Title",
          }),
        }),
      ]);
    });

    it("should throw error when storage fails", async () => {
      mockUpsert.mockRejectedValue(new Error("Storage failed"));

      await expect(service.storeKnowledge("doc-1", "Test content")).rejects.toThrow(
        "Storage failed"
      );
    });

    it("should filter out null metadata values", async () => {
      mockUpsert.mockResolvedValue({});

      await service.storeKnowledge("doc-1", "Test content", {
        title: "Title",
        nullField: null,
        undefinedField: undefined,
      });

      expect(mockUpsert).toHaveBeenCalledWith([
        expect.objectContaining({
          metadata: expect.not.objectContaining({
            nullField: null,
            undefinedField: undefined,
          }),
        }),
      ]);
    });
  });

  describe("buildContextOptimized", () => {
    it("should build context from search results", async () => {
      const searchResults = [
        { id: "1", score: 0.9, metadata: { content: "First content" } },
        { id: "2", score: 0.8, metadata: { content: "Second content" } },
      ];

      mockCountTokens.mockReturnValue(10);

      const context = await service.buildContextOptimized(searchResults as any);

      expect(context).toContain("First content");
      expect(context).toContain("Second content");
    });

    it("should return empty string for empty results", async () => {
      const context = await service.buildContextOptimized([]);

      expect(context).toBe("");
    });

    it("should respect token limit", async () => {
      const searchResults = [
        { id: "1", score: 0.9, metadata: { content: "Content 1" } },
        { id: "2", score: 0.8, metadata: { content: "Content 2" } },
        { id: "3", score: 0.7, metadata: { content: "Content 3" } },
      ];

      // Each content is 100 tokens, limit is 150
      mockCountTokens.mockReturnValue(100);

      const context = await service.buildContextOptimized(searchResults as any, 150);

      // Should only include first result
      expect(context).toContain("Content 1");
    });

    it("should sort results by score before processing", async () => {
      const searchResults = [
        { id: "1", score: 0.5, metadata: { content: "Low score" } },
        { id: "2", score: 0.9, metadata: { content: "High score" } },
        { id: "3", score: 0.7, metadata: { content: "Medium score" } },
      ];

      mockCountTokens.mockReturnValue(10);

      const context = await service.buildContextOptimized(searchResults as any);

      // High score should come first
      const highPos = context.indexOf("High score");
      const medPos = context.indexOf("Medium score");
      const lowPos = context.indexOf("Low score");

      expect(highPos).toBeLessThan(medPos);
      expect(medPos).toBeLessThan(lowPos);
    });
  });

  describe("batchStoreKnowledge", () => {
    it("should store multiple knowledge entries", async () => {
      mockUpsert.mockResolvedValue({});

      const entries = [
        { id: "doc-1", content: "Content 1", metadata: { title: "Title 1" } },
        { id: "doc-2", content: "Content 2", metadata: { title: "Title 2" } },
      ];

      await service.batchStoreKnowledge(entries);

      expect(mockGenerateEmbedding).toHaveBeenCalledTimes(2);
      expect(mockUpsert).toHaveBeenCalled();
    });

    it("should handle empty entries array", async () => {
      await service.batchStoreKnowledge([]);

      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });

  describe("deleteKnowledge", () => {
    it("should delete knowledge by ID", async () => {
      mockDeleteOne.mockResolvedValue({});

      await service.deleteKnowledge("doc-1");

      expect(mockDeleteOne).toHaveBeenCalledWith("doc-1");
    });
  });
});
