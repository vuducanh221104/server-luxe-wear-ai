/**
 * @file ai.ts
 * @description AI Service related types and interfaces
 */

/**
 * AI Service Configuration Interface
 */
export interface AIServiceConfig {
  enableCaching?: boolean;
  defaultSystemPrompt?: string;
  maxRetries?: number;
  timeout?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  size: number;
}

/**
 * AI service statistics
 */
export interface AIServiceStats {
  requestCount: number;
  cacheStats: CacheStats;
  config: AIServiceConfig;
}

/**
 * AI health check result
 */
export interface AIHealthCheckResult {
  success: boolean;
  data?: unknown;
  error?: string;
  serviceStats: AIServiceStats;
}

/**
 * Sentiment analysis result
 */
export interface SentimentAnalysisResult {
  sentiment: "positive" | "negative" | "neutral";
  confidence: number;
  explanation: string;
}
