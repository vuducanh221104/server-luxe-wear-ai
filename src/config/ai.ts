/**
 * @file ai.ts
 * @description AI Configuration - Environment setup and configuration only
 * Contains only configuration, no service re-exports
 */

import { geminiApi } from "../integrations/gemini.api";

// Verify API key on startup
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable");
}

// ========================================
// CONFIGURATION EXPORTS
// ========================================

/**
 * Default AI service configuration
 */
export const defaultAIConfig = {
  enableCaching: true,
  defaultSystemPrompt: "You are a helpful fashion AI assistant.",
  maxRetries: 3,
  timeout: 30000,
} as const;

/**
 * AI service configuration for different environments
 */
export const aiConfigs = {
  development: {
    ...defaultAIConfig,
    enableCaching: false, // Disable caching in dev for easier debugging
  },
  production: {
    ...defaultAIConfig,
    enableCaching: true,
    timeout: 60000, // Longer timeout for production
  },
  testing: {
    ...defaultAIConfig,
    enableCaching: false,
    timeout: 10000, // Shorter timeout for tests
  },
} as const;

// ========================================
// RE-EXPORT GEMINI API FOR ADVANCED USAGE
// ========================================
export { geminiApi };

// ========================================
// DEFAULT EXPORT FOR CONVENIENCE
// ========================================
export default {
  // Configuration only
  defaultAIConfig,
  aiConfigs,

  // Direct access to Gemini API
  geminiApi,
};
