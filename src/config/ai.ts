/**
 * @file ai.ts
 * @description AI Service Class - Wrapper around Gemini API integration
 * Provides both class-based and functional interfaces for AI operations
 */

import { geminiApi, GeminiApiIntegration } from "../integrations/gemini.api";
import { AIServiceConfig } from "../types";
import {
  handleAsyncOperationStrict,
  handleAsyncOperationWithFallback,
} from "../utils/errorHandler";
import {
  getCachedEmbedding,
  getCachedAIResponse,
  getCachedTokenCount,
  getCacheStats,
  clearCacheByPattern,
} from "../utils/cache";
import logger from "./logger";

// Verify API key on startup
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable");
}

/**
 * AI Service Class - Main class for AI operations
 * Provides both simple wrapper methods and direct access to Gemini API
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
   * Generate text embeddings (vectors) for Pinecone
   * @param text - Text to convert to vector
   * @returns Vector array (768 dimensions for text-embedding-004)
   */
  async generateEmbedding(text: string): Promise<number[]> {
    return handleAsyncOperationStrict(
      async () => {
        if (this.config.enableCaching) {
          // Use centralized cache utility
          return await getCachedEmbedding(text, async (text) => {
            const result = await this.geminiApi.generateEmbeddings(text);
            if (!result.success || !result.data) {
              throw new Error(result.error || "Failed to generate embedding");
            }
            return result.data as number[];
          });
        }

        // Direct call without caching
        const result = await this.geminiApi.generateEmbeddings(text);
        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to generate embedding");
        }
        return result.data as number[];
      },
      "generate text embedding",
      {
        context: { textLength: text.length, enableCaching: this.config.enableCaching },
      }
    );
  }

  /**
   * Generate AI response with context from Pinecone (RAG pattern)
   * @param userMessage - User's question/message
   * @param context - Relevant context from Pinecone knowledge base
   * @param systemPrompt - System instructions for AI behavior
   * @returns AI generated response
   */
  async generateResponse(
    userMessage: string,
    context: string,
    systemPrompt?: string
  ): Promise<string> {
    return handleAsyncOperationStrict(
      async () => {
        this.requestCount++;

        const prompt = systemPrompt || this.config.defaultSystemPrompt!;

        logger.info("Generating AI response", {
          messageLength: userMessage.length,
          contextLength: context.length,
          hasContext: !!context,
          requestCount: this.requestCount,
        });

        if (this.config.enableCaching) {
          // Use centralized cache utility
          return await getCachedAIResponse(
            userMessage,
            context,
            prompt,
            async (message, ctx, sysPrompt) => {
              const result = await this.geminiApi.generateRAGResponse(message, ctx, sysPrompt, {
                includeMetadata: true,
              });

              if (!result.success || !result.data) {
                throw new Error(result.error || "Failed to generate response");
              }

              logger.info("AI response generated", {
                responseLength: result.data.response.length,
                metadata: result.data.metadata,
                requestCount: this.requestCount,
              });

              return result.data.response;
            }
          );
        }

        // Direct call without caching
        const result = await this.geminiApi.generateRAGResponse(userMessage, context, prompt, {
          includeMetadata: true,
        });

        if (!result.success || !result.data) {
          throw new Error(result.error || "Failed to generate response");
        }

        logger.info("AI response generated", {
          responseLength: result.data.response.length,
          metadata: result.data.metadata,
          requestCount: this.requestCount,
        });

        return result.data.response;
      },
      "generate AI response",
      {
        context: {
          messageLength: userMessage.length,
          contextLength: context.length,
          requestCount: this.requestCount,
        },
      }
    );
  }

  /**
   * Count tokens in text (useful for context window management)
   * @param text - Text to count tokens
   * @returns Token count
   */
  async countTokens(text: string): Promise<number> {
    return handleAsyncOperationWithFallback(
      async () => {
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
  async healthCheck(): Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
    serviceStats: {
      requestCount: number;
      cacheStats: { hits: number; misses: number; keys: number; size: number };
      config: AIServiceConfig;
    };
  }> {
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
  getStats(): {
    requestCount: number;
    cacheStats: { hits: number; misses: number; keys: number; size: number };
    config: AIServiceConfig;
  } {
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
}

// ========================================
// SINGLETON INSTANCE FOR CONVENIENCE
// ========================================
export const defaultAIService = new AIService();

// ========================================
// FUNCTIONAL EXPORTS FOR BACKWARD COMPATIBILITY
// ========================================

/**
 * Generate text embeddings (vectors) for Pinecone
 * @param text - Text to convert to vector
 * @returns Vector array (768 dimensions for text-embedding-004)
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  return await defaultAIService.generateEmbedding(text);
};

/**
 * Generate AI response with context from Pinecone (RAG pattern)
 * @param userMessage - User's question/message
 * @param context - Relevant context from Pinecone knowledge base
 * @param systemPrompt - System instructions for AI behavior
 * @returns AI generated response
 */
export const generateResponse = async (
  userMessage: string,
  context: string,
  systemPrompt: string = "You are a helpful fashion AI assistant."
): Promise<string> => {
  return await defaultAIService.generateResponse(userMessage, context, systemPrompt);
};

/**
 * Count tokens in text (useful for context window management)
 * @param text - Text to count tokens
 * @returns Token count
 */
export const countTokens = async (text: string): Promise<number> => {
  return await defaultAIService.countTokens(text);
};

// ========================================
// RE-EXPORT GEMINI API FOR ADVANCED USAGE
// ========================================
export { geminiApi };

// ========================================
// DEFAULT EXPORT FOR MIXED USAGE
// ========================================
export default {
  // Class
  AIService,
  defaultAIService,

  // Functional methods (backward compatibility)
  generateEmbedding,
  generateResponse,
  countTokens,

  // Direct access
  geminiApi,
};
