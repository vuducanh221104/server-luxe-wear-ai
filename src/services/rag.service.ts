/**
 * @file rag.service.ts
 * @description RAG (Retrieval Augmented Generation) service
 * Orchestrates vector search and AI response generation
 */

import logger from "../config/logger";
import { embeddingService } from "./embedding.service";
import { vectorService } from "./vector.service";
import { defaultAIService } from "./ai.service";
import {
  getCachedEmbedding,
  getCachedSearchResults,
  getCachedAIResponse,
  getCachedTokenCount,
} from "../utils/cache";

import type { SearchResult } from "../types/knowledge";

/**
 * RAG Service
 * Combines vector search with AI generation for context-aware responses
 */
export class RAGService {
  /**
   * Chat with RAG (Retrieval Augmented Generation)
   * Retrieves relevant context from knowledge base and generates AI response
   *
   * @param userMessage - User's question or message
   * @param userId - Optional user ID for knowledge filtering
   * @param systemPrompt - System prompt for AI (default: fashion assistant)
   * @returns Promise<string> - AI-generated response with context
   */
  async chatWithRAG(
    userMessage: string,
    userId?: string,
    systemPrompt: string = "You are a helpful fashion AI assistant."
  ): Promise<string> {
    try {
      logger.info("Starting RAG chat", {
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

      // Step 3: Build context and count tokens in parallel
      const [context, contextTokens] = await Promise.all([
        vectorService.buildContextOptimized(searchResults as SearchResult[], 30000 - messageTokens),
        searchResults.length > 0
          ? getCachedTokenCount(
              (searchResults as SearchResult[]).map((r) => r.metadata.content).join(" "),
              embeddingService.countTokens.bind(embeddingService)
            )
          : Promise.resolve(0),
      ]);

      // Step 4: Generate AI response with context
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
  }
}

// Create and export singleton instance
export const ragService = new RAGService();

// Export method for backward compatibility
export const chatWithRAG = ragService.chatWithRAG.bind(ragService);

// Export default
export default ragService;
