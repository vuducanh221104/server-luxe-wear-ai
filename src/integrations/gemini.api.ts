/**
 * @file gemini.api.ts
 * @description Google Gemini API integration layer
 * Handles advanced API operations, error handling, retry logic, and response formatting
 * Updated for multi-tenancy support with tenant-aware logging
 */

import { GoogleGenerativeAI, Content, Part, FunctionDeclaration } from "@google/generative-ai";
import logger from "../config/logger";
import type { GeminiConfig, GenerationOptions, RAGOptions, HealthCheckData } from "../types/gemini";
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
  ): Promise<T> {
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

        return result;
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

    throw lastError || new Error("Unknown error");
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: Error): boolean {
    const message = error.message.toLowerCase();
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
   * Generate text content with smart model selection (streaming/async iterator only)
   */
  async *generateContent(
    prompt: string,
    options: GenerationOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const model = options.model || this.selectModel(options.useCase);
    const modelInstance = this.genAI.getGenerativeModel({
      model: model,
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxOutputTokens || 8192,
        topK: options.topK || 40,
        topP: options.topP || 0.95,
      },
    });
    try {
      const result = await modelInstance.generateContentStream({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
      });

      if (result && result.stream) {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            yield text;
          }
        }
      } else {
        throw new Error("Gemini generateContentStream returned no stream");
      }
    } catch (err) {
      logger.error("Gemini generateContent streaming error", err);
      throw err;
    }
  }

  /**
   * Count tokens in text
   */
  async countTokens(text: string, tenantContext?: TenantContext): Promise<number> {
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
   * Generate structured response for RAG pattern (streaming only)
   */
  async *generateRAGResponse(
    userMessage: string,
    context: string,
    systemPrompt = "You are a helpful AI assistant.",
    options: RAGOptions = {}
  ): AsyncGenerator<string, void, unknown> {
    const prompt = `${systemPrompt}\n\n${context ? `Context from knowledge base:\n${context}\n` : ""}User question: ${userMessage}\n\nPlease provide a helpful and accurate response based on the context above.`;
    for await (const chunk of this.generateContent(prompt, {
      temperature: options.temperature,
      useCase: "rag",
    })) {
      yield chunk;
    }
  }

  /**
   * Health check for Gemini API
   */
  async healthCheck(): Promise<HealthCheckData> {
    try {
      const testPrompt = "Hello";
      const gen = this.generateContent(testPrompt, { useCase: "simple" });
      // Lấy chunk đầu tiên để xác nhận health
      const { value } = await gen.next();
      if (value) {
        return {
          status: "healthy",
          model: this.config.defaultModel,
          timestamp: new Date().toISOString(),
        };
      } else {
        throw new Error("Health check: No response");
      }
    } catch (err) {
      logger.error("Gemini healthCheck error", err);
      return {
        status: "unhealthy",
        model: this.config.defaultModel,
        timestamp: new Date().toISOString(),
      };
    }
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

  /**
   * Generate content with function calling support
   * Enables AI to call tools during conversation
   */
  async generateContentWithTools(
    prompt: string,
    tools: FunctionDeclaration[],
    options: GenerationOptions = {},
    tenantContext?: TenantContext
  ): Promise<{
    text?: string;
    functionCalls?: Array<{ name: string; args: Record<string, unknown> }>;
    isComplete: boolean;
  }> {
    return this.executeWithRetry(
      async () => {
        const model = options.model || this.selectModel(options.useCase);

        // Get the model instance with tools
        const modelInstance = this.genAI.getGenerativeModel({
          model: model,
          generationConfig: {
            temperature: options.temperature || 0.7,
            maxOutputTokens: options.maxOutputTokens || 8192,
            topK: options.topK || 40,
            topP: options.topP || 0.95,
          },
          tools:
            tools.length > 0
              ? [{ functionDeclarations: tools as FunctionDeclaration[] }]
              : undefined,
        });

        logger.info("Gemini generateContentWithTools", {
          model,
          toolsCount: tools.length,
          toolsNames: tools.map((t) => t.name),
          promptPreview: prompt.substring(0, 200) + "...",
          toolsJson: JSON.stringify(tools),
        });

        // Generate content
        const result = await modelInstance.generateContent(prompt);
        const response = result.response;

        // Check if there are function calls
        const functionCalls = response.functionCalls();

        if (functionCalls && functionCalls.length > 0) {
          // AI wants to call tools
          return {
            functionCalls: functionCalls.map((fc) => ({
              name: fc.name,
              args: fc.args as Record<string, unknown>,
            })),
            isComplete: false,
          };
        }

        // Normal text response
        const candidate = response.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        // Fix for SDK issue where text might be returned as function source code
        let text = "";
        if (part && "text" in part) {
          const p = part as { text: string | (() => string) };
          if (typeof p.text === "function") {
            text = p.text();
          } else {
            text = String(p.text);
          }
        }
        return {
          text,
          isComplete: true,
        };
      },
      "generateContentWithTools",
      tenantContext
    );
  }

  /**
   * Continue conversation after function call results
   * Sends function results back to AI for final response
   */
  async continueWithFunctionResults(
    chatHistory: Content[],
    functionResults: Array<{ name: string; response: Record<string, unknown> }>,
    tools: FunctionDeclaration[],
    options: GenerationOptions = {},
    tenantContext?: TenantContext
  ): Promise<string> {
    return this.executeWithRetry(
      async () => {
        const model = options.model || this.selectModel(options.useCase);

        const modelInstance = this.genAI.getGenerativeModel({
          model: model,
          generationConfig: {
            temperature: options.temperature || 0.7,
            maxOutputTokens: options.maxOutputTokens || 5000,
          },
          tools:
            tools.length > 0
              ? [{ functionDeclarations: tools as unknown as FunctionDeclaration[] }]
              : undefined,
        });

        // Start chat with history
        const chat = modelInstance.startChat({
          history: chatHistory,
        });

        // Send function results
        const functionResponseParts: Part[] = functionResults.map((fr) => ({
          functionResponse: {
            name: fr.name,
            response: fr.response,
          },
        }));

        const result = await chat.sendMessage(functionResponseParts);
        const candidate = result.response.candidates?.[0];
        const part = candidate?.content?.parts?.[0];

        // Fix for SDK issue where text might be returned as function source code
        let text = "";
        if (part && "text" in part) {
          const p = part as { text: string | (() => string) };
          if (typeof p.text === "function") {
            text = p.text();
          } else {
            text = String(p.text);
          }
        }

        if (!text || text.trim().length === 0) {
          throw new Error("Empty response from Gemini API after function results");
        }

        return text;
      },
      "continueWithFunctionResults",
      tenantContext
    );
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
