/**
 * @file vectorizer.ts
 * @description Vector operations and RAG (Retrieval Augmented Generation) implementation
 * Connects Pinecone vector search with Gemini AI
 */

import { getPineconeIndex } from "../config/pinecone";
import { defaultAIService } from "../config/ai";
import logger from "../config/logger";
import {
  getCachedEmbedding,
  getCachedSearchResults,
  getCachedAIResponse,
  getCachedTokenCount,
  getCachedContext,
} from "./cache";

/**
 * Search result from Pinecone
 */
export interface SearchResult {
  id: string;
  score: number;
  metadata: {
    content: string;
    userId?: string;
    [key: string]: unknown;
  };
}

/**
 * Search knowledge base using vector similarity
 * @param query - User's search query
 * @param userId - Filter by user ID (optional)
 * @param tenantId - Filter by tenant ID (optional)
 * @param topK - Number of results to return (default: 5)
 * @returns Array of relevant knowledge entries
 */
export const searchKnowledge = async (
  query: string,
  userId?: string,
  tenantId?: string,
  topK: number = 5
): Promise<SearchResult[]> => {
  try {
    // 1. Convert query to vector (with caching)
    const queryVector = await getCachedEmbedding(
      query,
      defaultAIService.generateEmbedding.bind(defaultAIService)
    );

    // 2. Search using the vector (with caching)
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

/**
 * Search knowledge base using pre-computed vector
 * @param queryVector - Pre-computed query vector
 * @param userId - Filter by user ID (optional)
 * @param tenantId - Filter by tenant ID (optional)
 * @param topK - Number of results to return (default: 5)
 * @returns Array of relevant knowledge entries
 */
export const searchKnowledgeWithVector = async (
  queryVector: number[],
  userId?: string,
  tenantId?: string,
  topK: number = 5
): Promise<SearchResult[]> => {
  try {
    // Search in Pinecone
    const index = getPineconeIndex();
    const searchResults = await index.query({
      vector: queryVector,
      topK: Math.min(topK * 2, 20), // Get more results for better filtering
      includeMetadata: true,
      ...((userId || tenantId) && {
        filter: {
          ...(userId && { userId: { $eq: userId } }),
          ...(tenantId && { tenantId: { $eq: tenantId } }),
          // Add recency filter for better results
          createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString() },
        },
      }),
    });

    // Filter by similarity score (only relevant results)
    const relevantResults = searchResults.matches
      .filter((match) => match.score && match.score > 0.6) // Lower threshold for better recall
      .slice(0, topK) // Take only top K results
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

/**
 * Build context from search results with token management
 * @param searchResults - Results from Pinecone
 * @param maxTokens - Maximum tokens for context (default: 30000)
 * @returns Context string
 */
export const buildContext = async (
  searchResults: SearchResult[],
  maxTokens: number = 30000
): Promise<string> => {
  let context = "";
  let tokenCount = 0;

  for (const result of searchResults) {
    const content = result.metadata.content;
    const itemTokens = await defaultAIService.countTokens(content);

    // Stop if adding this would exceed limit
    if (tokenCount + itemTokens > maxTokens) {
      logger.warn("Context size limit reached", {
        currentTokens: tokenCount,
        maxTokens,
      });
      break;
    }

    context += `${content}\n\n`;
    tokenCount += itemTokens;
  }

  return context.trim();
};

/**
 * Optimized context building with parallel token counting
 * @param searchResults - Results from Pinecone
 * @param maxTokens - Maximum tokens for context (default: 30000)
 * @returns Context string
 */
export const buildContextOptimized = async (
  searchResults: SearchResult[],
  maxTokens: number = 30000
): Promise<string> => {
  if (searchResults.length === 0) return "";

  // Use cached context if available
  return await getCachedContext(searchResults, maxTokens, async (results, maxTokensParam) => {
    // Pre-sort by score for better context quality
    const sortedResults = results.sort((a, b) => b.score - a.score);

    // Parallel: Count tokens for all results at once (with caching)
    const tokenCountPromises = sortedResults.map(async (result) => ({
      result,
      tokens: await getCachedTokenCount(
        result.metadata.content,
        defaultAIService.countTokens.bind(defaultAIService)
      ),
    }));

    const resultsWithTokens = await Promise.all(tokenCountPromises);

    let context = "";
    let tokenCount = 0;

    for (const { result, tokens } of resultsWithTokens) {
      // Stop if adding this would exceed limit
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

/**
 * RAG: Chat with AI using knowledge from Pinecone
 * @param userMessage - User's message/question
 * @param userId - User ID for filtering knowledge (optional)
 * @param systemPrompt - System instructions for AI
 * @returns AI generated response with relevant context
 */
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

    // 1. Parallel: Generate embedding and count tokens for context management (with caching)
    const [queryVector, messageTokens] = await Promise.all([
      getCachedEmbedding(userMessage, defaultAIService.generateEmbedding.bind(defaultAIService)),
      getCachedTokenCount(userMessage, defaultAIService.countTokens.bind(defaultAIService)),
    ]);

    // 2. Search relevant knowledge using the vector (with caching)
    const searchResults = await getCachedSearchResults(
      queryVector,
      userId,
      undefined, // tenantId - not available in this context
      5,
      searchKnowledgeWithVector
    );

    // 3. Parallel: Build context and prepare for AI generation
    const [context, contextTokens] = await Promise.all([
      buildContextOptimized(searchResults as SearchResult[], 30000 - messageTokens),
      searchResults.length > 0
        ? getCachedTokenCount(
            (searchResults as SearchResult[]).map((r) => r.metadata.content).join(" "),
            defaultAIService.countTokens.bind(defaultAIService)
          )
        : Promise.resolve(0),
    ]);

    // 4. Generate AI response with context (with caching)
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

/**
 * Store knowledge in Pinecone vector database
 * @param id - Unique ID for the knowledge entry
 * @param content - Text content to store
 * @param metadata - Additional metadata (userId, tags, etc.)
 */
export const storeKnowledge = async (
  id: string,
  content: string,
  metadata: Record<string, unknown> = {}
): Promise<void> => {
  try {
    // 1. Generate embedding vector
    const vector = await defaultAIService.generateEmbedding(content);

    // 2. Store in Pinecone
    const index = getPineconeIndex();
    await index.upsert([
      {
        id,
        values: vector,
        metadata: {
          content,
          ...metadata,
          createdAt: new Date().toISOString(),
        },
      },
    ]);

    logger.info("Knowledge stored", {
      id,
      contentLength: content.length,
    });
  } catch (error) {
    logger.error("Failed to store knowledge", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to store knowledge");
  }
};

/**
 * Batch store multiple knowledge entries
 * @param entries - Array of knowledge entries
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

    // Parallel: Generate all embeddings at once
    const vectorPromises = entries.map(async (entry) => {
      const vector = await defaultAIService.generateEmbedding(entry.content);
      return {
        id: entry.id,
        values: vector,
        metadata: {
          content: entry.content,
          ...entry.metadata,
          createdAt: new Date().toISOString(),
        },
      };
    });

    const vectors = await Promise.all(vectorPromises);

    // Parallel: Execute all upserts in batches
    const batchSize = 100;
    const upsertPromises = [];

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      upsertPromises.push(index.upsert(batch));
    }

    // Wait for all upserts to complete
    await Promise.all(upsertPromises);

    logger.info("Batch knowledge stored", {
      count: entries.length,
      batches: upsertPromises.length,
    });
  } catch (error) {
    logger.error("Failed to batch store knowledge", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to batch store knowledge");
  }
};

/**
 * Delete knowledge from Pinecone
 * @param id - ID of knowledge to delete
 */
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

// Re-export chunkTextForVector from fileProcessor for vector search
export { chunkTextForVector as chunkText } from "./fileProcessor";

export default {
  searchKnowledge,
  searchKnowledgeWithVector,
  buildContext,
  buildContextOptimized,
  chatWithRAG,
  storeKnowledge,
  batchStoreKnowledge,
  deleteKnowledge,
};
