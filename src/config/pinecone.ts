/**
 * @file pinecone.ts
 * @description Pinecone vector database configuration
 */

import { Pinecone, Index } from "@pinecone-database/pinecone";
import logger from "./logger";

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

if (!PINECONE_API_KEY) {
  throw new Error("Missing PINECONE_API_KEY environment variable");
}

if (!PINECONE_INDEX_NAME) {
  throw new Error("Missing PINECONE_INDEX_NAME environment variable");
}

/**
 * Pinecone client instance
 */
let pineconeClient: Pinecone | null = null;

/**
 * Pinecone index instance
 */
let pineconeIndex: Index | null = null;

/**
 * Initialize Pinecone client and index
 */
export const initializePinecone = async (): Promise<void> => {
  try {
    // Initialize Pinecone client
    pineconeClient = new Pinecone({
      apiKey: PINECONE_API_KEY,
    });

    // Get the index
    pineconeIndex = pineconeClient.index(PINECONE_INDEX_NAME);

    logger.info("Pinecone initialized successfully", {
      indexName: PINECONE_INDEX_NAME,
    });
  } catch (error) {
    logger.error("Failed to initialize Pinecone", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
};

/**
 * Get Pinecone client instance for inference operations
 */
export const getPineconeClient = (): Pinecone => {
  if (!pineconeClient) {
    throw new Error("Pinecone client not initialized. Call initializePinecone() first.");
  }
  return pineconeClient;
};

/**
 * Get Pinecone index instance for vector operations
 */
export const getPineconeIndex = (): Index => {
  if (!pineconeIndex) {
    throw new Error("Pinecone index not initialized. Call initializePinecone() first.");
  }
  return pineconeIndex;
};

export default {
  initializePinecone,
  getPineconeClient,
  getPineconeIndex,
};
