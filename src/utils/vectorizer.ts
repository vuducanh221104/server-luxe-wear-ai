/**
 * @file vectorizer.ts
 * @description Vector operations and RAG (Retrieval Augmented Generation) implementation
 * Connects Pinecone vector search with Gemini AI
 */

import { getPineconeIndex } from "../config/pinecone";
import { generateEmbedding, generateResponse, countTokens } from "../config/ai";
import logger from "../config/logger";

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
 * @param topK - Number of results to return (default: 5)
 * @returns Array of relevant knowledge entries
 */
export const searchKnowledge = async (
  query: string,
  userId?: string,
  topK: number = 5
): Promise<SearchResult[]> => {
  try {
    // 1. Convert query to vector
    const queryVector = await generateEmbedding(query);

    // 2. Search in Pinecone
    const index = getPineconeIndex();
    const searchResults = await index.query({
      vector: queryVector,
      topK,
      includeMetadata: true,
      ...(userId && {
        filter: {
          userId: { $eq: userId },
        },
      }),
    });

    // 3. Filter by similarity score (only relevant results)
    const relevantResults = searchResults.matches
      .filter((match) => match.score && match.score > 0.7) // 70% similarity threshold
      .map((match) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as SearchResult["metadata"],
      }));

    logger.info("Knowledge search completed", {
      query: query.substring(0, 50),
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
    const itemTokens = await countTokens(content);

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

    // 1. Search relevant knowledge from Pinecone
    const searchResults = await searchKnowledge(userMessage, userId, 5);

    // 2. Build context from search results
    const context = await buildContext(searchResults);

    // 3. Generate AI response with context
    const response = await generateResponse(userMessage, context, systemPrompt);

    logger.info("RAG chat completed", {
      contextUsed: !!context,
      responseLength: response.length,
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
    const vector = await generateEmbedding(content);

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
    const vectors = [];

    // Generate embeddings for all entries
    for (const entry of entries) {
      const vector = await generateEmbedding(entry.content);
      vectors.push({
        id: entry.id,
        values: vector,
        metadata: {
          content: entry.content,
          ...entry.metadata,
          createdAt: new Date().toISOString(),
        },
      });
    }

    // Batch upsert (max 100 per request)
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await index.upsert(batch);
    }

    logger.info("Batch knowledge stored", {
      count: entries.length,
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

/**
 * Chunk large text into smaller pieces for better vector search
 * @param text - Text to chunk
 * @param maxLength - Maximum length per chunk (default: 1000)
 * @returns Array of text chunks
 */
export const chunkText = (text: string, maxLength: number = 1000): string[] => {
  const sentences = text.split(/[.!?]+\s+/);
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim();
    if (!trimmedSentence) continue;

    if ((currentChunk + trimmedSentence).length > maxLength) {
      if (currentChunk) {
        chunks.push(currentChunk.trim());
      }
      currentChunk = trimmedSentence;
    } else {
      currentChunk += (currentChunk ? ". " : "") + trimmedSentence;
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
};

export default {
  searchKnowledge,
  buildContext,
  chatWithRAG,
  storeKnowledge,
  batchStoreKnowledge,
  deleteKnowledge,
  chunkText,
};
