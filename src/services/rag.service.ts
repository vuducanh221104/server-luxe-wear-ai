/**
 * @file rag.service.ts
 * @description RAG (Retrieval Augmented Generation) service
 * Orchestrates vector search and AI response generation
 */

import logger from "../config/logger";
import { embeddingService } from "./embedding.service";
import { vectorService } from "./vector.service";
import { defaultAIService } from "./ai.service";
import { getCachedEmbedding, getCachedSearchResults, getCachedTokenCount } from "../utils/cache";

import type { SearchResult } from "../types/knowledge";

/**
 * RAG Service
 * Combines vector search with AI generation for context-aware responses
 */
export class RAGService {
  /**
   * Stream chat with RAG (Retrieval Augmented Generation)
   * Retrieves relevant context from knowledge base and streams AI response
   *
   * @param userMessage - User's question or message
   * @param userId - Optional user ID for knowledge filtering
   * @param systemPrompt - System prompt for AI (default: fashion assistant)
   * @returns AsyncGenerator<string> - Async generator yielding text chunks
   */
  async *streamChatWithRAG(
    userMessage: string,
    userId?: string,
    systemPrompt: string = "You are a helpful fashion AI assistant."
  ): AsyncGenerator<string, void, unknown> {
    try {
      logger.info("Starting streaming RAG chat", {
        userId,
        messageLength: userMessage.length,
      });

      // Step 1: Generate embedding and count tokens in parallel
      const [queryVector, messageTokens] = await Promise.all([
        getCachedEmbedding(userMessage, embeddingService.generateEmbedding.bind(embeddingService)),
        getCachedTokenCount(userMessage, embeddingService.countTokens.bind(embeddingService)),
      ]);

      // Step 2: Search for relevant knowledge using vector
      const searchResults = await getCachedSearchResults(
        queryVector,
        userId,
        undefined, // tenantId not used in RAG chat
        5, // topK
        vectorService.searchKnowledgeWithVector.bind(vectorService)
      );

      // Step 3: Build context
      const context = await vectorService.buildContextOptimized(
        searchResults as SearchResult[],
        30000 - messageTokens
      );

      logger.info("Context prepared for streaming", {
        contextLength: context.length,
        searchResultsCount: searchResults.length,
      });

      // Step 4: Stream AI response with context
      yield* defaultAIService.streamGenerateResponse(userMessage, context, systemPrompt, userId);

      logger.info("Streaming RAG chat completed", {
        contextUsed: !!context,
        searchResultsCount: searchResults.length,
      });
    } catch (error) {
      logger.error("Streaming RAG chat failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw new Error("Failed to generate streaming AI response");
    }
  }
}

// Create and export singleton instance
export const ragService = new RAGService();

// Export method for backward compatibility
export const streamChatWithRAG = ragService.streamChatWithRAG.bind(ragService);

// Export default
export default ragService;
