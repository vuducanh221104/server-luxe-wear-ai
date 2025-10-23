/**
 * @file vector.service.ts
 * @description Vector database operations with Pinecone
 * Handles vector storage, search, and context building
 */

import { getPineconeIndex } from "../config/pinecone";
import logger from "../config/logger";
import { embeddingService } from "./embedding.service";
import {
  getCachedEmbedding,
  getCachedSearchResults,
  getCachedTokenCount,
  getCachedContext,
} from "../utils/cache";

import type { SearchResult } from "../types/knowledge";

// Re-export SearchResult for backward compatibility
export type { SearchResult };

// ============================================================================
// METADATA HELPERS
// ============================================================================

/**
 * Filter out null/undefined values from metadata (Pinecone doesn't accept them)
 * Pinecone accepts: string | number | boolean | string[]
 */
const filterMetadata = (
  metadata: Record<string, unknown>
): Record<string, string | number | boolean | string[]> => {
  const filtered: Record<string, string | number | boolean | string[]> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== null && value !== undefined) {
      // Ensure value is a valid Pinecone metadata type
      if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean" ||
        (Array.isArray(value) && value.every((v) => typeof v === "string"))
      ) {
        filtered[key] = value as string | number | boolean | string[];
      }
    }
  }
  return filtered;
};

// ============================================================================
// VECTOR SERVICE
// ============================================================================

/**
 * Vector Service
 * Handles all Pinecone vector database operations
 */
export class VectorService {
  /**
   * Search knowledge base using semantic search
   *
   * @param query - Search query text
   * @param userId - Optional user ID for filtering
   * @param tenantId - Optional tenant ID for filtering
   * @param topK - Number of results to return (default: 5)
   * @returns Promise<SearchResult[]> - Matching results
   */
  async searchKnowledge(
    query: string,
    userId?: string,
    tenantId?: string,
    topK: number = 5
  ): Promise<SearchResult[]> {
    try {
      // Use cached embedding to avoid re-generating for same query
      const queryVector = await getCachedEmbedding(
        query,
        embeddingService.generateEmbedding.bind(embeddingService)
      );

      return await getCachedSearchResults(
        queryVector,
        userId,
        tenantId,
        topK,
        this.searchKnowledgeWithVector.bind(this)
      );
    } catch (error) {
      logger.error("Knowledge search failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }
  }

  /**
   * Search knowledge base using pre-computed vector
   *
   * @param queryVector - Pre-computed embedding vector
   * @param userId - Optional user ID for filtering
   * @param tenantId - Optional tenant ID for filtering
   * @param topK - Number of results to return (default: 5)
   * @returns Promise<SearchResult[]> - Matching results
   */
  async searchKnowledgeWithVector(
    queryVector: number[],
    userId?: string,
    tenantId?: string,
    topK: number = 5
  ): Promise<SearchResult[]> {
    try {
      const index = getPineconeIndex();
      const searchResults = await index.query({
        vector: queryVector,
        topK: Math.min(topK * 2, 20),
        includeMetadata: true,
        ...((userId || tenantId) && {
          filter: {
            ...(userId && { userId: { $eq: userId } }),
            ...(tenantId && { tenantId: { $eq: tenantId } }),
            createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() },
          },
        }),
      });

      const relevantResults = searchResults.matches
        .filter((match) => match.score && match.score > 0.6)
        .slice(0, topK)
        .map((match) => ({
          id: match.id,
          score: match.score || 0,
          metadata: match.metadata as SearchResult["metadata"],
        }));

      logger.info("Knowledge search completed", {
        resultsFound: relevantResults.length,
        topScore: relevantResults[0]?.score || 0,
      });

      return relevantResults;
    } catch (error) {
      logger.error("Knowledge search failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return [];
    }
  }

  /**
   * Build optimized context from search results
   * Token-aware context assembly with caching
   *
   * @param searchResults - Search results from vector search
   * @param maxTokens - Maximum tokens allowed (default: 30000)
   * @returns Promise<string> - Assembled context string
   */
  async buildContextOptimized(
    searchResults: SearchResult[],
    maxTokens: number = 30000
  ): Promise<string> {
    if (searchResults.length === 0) return "";

    return await getCachedContext(searchResults, maxTokens, async (results, maxTokensParam) => {
      const sortedResults = results.sort((a, b) => b.score - a.score);

      const tokenCountPromises = sortedResults.map(async (result) => ({
        result,
        tokens: await getCachedTokenCount(
          result.metadata.content,
          embeddingService.countTokens.bind(embeddingService)
        ),
      }));

      const resultsWithTokens = await Promise.all(tokenCountPromises);

      let context = "";
      let tokenCount = 0;

      for (const { result, tokens } of resultsWithTokens) {
        if (tokenCount + tokens > maxTokensParam) {
          logger.warn("Context size limit reached", {
            currentTokens: tokenCount,
            maxTokens: maxTokensParam,
          });
          break;
        }

        context += `${result.metadata.content}\n\n`;
        tokenCount += tokens;
      }

      return context.trim();
    });
  }

  /**
   * Store knowledge in vector database
   *
   * @param id - Unique identifier for the knowledge entry
   * @param content - Text content to store
   * @param metadata - Optional metadata to attach
   */
  async storeKnowledge(
    id: string,
    content: string,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    try {
      logger.debug("Storing knowledge in vector DB", {
        id,
        contentLength: content.length,
        metadataKeys: Object.keys(metadata),
      });

      // Generate embedding via Pinecone Inference (multilingual-e5-large, 1024 dims)
      const vector = await embeddingService.generateEmbedding(content);

      logger.debug("Embedding generated via Pinecone Inference", {
        id,
        vectorLength: vector.length,
        model: "multilingual-e5-large",
      });

      const index = getPineconeIndex();

      // Filter out null/undefined values from metadata
      const cleanMetadata = filterMetadata({
        content,
        ...metadata,
        createdAt: new Date().toISOString(),
      });

      await index.upsert([
        {
          id,
          values: vector,
          metadata: cleanMetadata,
        },
      ]);

      logger.info("Knowledge stored successfully", {
        id,
        contentLength: content.length,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const errorStack = error instanceof Error ? error.stack : undefined;

      logger.error("Failed to store knowledge in vector DB", {
        id,
        error: errorMessage,
        stack: errorStack,
        contentLength: content?.length,
        metadataKeys: Object.keys(metadata || {}),
      });

      // Preserve original error for better debugging
      throw error instanceof Error
        ? error
        : new Error(`Failed to store knowledge: ${errorMessage}`);
    }
  }

  /**
   * Batch store knowledge entries with optimized embedding generation
   * Uses caching and sequential processing to avoid quota limits
   *
   * @param entries - Array of knowledge entries to store
   */
  async batchStoreKnowledge(
    entries: Array<{
      id: string;
      content: string;
      metadata?: Record<string, unknown>;
    }>
  ): Promise<void> {
    try {
      const index = getPineconeIndex();

      logger.info("Starting optimized batch knowledge storage", {
        count: entries.length,
      });

      // ✅ OPTIMIZATION: Use cached embeddings + sequential processing with delays
      const vectors = [];
      const BATCH_SIZE = 10; // Process 10 at a time to avoid rate limits
      const DELAY_MS = 1000; // 1 second delay between batches

      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = entries.slice(i, i + BATCH_SIZE);

        logger.debug(
          `Processing embedding batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entries.length / BATCH_SIZE)}`,
          {
            batchSize: batch.length,
          }
        );

        // Generate embeddings for this batch (with caching)
        const batchVectors = await Promise.all(
          batch.map(async (entry) => {
            const cachedVector = await getCachedEmbedding(
              entry.content,
              embeddingService.generateEmbedding.bind(embeddingService)
            );

            // Filter out null/undefined values from metadata
            const cleanMetadata = filterMetadata({
              content: entry.content,
              ...entry.metadata,
              createdAt: new Date().toISOString(),
            });

            return {
              id: entry.id,
              values: cachedVector,
              metadata: cleanMetadata,
            };
          })
        );

        vectors.push(...batchVectors);

        // Add delay between batches to avoid rate limiting (except for last batch)
        if (i + BATCH_SIZE < entries.length) {
          await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
        }
      }

      // Upsert to Pinecone in larger batches (Pinecone has higher limits)
      const PINECONE_BATCH_SIZE = 200;
      const upsertPromises = [];

      for (let i = 0; i < vectors.length; i += PINECONE_BATCH_SIZE) {
        const batch = vectors.slice(i, i + PINECONE_BATCH_SIZE);
        upsertPromises.push(
          index.upsert(batch).catch((error) => {
            logger.error("Batch upsert to Pinecone failed", {
              batchIndex: i / PINECONE_BATCH_SIZE,
              batchSize: batch.length,
              error: error instanceof Error ? error.message : "Unknown error",
            });
            throw error;
          })
        );
      }

      await Promise.all(upsertPromises);

      logger.info("Batch knowledge stored successfully", {
        count: entries.length,
        vectorsGenerated: vectors.length,
        pineoneBatches: upsertPromises.length,
      });
    } catch (error) {
      logger.error("Failed to batch store knowledge", {
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw new Error("Failed to batch store knowledge");
    }
  }

  /**
   * Delete knowledge entry from vector database
   *
   * @param id - ID of the knowledge entry to delete
   */
  async deleteKnowledge(id: string): Promise<void> {
    try {
      const index = getPineconeIndex();
      await index.deleteOne(id);

      logger.info("Knowledge deleted from vector DB", { id });
    } catch (error) {
      logger.error("Failed to delete knowledge from vector DB", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Failed to delete knowledge");
    }
  }
}

// Create and export singleton instance
export const vectorService = new VectorService();

// Export individual methods for backward compatibility
export const searchKnowledge = vectorService.searchKnowledge.bind(vectorService);
export const searchKnowledgeWithVector =
  vectorService.searchKnowledgeWithVector.bind(vectorService);
export const buildContextOptimized = vectorService.buildContextOptimized.bind(vectorService);
export const storeKnowledge = vectorService.storeKnowledge.bind(vectorService);
export const batchStoreKnowledge = vectorService.batchStoreKnowledge.bind(vectorService);
export const deleteKnowledge = vectorService.deleteKnowledge.bind(vectorService);

// Export default
export default vectorService;
