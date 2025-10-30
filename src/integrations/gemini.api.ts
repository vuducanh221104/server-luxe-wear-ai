/**
 * @file gemini.api.ts
 * @description Google Gemini API integration layer
 * Handles advanced API operations, error handling, retry logic, and response formatting
 * Updated for multi-tenancy support with tenant-aware logging
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "../config/logger";
import type {
  GeminiConfig,
  ApiResponse,
  GenerationOptions,
  RAGOptions,
  HealthCheckData,
} from "../types/gemini";
import type { TenantContext } from "../types/tenant";

/**
 * Gemini API integration class
 */
export class GeminiApiIntegration {
  private genAI: GoogleGenerativeAI;
  private config: GeminiConfig;

  constructor(config: Partial<GeminiConfig> = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    this.config = {
      apiKey,
      defaultModel: "gemini-2.5-flash",
      embeddingModel: "gemini-embedding-001",
      // Model selection strategy
      models: {
        // Primary models
        textGeneration: "gemini-2.5-flash",
        textGenerationPro: "gemini-2.5-pro",
        embedding: "gemini-embedding-001",
        // Specialized models
        aqa: "aqa", // For attributed question answering
        // Fallback models
        fallback: "gemini-2.0-flash-001",
      },
      maxRetries: 3,
      retryDelay: 2000, // Increased delay for quota handling
      timeout: 30000, // Increased timeout
      ...config,
    };

    this.genAI = new GoogleGenerativeAI(this.config.apiKey);

    logger.info("Gemini API integration initialized", {
      defaultModel: this.config.defaultModel,
      embeddingModel: this.config.embeddingModel,
    });
  }

  /**
   * Execute API call with retry logic and error handling
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string,
    tenantContext?: TenantContext
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let retries = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.debug(`Executing ${operationName}`, {
          attempt: attempt + 1,
          tenantId: tenantContext?.id,
        });

        const result = await Promise.race([
          operation(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Operation timeout")), this.config.timeout)
          ),
        ]);

        const duration = Date.now() - startTime;

        logger.info(`${operationName} completed successfully`, {
          duration,
          retries: attempt,
          tenantId: tenantContext?.id,
        });

        return {
          success: true,
          data: result,
          retries: attempt,
          duration,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries = attempt;

        logger.warn(`${operationName} failed`, {
          attempt: attempt + 1,
          error: lastError.message,
          willRetry: attempt < this.config.maxRetries,
          tenantId: tenantContext?.id,
        });

        // Don't retry on certain errors
        if (this.isNonRetryableError(lastError)) {
          break;
        }

        // Wait before retry (exponential backoff with special handling for quota)
        if (attempt < this.config.maxRetries) {
          let delay = this.config.retryDelay * Math.pow(2, attempt);

          // Special handling for quota errors
          if (this.isQuotaError(lastError)) {
            delay = this.extractRetryDelay(lastError);
            logger.warn(`Quota error detected, waiting ${delay}ms before retry`, {
              attempt: attempt + 1,
              error: lastError.message,
              tenantId: tenantContext?.id,
            });
          }

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    const duration = Date.now() - startTime;

    logger.error(`${operationName} failed after ${retries + 1} attempts`, {
      duration,
      retries,
      error: lastError?.message,
      tenantId: tenantContext?.id,
    });

    return {
      success: false,
      error: lastError?.message || "Unknown error",
      retries,
      duration,
    };
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();

    // Don't retry on authentication or permission errors
    // But allow retry for quota errors with longer delay
    return (
      message.includes("api key") ||
      message.includes("invalid") ||
      message.includes("permission") ||
      message.includes("not found")
    );
  }

  /**
   * Check if error is quota related and needs special handling
   */
  private isQuotaError(error: Error): boolean {
    const message = error.message.toLowerCase();
    return message.includes("quota") || message.includes("rate limit");
  }

  /**
   * Extract retry delay from quota error message
   */
  private extractRetryDelay(error: Error): number {
    const message = error.message;
    const retryMatch = message.match(/retry in (\d+(?:\.\d+)?)s/i);
    if (retryMatch) {
      return Math.ceil(parseFloat(retryMatch[1]) * 1000); // Convert to milliseconds
    }
    return this.config.retryDelay * 2; // Default longer delay for quota
  }

  /**
   * Smart model selection based on use case
   */
  private selectModel(useCase: "rag" | "simple" | "complex" | "attributed" = "rag"): string {
    const models = this.config.models;
    if (!models) {
      return this.config.defaultModel; // Fallback to default
    }

    switch (useCase) {
      case "rag":
        return models.textGeneration; // gemini-2.5-flash
      case "complex":
        return models.textGenerationPro; // gemini-2.5-pro
      case "attributed":
        return models.aqa; // aqa for source attribution
      case "simple":
        return models.fallback; // gemini-2.0-flash-001
      default:
        return models.textGeneration;
    }
  }

  /**
   * Count tokens in text
   */
  async countTokens(text: string, tenantContext?: TenantContext): Promise<ApiResponse<number>> {
    return this.executeWithRetry(
      async () => {
        const model = this.genAI.getGenerativeModel({ model: this.config.defaultModel });
        const result = await model.countTokens(text);
        return result.totalTokens || 0;
      },
      "countTokens",
      tenantContext
    );
  }

  /**
   * Stream generate content with smart model selection
   * @param prompt - The prompt to generate content from
   * @param options - Generation options
   * @param tenantContext - Tenant context for logging
   * @returns Async generator yielding text chunks
   */
  async *streamGenerateContent(
    prompt: string,
    options: GenerationOptions = {},
    tenantContext?: TenantContext
  ): AsyncGenerator<string, void, unknown> {
    const startTime = Date.now();
    const operationName = "streamGenerateContent";

    try {
      logger.debug(`Executing ${operationName}`, {
        tenantId: tenantContext?.id,
      });

      const model = options.model || this.selectModel(options.useCase);

      // Get the model instance
      const modelInstance = this.genAI.getGenerativeModel({
        model: model,
        generationConfig: {
          temperature: options.temperature || 0.7,
          maxOutputTokens: options.maxOutputTokens || 8192,
          topK: options.topK || 40,
          topP: options.topP || 0.95,
        },
      });

      // Generate content with streaming
      const result = await modelInstance.generateContentStream(prompt);

      // Stream chunks
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text && text.trim().length > 0) {
          yield text;
        }
      }

      const duration = Date.now() - startTime;

      logger.info(`${operationName} completed successfully`, {
        duration,
        tenantId: tenantContext?.id,
      });
    } catch (error) {
      const lastError = error instanceof Error ? error : new Error(String(error));
      const duration = Date.now() - startTime;

      logger.error(`${operationName} failed`, {
        duration,
        error: lastError.message,
        tenantId: tenantContext?.id,
      });

      throw lastError;
    }
  }

  /**
   * Stream generate structured response for RAG pattern
   * @param userMessage - User's message
   * @param context - Context from knowledge base
   * @param systemPrompt - System instructions
   * @param options - RAG options
   * @param tenantContext - Tenant context for logging
   * @returns Async generator yielding text chunks
   */
  async *streamGenerateRAGResponse(
    userMessage: string,
    context: string,
    systemPrompt: string = "You are a helpful AI assistant.",
    options: RAGOptions = {},
    tenantContext?: TenantContext
  ): AsyncGenerator<string, void, unknown> {
    // Build structured prompt
    const prompt = `${systemPrompt}

${context ? `Context from knowledge base:\n${context}\n` : ""}

User question: ${userMessage}

Please provide a helpful and accurate response based on the context above.`;

    // Stream the response
    yield* this.streamGenerateContent(
      prompt,
      {
        temperature: options.temperature,
        useCase: "rag",
      },
      tenantContext
    );
  }

  /**
   * Health check for Gemini API
   */
  async healthCheck(tenantContext?: TenantContext): Promise<ApiResponse<HealthCheckData>> {
    return this.executeWithRetry(
      async () => {
        const testPrompt = "Hello";

        // Test by generating a simple streaming response
        const model = this.genAI.getGenerativeModel({
          model: this.selectModel("simple"),
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 100,
          },
        });

        const result = await model.generateContentStream(testPrompt);
        let hasContent = false;

        // Check if streaming works
        for await (const chunk of result.stream) {
          if (chunk.text()) {
            hasContent = true;
            break;
          }
        }

        if (!hasContent) {
          throw new Error("Health check failed - no content received");
        }

        return {
          status: "healthy",
          model: this.config.defaultModel,
          timestamp: new Date().toISOString(),
        };
      },
      "healthCheck",
      tenantContext
    );
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<GeminiConfig>): void {
    this.config = { ...this.config, ...newConfig };

    logger.info("Gemini API configuration updated", newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<GeminiConfig> {
    return { ...this.config };
  }
}

/**
 * Default Gemini API integration instance
 */
export const geminiApi = new GeminiApiIntegration();

/**
 * Create new Gemini API integration instance with custom config
 */
export const createGeminiApi = (config: Partial<GeminiConfig>): GeminiApiIntegration => {
  return new GeminiApiIntegration(config);
};

export default geminiApi;
