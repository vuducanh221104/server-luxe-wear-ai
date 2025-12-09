/**
 * @file gemini.ts
 * @description TypeScript types and interfaces for Gemini API integration
 */

/**
 * Gemini API configuration
 */
export interface GeminiConfig {
  apiKey: string;
  defaultModel: string;
  embeddingModel: string;
  models?: {
    textGeneration: string;
    textGenerationPro: string;
    embedding: string;
    aqa: string;
    fallback: string;
  };
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

/**
 * API response wrapper for all Gemini operations
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  retries?: number;
  duration?: number;
}

/**
 * Streaming response chunk for real-time generation
 */
export interface StreamingChunk {
  text: string;
  isComplete: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Options for content generation
 */
export interface GenerationOptions {
  temperature?: number;
  maxOutputTokens?: number;
  topK?: number;
  topP?: number;
  model?: string;
  useCase?: "rag" | "simple" | "complex" | "attributed";
}

/**
 * Options for streaming content generation
 */
export interface StreamingOptions {
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Options for RAG response generation
 */
export interface RAGOptions {
  temperature?: number;
}

/**
 * Health check response data
 */
export interface HealthCheckData {
  status: string;
  model: string;
  timestamp: string;
}

/**
 * Gemini model types
 */
export type GeminiModelType =
  | "gemini-1.5-flash"
  | "gemini-1.5-pro"
  | "gemini-pro"
  | "text-embedding-004"
  | "gemini-embedding-001";

/**
 * Error types that should not be retried
 */
export enum NonRetryableErrorType {
  API_KEY = "api_key",
  QUOTA = "quota",
  INVALID = "invalid",
  PERMISSION = "permission",
}

/**
 * Gemini API operation types for logging
 */
export type GeminiOperation =
  | "streamGenerateContent"
  | "streamGenerateRAGResponse"
  | "countTokens"
  | "healthCheck";
