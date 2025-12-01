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
   * @param tenantId - Optional tenant ID for knowledge filtering
   * @returns Promise<string> - AI-generated response with context
   */
  async chatWithRAG(
    userMessage: string,
    userId?: string,
    systemPrompt: string = "You are a helpful fashion AI assistant.",
    tenantId?: string,
    agentId?: string | null
  ): Promise<string> {
    try {
      logger.info("Starting RAG chat", {
        userId,
        tenantId,
        agentId,
        messageLength: userMessage.length,
      });

      // Step 1: Generate embedding and count tokens in parallel
      const [queryVector, messageTokens] = await Promise.all([
        getCachedEmbedding(userMessage, embeddingService.generateEmbedding.bind(embeddingService)),
        getCachedTokenCount(userMessage, embeddingService.countTokens.bind(embeddingService)),
      ]);

      // Step 2: Search for relevant knowledge using vector (with agentId filter)
      // Pass agentId to cache key to ensure proper cache invalidation
      let searchResults = await getCachedSearchResults(
        queryVector,
        userId,
        tenantId, // Pass tenantId for multi-tenancy support
        5, // topK
        (vector: number[], uid?: string, tid?: string, k?: number, aid?: string | null) =>
          vectorService.searchKnowledgeWithVector(vector, uid, tid, k, aid),
        agentId // Pass agentId for cache key
      );

      // Fallback: If no results found with agentId filter, try without agentId filter
      // This helps when knowledge is linked to agent but vector search hasn't indexed it yet
      if (searchResults.length === 0 && agentId) {
        logger.info("No results with agentId filter, trying fallback search without agentId", {
          agentId,
          userId,
          tenantId,
        });
        
        const fallbackResults = await vectorService.searchKnowledgeWithVector(
          queryVector,
          userId,
          tenantId,
          5,
          null // Search all knowledge, not just agent-specific
        );
        
        // Filter to only include knowledge linked to this agent or general knowledge
        const filteredFallback = fallbackResults.filter((r: any) => {
          const metaAgentId = r.metadata?.agentId;
          return metaAgentId === agentId || metaAgentId === null || metaAgentId === undefined || metaAgentId === "";
        });
        
        if (filteredFallback.length > 0) {
          logger.info("Fallback search found results", {
            agentId,
            fallbackCount: filteredFallback.length,
          });
          searchResults = filteredFallback;
        }
      }

      logger.info("Knowledge search results", {
        agentId,
        userId,
        tenantId,
        searchResultsCount: searchResults.length,
        userMessage: userMessage.substring(0, 100), // First 100 chars for debugging
        results: searchResults.map((r: any) => ({
          id: r.id,
          score: r.score,
          hasContent: !!r.metadata?.content,
          contentLength: r.metadata?.content?.length || 0,
          contentPreview: r.metadata?.content?.substring(0, 100) || "", // First 100 chars
          agentId: r.metadata?.agentId,
          title: r.metadata?.title,
          fileName: r.metadata?.fileName,
        })),
      });

      // Log warning if no results found but agentId is provided
      if (searchResults.length === 0 && agentId) {
        logger.warn("No knowledge found for agent query", {
          agentId,
          userId,
          tenantId,
          userMessage: userMessage.substring(0, 200),
          suggestion: "Check if knowledge was uploaded with this agentId and if vector storage completed",
        });
      }

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

      if (!context || context.trim().length === 0) {
        logger.warn("No context found from knowledge base", {
          agentId,
          userId,
          tenantId,
          searchResultsCount: searchResults.length,
          userMessage: userMessage.substring(0, 100), // Log first 100 chars for debugging
        });
        
        // If no context found, still generate response but inform AI that no knowledge was found
        // This allows AI to respond appropriately
        const noContextMessage = context || "";
        const enhancedSystemPrompt = `${systemPrompt}\n\n[NOTE: No relevant knowledge was found in the knowledge base for this query. Please respond based on your general knowledge, but acknowledge if the question is outside your expertise.]`;
        
        const response = await getCachedAIResponse(
          userMessage,
          noContextMessage,
          enhancedSystemPrompt,
          defaultAIService.generateResponse.bind(defaultAIService)
        );
        
        logger.info("RAG chat completed (no context)", {
          agentId,
          contextUsed: false,
          responseLength: response.length,
        });
        
        return response;
      }

      // Step 4: Generate AI response with context
      const response = await getCachedAIResponse(
        userMessage,
        context,
        systemPrompt,
        defaultAIService.generateResponse.bind(defaultAIService)
      );

      logger.info("RAG chat completed", {
        agentId,
        contextUsed: !!context,
        contextLength: context?.length || 0,
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
