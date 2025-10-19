/**
 * @file gemini.api.ts
 * @description Google Gemini API integration layer
 * Handles advanced API operations, error handling, retry logic, and response formatting
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import logger from "../config/logger";
import type {
  GeminiConfig,
  ApiResponse,
  GenerationOptions,
  RAGOptions,
  RAGResponseData,
  HealthCheckData,
  EmbeddingInput,
  EmbeddingOutput,
} from "../types/gemini";

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
      embeddingModel: "text-embedding-004",
      // Model selection strategy
      models: {
        // Primary models
        textGeneration: "gemini-2.5-flash",
        textGenerationPro: "gemini-2.5-pro",
        embedding: "text-embedding-004",
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
    operationName: string
  ): Promise<ApiResponse<T>> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    let retries = 0;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        logger.debug(`Executing ${operationName}`, { attempt: attempt + 1 });

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
   * Generate text content with smart model selection
   */
  async generateContent(
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<ApiResponse<string>> {
    return this.executeWithRetry(async () => {
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

      // Generate content
      const result = await modelInstance.generateContent(prompt);
      const text = result.response.text();

      if (!text || text.trim().length === 0) {
        throw new Error("Empty response from Gemini API");
      }

      return text;
    }, "generateContent");
  }

  /**
   * Generate embeddings with batch processing
   */
  async generateEmbeddings(texts: EmbeddingInput): Promise<ApiResponse<EmbeddingOutput>> {
    const textArray = Array.isArray(texts) ? texts : [texts];
    const isSingle = !Array.isArray(texts);

    return this.executeWithRetry(async () => {
      const embeddings: number[][] = [];

      // Process in batches to avoid rate limits
      const batchSize = 5; // Reduced batch size for quota management
      for (let i = 0; i < textArray.length; i += batchSize) {
        const batch = textArray.slice(i, i + batchSize);

        // Sequential processing within each batch to avoid quota issues
        for (const text of batch) {
          if (!text || text.trim().length === 0) {
            throw new Error("Empty text provided for embedding");
          }

          const model = this.genAI.getGenerativeModel({ model: this.config.embeddingModel });
          const result = await model.embedContent(text);
          const embedding = result.embedding?.values || [];
          embeddings.push(embedding);

          // Small delay between requests to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 200));
        }

        // Longer delay between batches
        if (i + batchSize < textArray.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }

      return isSingle ? embeddings[0] : embeddings;
    }, "generateEmbeddings");
  }

  /**
   * Count tokens in text
   */
  async countTokens(text: string): Promise<ApiResponse<number>> {
    return this.executeWithRetry(async () => {
      const model = this.genAI.getGenerativeModel({ model: this.config.defaultModel });
      const result = await model.countTokens(text);
      return result.totalTokens || 0;
    }, "countTokens");
  }

  /**
   * Generate structured response for RAG pattern
   */
  async generateRAGResponse(
    userMessage: string,
    context: string,
    systemPrompt: string = "You are a helpful AI assistant.",
    options: RAGOptions = {}
  ): Promise<ApiResponse<RAGResponseData>> {
    return this.executeWithRetry(async () => {
      // Build structured prompt
      const prompt = `${systemPrompt}

${context ? `Context from knowledge base:\n${context}\n` : ""}

User question: ${userMessage}

Please provide a helpful and accurate response based on the context above.`;

      // Parallel: Generate response and count tokens (if metadata needed)
      const [responseResult, tokenCounts] = await Promise.all([
        this.generateContent(prompt, {
          temperature: options.temperature,
          useCase: "rag", // Use RAG-optimized model
        }),
        options.includeMetadata
          ? Promise.all([
              this.countTokens(prompt),
              this.countTokens(userMessage), // Count user message instead of response for better performance
            ])
          : Promise.resolve([
              { success: true, data: 0 },
              { success: true, data: 0 },
            ]),
      ]);

      if (!responseResult.success || !responseResult.data) {
        throw new Error(responseResult.error || "Failed to generate response");
      }

      const responseData: RAGResponseData = {
        response: responseResult.data,
      };

      // Add metadata if requested
      if (options.includeMetadata) {
        const [promptTokens, userTokens] = tokenCounts;
        responseData.metadata = {
          contextLength: context.length,
          promptTokens: promptTokens.success ? promptTokens.data || 0 : 0,
          responseTokens: userTokens.success ? userTokens.data || 0 : 0,
        };
      }

      return responseData;
    }, "generateRAGResponse");
  }

  /**
   * Health check for Gemini API
   */
  async healthCheck(): Promise<ApiResponse<HealthCheckData>> {
    return this.executeWithRetry(async () => {
      const testPrompt = "Hello";
      const result = await this.generateContent(testPrompt, { useCase: "simple" });

      if (!result.success) {
        throw new Error(result.error || "Health check failed");
      }

      return {
        status: "healthy",
        model: this.config.defaultModel,
        timestamp: new Date().toISOString(),
      };
    }, "healthCheck");
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
