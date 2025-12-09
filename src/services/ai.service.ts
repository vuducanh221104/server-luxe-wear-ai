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
import { functionCallingService } from "../tools";
import type { ToolExecutionContext, FunctionCallingResult } from "../tools";
import type {
  AIServiceConfig,
  AIServiceStats,
  AIHealthCheckResult,
  SentimentAnalysisResult,
} from "../types";

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

  async *generateResponseStream(
    userMessage: string,
    context: string,
    systemPrompt?: string
  ): AsyncGenerator<string, void, unknown> {
    this.requestCount++; // Track request count
    const prompt = systemPrompt || this.config.defaultSystemPrompt!;
    const fullPrompt = `${prompt}\n\nIMPORTANT: You have access to the following context from the user's knowledge base. If the user's question can be answered using this context, you MUST answer it based on the context, even if it falls outside the scope of your original instructions or persona. The context provided below is trusted and belongs to the user/agent.\n\n${context ? `Context from KB:\n${context}\n` : ""}User: ${userMessage}\n\n[IMPORTANT: Keep response focused and under 2000 words. Be detailed but concise.]`;
    for await (const chunk of this.geminiApi.generateContent(fullPrompt)) {
      yield chunk;
    }
  }

  async generateResponse(
    userMessage: string,
    context: string,
    systemPrompt?: string
  ): Promise<string> {
    let result = "";
    for await (const chunk of this.generateResponseStream(userMessage, context, systemPrompt)) {
      result += chunk;
    }
    return result;
  }

  /**
   * Count tokens in text with caching
   * @param text - Text to count tokens
   * @returns Token count
   */
  async countTokens(text: string): Promise<number> {
    return handleAsyncOperationWithFallback(
      async () => {
        logger.debug("Counting tokens", {
          textLength: text.length,
          enableCaching: this.config.enableCaching,
        });

        if (this.config.enableCaching) {
          // Use centralized cache utility
          return await getCachedTokenCount(text, async (text) => {
            const result = await this.geminiApi.countTokens(text);
            return typeof result === "number" ? result : 0;
          });
        }

        // Direct call without caching
        const result = await this.geminiApi.countTokens(text);
        return typeof result === "number" ? result : 0;
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
          success: true,
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
   * Analyze text sentiment
   * @param text - Text to analyze
   * @param userId - User ID for logging
   * @returns Sentiment analysis result
   */
  async analyzeSentiment(text: string, userId?: string): Promise<SentimentAnalysisResult> {
    return handleAsyncOperationStrict(async () => {
      logger.info("Analyzing sentiment", {
        textLength: text.length,
        userId,
      });

      const prompt = `Analyze the sentiment of the following text and respond with JSON format:
      {
        "sentiment": "positive|negative|neutral",
        "confidence": 0.0-1.0,
        "explanation": "brief explanation"
      }

      Text: ${text}`;

      const response = await this.generateResponse(text, "", prompt);

      try {
        const result = JSON.parse(response);
        return {
          sentiment: result.sentiment,
          confidence: result.confidence,
          explanation: result.explanation,
        };
      } catch (error) {
        logger.error("Failed to parse sentiment analysis", { error, response });
        throw new Error("Failed to analyze sentiment");
      }
    }, "analyze sentiment");
  }

  /**
   * Extract keywords from text
   * @param text - Text to extract keywords from
   * @param maxKeywords - Maximum number of keywords
   * @param userId - User ID for logging
   * @returns Array of keywords
   */
  async extractKeywords(
    text: string,
    maxKeywords: number = 10,
    userId?: string
  ): Promise<string[]> {
    return handleAsyncOperationStrict(async () => {
      logger.info("Extracting keywords", {
        textLength: text.length,
        maxKeywords,
        userId,
      });

      const prompt = `Extract the top ${maxKeywords} most important keywords from the following text. Return only the keywords separated by commas, no explanations:

      Text: ${text}`;

      const response = await this.generateResponse(text, "", prompt);

      if (typeof response !== "string") return [];
      return response
        .split(",")
        .map((keyword: string) => keyword.trim())
        .filter((keyword: string) => keyword.length > 0)
        .slice(0, maxKeywords);
    }, "extract keywords");
  }

  /**
   * Summarize text
   * @param text - Text to summarize
   * @param maxLength - Maximum length of summary
   * @param userId - User ID for logging
   * @returns Text summary
   */
  async summarizeText(text: string, maxLength: number = 200, userId?: string): Promise<string> {
    return handleAsyncOperationStrict(async () => {
      logger.info("Summarizing text", {
        textLength: text.length,
        maxLength,
        userId,
      });

      const prompt = `Summarize the following text in maximum ${maxLength} characters. Focus on the main points:

      Text: ${text}`;

      return await this.generateResponse(text, "", prompt);
    }, "summarize text");
  }

  /**
   * Translate text to another language
   * @param text - Text to translate
   * @param targetLanguage - Target language
   * @param userId - User ID for logging
   * @returns Translated text
   */
  async translateText(text: string, targetLanguage: string, userId?: string): Promise<string> {
    return handleAsyncOperationStrict(async () => {
      logger.info("Translating text", {
        textLength: text.length,
        targetLanguage,
        userId,
      });

      const prompt = `Translate the following text to ${targetLanguage}. Return only the translation, no explanations:

      Text: ${text}`;

      return await this.generateResponse(text, "", prompt);
    }, "translate text");
  }

  /**
   * Generate AI response with tool calling capability
   * Enables AI to search knowledge base, trigger webhooks, etc.
   * @param user Message - User's message/question
   * @param context - Tool execution context (agent, user, tenant info)
   * @param systemPrompt - System instructions for AI behavior
   * @param enabledTools - List of tool names to enable for this request
   * @returns Function calling result with AI response and tools used
   */
  async generateResponseWithTools(
    userMessage: string,
    context: ToolExecutionContext,
    systemPrompt?: string,
    enabledTools?: string[]
  ): Promise<FunctionCallingResult> {
    return handleAsyncOperationStrict(async () => {
      logger.info("Generating response with tools", {
        agentId: context.agentId,
        tenantId: context.tenantId,
        enabledTools: enabledTools?.length || "all",
      });

      const prompt =
        systemPrompt || this.config.defaultSystemPrompt || "You are a helpful AI assistant.";

      const result = await functionCallingService.chatWithTools(
        userMessage,
        context,
        prompt,
        enabledTools,
        5 // Max iterations
      );

      logger.info("Response with tools completed", {
        agentId: context.agentId,
        toolsCalled: result.toolsCalled,
        executionTime: result.executionTime,
      });

      return result;
    }, "generate response with tools");
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================
export const defaultAIService = new AIService();

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
// DEFAULT EXPORT
// ========================================
export default {
  AIService,
  defaultAIService,
  generateResponse,
  countTokens,
};
