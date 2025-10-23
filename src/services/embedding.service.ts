/**
 * @file embedding.service.ts
 * @description Embedding generation service using Pinecone Inference API
 * Uses multilingual-e5-large model (1024 dimensions) - NO quota limits!
 */

import { getPineconeClient } from "../config/pinecone";
import logger from "../config/logger";

/**
 * Embedding Service
 * Handles text-to-vector conversion using Pinecone Inference API
 */
export class EmbeddingService {
  /**
   * Generate embedding using Pinecone Inference API
   * Model: multilingual-e5-large (1024 dimensions)
   *
   * @param text - Input text to convert to embedding
   * @returns Promise<number[]> - 1024-dimensional vector
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const pc = getPineconeClient();

      // Use Pinecone Inference API
      const result = await pc.inference.embed("multilingual-e5-large", [text], {
        inputType: "passage",
        truncate: "END",
      });

      // EmbeddingsList has structure: { data: Array<Embedding> }
      const embeddingData = result.data[0];

      // Type guard: Check if it's a dense embedding
      if (!("values" in embeddingData)) {
        throw new Error(`Expected dense embedding but got ${result.vectorType}`);
      }

      const embedding = embeddingData.values;

      logger.debug("Embedding generated via Pinecone Inference", {
        textLength: text.length,
        dimensions: embedding?.length || 0,
        model: result.model,
        vectorType: result.vectorType,
      });

      if (!embedding || embedding.length === 0) {
        throw new Error("Empty embedding received from Pinecone");
      }

      return embedding;
    } catch (error) {
      logger.error("Failed to generate embedding via Pinecone Inference", {
        error: error instanceof Error ? error.message : "Unknown error",
        textLength: text.length,
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw new Error(
        `Failed to generate embedding: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Count tokens (approximate for multilingual-e5-large)
   * Uses word-based estimation: ~1.3 tokens per word
   *
   * @param text - Input text to count tokens
   * @returns Promise<number> - Estimated token count
   */
  async countTokens(text: string): Promise<number> {
    // multilingual-e5-large: ~1.3 tokens per word
    const words = text.split(/\s+/).length;
    return Math.ceil(words * 1.3);
  }
}

// Create and export singleton instance
export const embeddingService = new EmbeddingService();

// Export default for backward compatibility
export default embeddingService;
