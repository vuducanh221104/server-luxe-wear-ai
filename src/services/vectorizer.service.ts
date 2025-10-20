/**
 * @file vectorizer.service.ts
 * @description Vector operations and RAG (Retrieval Augmented Generation) implementation
 * Connects Pinecone vector search with Gemini AI (service layer)
 */

import { getPineconeIndex } from "../config/pinecone";
import { defaultAIService } from "./ai.service";
import logger from "../config/logger";
import {
  getCachedEmbedding,
  getCachedSearchResults,
  getCachedAIResponse,
  getCachedTokenCount,
  getCachedContext,
} from "../utils/cache";
import { chunkTextForVector as chunkText } from "../utils/fileProcessor";

export interface SearchResult {
  id: string;
  score: number;
  metadata: {
    content: string;
    userId?: string;
    [key: string]: unknown;
  };
}

export const searchKnowledge = async (
  query: string,
  userId?: string,
  tenantId?: string,
  topK: number = 5
): Promise<SearchResult[]> => {
  try {
    const queryVector = await getCachedEmbedding(
      query,
      defaultAIService.generateEmbedding.bind(defaultAIService)
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

export const buildContext = async (
  searchResults: SearchResult[],
  maxTokens: number = 30000
): Promise<string> => {
  let context = "";
  let tokenCount = 0;

  for (const result of searchResults) {
    const content = result.metadata.content;
    const itemTokens = await defaultAIService.countTokens(content);

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
        defaultAIService.countTokens.bind(defaultAIService)
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
      getCachedEmbedding(userMessage, defaultAIService.generateEmbedding.bind(defaultAIService)),
      getCachedTokenCount(userMessage, defaultAIService.countTokens.bind(defaultAIService)),
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
            defaultAIService.countTokens.bind(defaultAIService)
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

    const vector = await defaultAIService.generateEmbedding(content);

    logger.debug("Embedding generated", {
      id,
      vectorLength: vector.length,
    });

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

export const batchStoreKnowledge = async (
  entries: Array<{
    id: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>
): Promise<void> => {
  try {
    const index = getPineconeIndex();

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

    const batchSize = 100;
    const upsertPromises = [] as Array<Promise<unknown>>;

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      upsertPromises.push(index.upsert(batch));
    }

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

export { chunkText };

export default {
  searchKnowledge,
  searchKnowledgeWithVector,
  buildContext,
  buildContextOptimized,
  chatWithRAG,
  storeKnowledge,
  batchStoreKnowledge,
  deleteKnowledge,
  chunkText,
};
