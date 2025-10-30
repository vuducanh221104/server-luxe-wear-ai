/**
 * @file ai.service.ts
 * @description AI Service - High-level AI operations and business logic
 * Provides service layer for AI functionality with caching, error handling, and business rules
 */

import { geminiApi, GeminiApiIntegration } from "../integrations/gemini.api";
import logger from "../config/logger";
import {
  handleAsyncOperationStrict,
  handleAsyncOperationWithFallback,
} from "../utils/errorHandler";
import { getCachedTokenCount, getCacheStats, clearCacheByPattern } from "../utils/cache";
import type { AIServiceConfig, AIServiceStats, AIHealthCheckResult } from "../types";

/**
 * AI Service Class
 * Service layer for AI operations with business logic and data persistence
 */
export class AIService {
  private geminiApi: GeminiApiIntegration;
  private config: AIServiceConfig;
  private requestCount = 0;

  constructor(geminiInstance?: GeminiApiIntegration, config: AIServiceConfig = {}) {
    this.geminiApi = geminiInstance || geminiApi;
    this.config = {
      enableCaching: true,
      defaultSystemPrompt: "You are a helpful fashion AI assistant.",
      maxRetries: 3,
      timeout: 30000,
      ...config,
    };

    logger.info("AIService initialized", {
      enableCaching: this.config.enableCaching,
      defaultSystemPrompt: this.config.defaultSystemPrompt,
    });
  }

  /**
   * Count tokens in text with caching
   * @param text - Text to count tokens
   * @param userId - User ID for logging and caching
   * @returns Token count
   */
  async countTokens(text: string, userId?: string): Promise<number> {
    return handleAsyncOperationWithFallback(
      async () => {
        logger.debug("Counting tokens", {
          textLength: text.length,
          userId,
          enableCaching: this.config.enableCaching,
        });

        if (this.config.enableCaching) {
          // Use centralized cache utility
          return await getCachedTokenCount(text, async (text) => {
            const result = await this.geminiApi.countTokens(text);
            return result.success ? result.data || 0 : 0;
          });
        }

        // Direct call without caching
        const result = await this.geminiApi.countTokens(text);
        return result.success ? result.data || 0 : 0;
      },
      "count tokens",
      0, // Fallback to 0 if fails
      {
        context: { textLength: text.length, enableCaching: this.config.enableCaching },
      }
    );
  }

  /**
   * Health check for AI service
   * @returns Health status
   */
  async healthCheck(): Promise<AIHealthCheckResult> {
    return handleAsyncOperationStrict(
      async () => {
        const result = await this.geminiApi.healthCheck();
        const cacheStats = getCacheStats();

        return {
          ...result,
          serviceStats: {
            requestCount: this.requestCount,
            cacheStats,
            config: this.config,
          },
        };
      },
      "AI service health check",
      {
        context: {
          requestCount: this.requestCount,
          cacheStats: getCacheStats(),
        },
      }
    );
  }

  /**
   * Get direct access to Gemini API for advanced usage
   * @returns GeminiApiIntegration instance
   */
  get gemini(): GeminiApiIntegration {
    return this.geminiApi;
  }

  /**
   * Get service statistics
   * @returns Service stats
   */
  getStats(): AIServiceStats {
    return {
      requestCount: this.requestCount,
      cacheStats: getCacheStats(),
      config: this.config,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    // Clear all AI-related cache using pattern matching
    const clearedEmbeddings = clearCacheByPattern("embedding:");
    const clearedResponses = clearCacheByPattern("ai_response:");
    const clearedTokens = clearCacheByPattern("tokens:");

    logger.info("AI service cache cleared", {
      clearedEmbeddings,
      clearedResponses,
      clearedTokens,
      totalCleared: clearedEmbeddings + clearedResponses + clearedTokens,
    });
  }

  /**
   * Update service configuration
   * @param newConfig - New configuration
   */
  updateConfig(newConfig: Partial<AIServiceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info("AI service configuration updated", newConfig);
  }

  /**
   * Get current configuration
   * @returns Current configuration
   */
  getConfig(): Readonly<AIServiceConfig> {
    return { ...this.config };
  }

  /**
   * Stream generate AI response with context and caching
   * @param userMessage - User's message
   * @param context - Context from knowledge base
   * @param systemPrompt - System instructions
   * @param userId - User ID for logging
   * @returns Async generator yielding text chunks
   */
  async *streamGenerateResponse(
    userMessage: string,
    context: string,
    systemPrompt?: string,
    userId?: string
  ): AsyncGenerator<string, void, unknown> {
    this.requestCount++;
    const prompt = systemPrompt || this.config.defaultSystemPrompt!;

    logger.info("Streaming AI response", {
      messageLength: userMessage.length,
      contextLength: context.length,
      userId,
      hasContext: !!context,
      requestCount: this.requestCount,
    });

    // Stream the response (no caching for streaming)
    yield* this.geminiApi.streamGenerateRAGResponse(userMessage, context, prompt);

    logger.info("Streaming AI response completed", {
      requestCount: this.requestCount,
    });
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================
export const defaultAIService = new AIService();

/**
 * Count tokens in text (useful for context window management)
 * @param text - Text to count tokens
 * @returns Token count
 */
export const countTokens = async (text: string): Promise<number> => {
  return await defaultAIService.countTokens(text);
};

/**
 * Count tokens with caching
 */
export const countTokensWithCache = async (text: string, userId?: string): Promise<number> => {
  return await defaultAIService.countTokens(text, userId);
};

// ========================================
// DEFAULT EXPORT
// ========================================
export default {
  AIService,
  defaultAIService,

  // Functional methods
  countTokens,
  countTokensWithCache,
};
