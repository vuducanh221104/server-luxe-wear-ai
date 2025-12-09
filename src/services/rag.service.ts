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
  getCachedTokenCount,
} from "../utils/cache";

import type { SearchResult } from "../types/knowledge";

/**
 * RAG Service
 * Combines vector search with AI generation for context-aware responses
 */
export class RAGService {
  /**
   * Streaming RAG chat - từng chunk cho AI streaming
   */
  async *chatWithRAGStream(
    userMessage: string,
    userId?: string,
    systemPrompt: string = "You are a helpful fashion AI assistant."
  ): AsyncGenerator<string, void, unknown> {
    logger.info("Starting RAG chat (stream)", { userId, messageLength: userMessage.length });
    // Step 1: Embedding và tokens
    const [queryVector, messageTokens] = await Promise.all([
      getCachedEmbedding(userMessage, embeddingService.generateEmbedding.bind(embeddingService)),
      getCachedTokenCount(userMessage, embeddingService.countTokens.bind(embeddingService)),
    ]);
    // Step 2: Search vector
    const searchResults = await getCachedSearchResults(
      queryVector,
      userId,
      undefined,
      5,
      vectorService.searchKnowledgeWithVector.bind(vectorService)
    );
    // Step 3: Build context
    const [context, _] = await Promise.all([
      vectorService.buildContextOptimized(searchResults as SearchResult[], 30000 - messageTokens),
      Promise.resolve(0),
    ]);
    // Step 4: AI streaming
    const prompt = `${systemPrompt}\n\n${context ? `Context from KB:\n${context}\n` : ""}User: ${userMessage}\n\n[IMPORTANT: Keep response focused and under 2000 words. Be detailed but concise.]`;
    for await (const chunk of defaultAIService.gemini.generateContent(prompt, {
      useCase: "rag",
      temperature: 0.7,
    })) {
      yield chunk;
    }
  }
}

// Create and export singleton instance
export const ragService = new RAGService();

// Export default
export default ragService;

// Thêm export cho hàm mới
export const chatWithRAGStream = ragService.chatWithRAGStream.bind(ragService);
