/**
 * @file vectorizer.service.ts
 * @description Vector operations and RAG (Retrieval Augmented Generation) implementation
 * Uses Pinecone Inference API with multilingual-e5-large (1024 dims) - NO quota limits!
 * Includes embedding service for vector generation
 */

import { getPineconeIndex, getPineconeClient } from "../config/pinecone";
import { defaultAIService } from "./ai.service";
import logger from "../config/logger";
import {
  getCachedEmbedding,
  getCachedSearchResults,
  getCachedAIResponse,
  getCachedTokenCount,
  getCachedContext,
} from "../utils/cache";

import type { SearchResult } from "../types/knowledge";

// Re-export SearchResult for backward compatibility
export type { SearchResult };

// ============================================================================
// EMBEDDING SERVICE (merged from embedding.service.ts)
// ============================================================================

/**
 * Generate embeddings using Pinecone Inference API
 * Uses multilingual-e5-large model (1024 dims) configured in the index
 */
class EmbeddingService {
  /**
   * Generate embedding using Pinecone Inference API
   * Model: multilingual-e5-large (1024 dimensions)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const pc = getPineconeClient();

      // Use Pinecone Inference API
      const result = await pc.inference.embed("multilingual-e5-large", [text], {
        inputType: "passage",
        truncate: "END",
      });

      // EmbeddingsList has structure: { data: Array<Embedding> }
      const embeddingData = result.data[0];

      // Type guard: Check if it's a dense embedding
      if (!("values" in embeddingData)) {
        throw new Error(`Expected dense embedding but got ${result.vectorType}`);
      }

      const embedding = embeddingData.values;

      logger.debug("Embedding generated via Pinecone Inference", {
        textLength: text.length,
        dimensions: embedding?.length || 0,
        model: result.model,
        vectorType: result.vectorType,
      });

      if (!embedding || embedding.length === 0) {
        throw new Error("Empty embedding received from Pinecone");
      }

      return embedding;
    } catch (error) {
      logger.error("Failed to generate embedding via Pinecone Inference", {
        error: error instanceof Error ? error.message : "Unknown error",
        textLength: text.length,
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Count tokens (approximate for multilingual-e5-large)
   */
  async countTokens(text: string): Promise<number> {
    // multilingual-e5-large: ~1.3 tokens per word
    const words = text.split(/\s+/).length;
    return Math.ceil(words * 1.3);
  }
}

// Local instance
const embeddingService = new EmbeddingService();

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

export const searchKnowledge = async (
  query: string,
  userId?: string,
  tenantId?: string,
  topK: number = 5
): Promise<SearchResult[]> => {
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
      searchKnowledgeWithVector
    );
  } catch (error) {
    logger.error("Knowledge search failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
};

export const searchKnowledgeWithVector = async (
  queryVector: number[],
  userId?: string,
  tenantId?: string,
  topK: number = 5
): Promise<SearchResult[]> => {
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
};

export const buildContextOptimized = async (
  searchResults: SearchResult[],
  maxTokens: number = 30000
): Promise<string> => {
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
};

export const chatWithRAG = async (
  userMessage: string,
  userId?: string,
  systemPrompt: string = "You are a helpful fashion AI assistant."
): Promise<string> => {
  try {
    logger.info("Starting RAG chat", {
      userId,
      messageLength: userMessage.length,
    });

    const [queryVector, messageTokens] = await Promise.all([
      getCachedEmbedding(userMessage, embeddingService.generateEmbedding.bind(embeddingService)),
      getCachedTokenCount(userMessage, embeddingService.countTokens.bind(embeddingService)),
    ]);

    const searchResults = await getCachedSearchResults(
      queryVector,
      userId,
      undefined,
      5,
      searchKnowledgeWithVector
    );

    const [context, contextTokens] = await Promise.all([
      buildContextOptimized(searchResults as SearchResult[], 30000 - messageTokens),
      searchResults.length > 0
        ? getCachedTokenCount(
            (searchResults as SearchResult[]).map((r) => r.metadata.content).join(" "),
            embeddingService.countTokens.bind(embeddingService)
          )
        : Promise.resolve(0),
    ]);

    const response = await getCachedAIResponse(
      userMessage,
      context,
      systemPrompt,
      defaultAIService.generateResponse.bind(defaultAIService)
    );

    logger.info("RAG chat completed", {
      contextUsed: !!context,
      responseLength: response.length,
      contextTokens,
      searchResultsCount: searchResults.length,
    });

    return response;
  } catch (error) {
    logger.error("RAG chat failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to generate AI response");
  }
};

export const storeKnowledge = async (
  id: string,
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<void> => {
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
    throw error instanceof Error ? error : new Error(`Failed to store knowledge: ${errorMessage}`);
  }
};

/**
 * Batch store knowledge entries with optimized embedding generation
 * Uses caching and sequential processing to avoid quota limits
 */
export const batchStoreKnowledge = async (
  entries: Array<{
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>
): Promise<void> => {
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
};

export const deleteKnowledge = async (id: string): Promise<void> => {
  try {
    const index = getPineconeIndex();
    await index.deleteOne(id);

    logger.info("Knowledge deleted", { id });
  } catch (error) {
    logger.error("Failed to delete knowledge", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to delete knowledge");
  }
};

export default {
  searchKnowledge,
  searchKnowledgeWithVector,
  buildContextOptimized,
  chatWithRAG,
  storeKnowledge,
  batchStoreKnowledge,
  deleteKnowledge,
};
