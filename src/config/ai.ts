/**
 * @file ai.ts
 * @description Google Gemini AI configuration - Simplified wrapper around integration layer
 * This file provides backward compatibility while delegating to the new integration layer
 */

import { geminiApi } from "../integrations/gemini.api";
import logger from "./logger";

// Verify API key on startup
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
if (!GEMINI_API_KEY) {
  throw new Error("Missing GEMINI_API_KEY environment variable");
}

/**
 * Generate text embeddings (vectors) for Pinecone
 * @param text - Text to convert to vector
 * @returns Vector array (768 dimensions for text-embedding-004)
 */
export const generateEmbedding = async (text: string): Promise<number[]> => {
  try {
    const result = await geminiApi.generateEmbeddings(text);

    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to generate embedding");
    }

    return result.data as number[];
  } catch (error) {
    logger.error("Failed to generate embedding", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to generate text embedding");
  }
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
  try {
    logger.info("Generating AI response", {
      messageLength: userMessage.length,
      contextLength: context.length,
      hasContext: !!context,
    });

    const result = await geminiApi.generateRAGResponse(userMessage, context, systemPrompt, {
      includeMetadata: true,
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || "Failed to generate response");
    }

    logger.info("AI response generated", {
      responseLength: result.data.response.length,
      metadata: result.data.metadata,
    });

    return result.data.response;
  } catch (error) {
    logger.error("Failed to generate AI response", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw new Error("Failed to generate AI response");
  }
};

/**
 * Count tokens in text (useful for context window management)
 * @param text - Text to count tokens
 * @returns Token count
 */
export const countTokens = async (text: string): Promise<number> => {
  try {
    const result = await geminiApi.countTokens(text);
    return result.success ? result.data || 0 : 0;
  } catch (error) {
    logger.error("Failed to count tokens", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return 0;
  }
};

// Export new integration layer for direct use
export { geminiApi };

export default {
  generateEmbedding,
  generateResponse,
  countTokens,
  // New integration layer
  geminiApi,
};
