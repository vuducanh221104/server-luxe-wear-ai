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
