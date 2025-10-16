/**
 * @file gemini.api.ts
 * @description Google Gemini API integration layer
 * Handles advanced API operations, error handling, retry logic, and response formatting
 */

import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import logger from "../config/logger";
import type {
  GeminiConfig,
  ApiResponse,
  StreamingChunk,
  GenerationOptions,
  StreamingOptions,
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
  private generativeModel: GenerativeModel | null = null;
  private embeddingModel: GenerativeModel | null = null;

  constructor(config: Partial<GeminiConfig> = {}) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required");
    }

    this.config = {
      apiKey,
      defaultModel: "gemini-1.5-flash",
      embeddingModel: "text-embedding-004",
      maxRetries: 3,
      retryDelay: 1000,
      timeout: 30000,
      ...config,
    };

    this.genAI = new GoogleGenerativeAI(this.config.apiKey);

    logger.info("Gemini API integration initialized", {
      defaultModel: this.config.defaultModel,
      embeddingModel: this.config.embeddingModel,
    });
  }

  /**
   * Get generative model instance with caching
   */
  private getGenerativeModel(): GenerativeModel {
    if (!this.generativeModel) {
      this.generativeModel = this.genAI.getGenerativeModel({
        model: this.config.defaultModel,
      });
    }
    return this.generativeModel;
  }

  /**
   * Get embedding model instance with caching
   */
  private getEmbeddingModel(): GenerativeModel {
    if (!this.embeddingModel) {
      this.embeddingModel = this.genAI.getGenerativeModel({
        model: this.config.embeddingModel,
      });
    }
    return this.embeddingModel;
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

        // Wait before retry (exponential backoff)
        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelay * Math.pow(2, attempt);
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

    // Don't retry on authentication, quota, or validation errors
    return (
      message.includes("api key") ||
      message.includes("quota") ||
      message.includes("invalid") ||
      message.includes("permission")
    );
  }

  /**
   * Generate text content with advanced error handling
   */
  async generateContent(
    prompt: string,
    options: GenerationOptions = {}
  ): Promise<ApiResponse<string>> {
    return this.executeWithRetry(async () => {
      const model = this.getGenerativeModel();

      const generationConfig = {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
        topK: options.topK ?? 40,
        topP: options.topP ?? 0.95,
      };

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      });

      const response = result.response;
      const text = response.text();

      if (!text || text.trim().length === 0) {
        throw new Error("Empty response from Gemini API");
      }

      return text;
    }, "generateContent");
  }

  /**
   * Generate streaming content
   */
  async *generateStreamingContent(
    prompt: string,
    options: StreamingOptions = {}
  ): AsyncGenerator<StreamingChunk> {
    try {
      const model = this.getGenerativeModel();

      const generationConfig = {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxOutputTokens ?? 2048,
      };

      logger.info("Starting streaming generation", {
        promptLength: prompt.length,
        config: generationConfig,
      });

      const result = await model.generateContentStream({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig,
      });

      let totalText = "";
      let chunkCount = 0;

      for await (const chunk of result.stream) {
        const text = chunk.text();
        totalText += text;
        chunkCount++;

        yield {
          text,
          isComplete: false,
          metadata: {
            chunkIndex: chunkCount,
            totalLength: totalText.length,
          },
        };
      }

      // Final chunk
      yield {
        text: "",
        isComplete: true,
        metadata: {
          totalChunks: chunkCount,
          totalLength: totalText.length,
        },
      };

      logger.info("Streaming generation completed", {
        totalChunks: chunkCount,
        totalLength: totalText.length,
      });
    } catch (error) {
      logger.error("Streaming generation failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });

      yield {
        text: "",
        isComplete: true,
        metadata: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }

  /**
   * Generate embeddings with batch processing
   */
  async generateEmbeddings(texts: EmbeddingInput): Promise<ApiResponse<EmbeddingOutput>> {
    const textArray = Array.isArray(texts) ? texts : [texts];
    const isSingle = !Array.isArray(texts);

    return this.executeWithRetry(async () => {
      const model = this.getEmbeddingModel();
      const embeddings: number[][] = [];

      // Process in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < textArray.length; i += batchSize) {
        const batch = textArray.slice(i, i + batchSize);

        const batchPromises = batch.map(async (text) => {
          if (!text || text.trim().length === 0) {
            throw new Error("Empty text provided for embedding");
          }

          const result = await model.embedContent(text);
          return result.embedding.values;
        });

        const batchResults = await Promise.all(batchPromises);
        embeddings.push(...batchResults);

        // Small delay between batches to respect rate limits
        if (i + batchSize < textArray.length) {
          await new Promise((resolve) => setTimeout(resolve, 100));
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
      const model = this.getGenerativeModel();
      const result = await model.countTokens(text);
      return result.totalTokens;
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

      // Generate response
      const result = await this.generateContent(prompt, {
        temperature: options.temperature,
      });

      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to generate response");
      }

      const responseData: RAGResponseData = {
        response: result.data,
      };

      // Add metadata if requested
      if (options.includeMetadata) {
        const [promptTokens, responseTokens] = await Promise.all([
          this.countTokens(prompt),
          this.countTokens(result.data),
        ]);

        responseData.metadata = {
          contextLength: context.length,
          promptTokens: promptTokens.success ? promptTokens.data || 0 : 0,
          responseTokens: responseTokens.success ? responseTokens.data || 0 : 0,
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
      const result = await this.generateContent(testPrompt);

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

    // Reset cached models if model names changed
    if (newConfig.defaultModel) {
      this.generativeModel = null;
    }
    if (newConfig.embeddingModel) {
      this.embeddingModel = null;
    }

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
