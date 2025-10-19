/**
 * @file cache.ts
 * @description Caching utilities for performance optimization
 * Provides in-memory caching for embeddings, search results, and other expensive operations
 */

import NodeCache from "node-cache";
import { createHash } from "crypto";
import logger from "../config/logger";

/**
 * Cache configuration
 */
const CACHE_CONFIG = {
  stdTTL: 3600, // 1 hour default TTL
  checkperiod: 120, // 2 minutes cleanup interval
  useClones: false, // Better performance
  maxKeys: 10000, // Maximum number of keys
};

/**
 * Main cache instance
 */
const cache = new NodeCache(CACHE_CONFIG);

/**
 * Cache statistics
 */
interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  size: number;
}

/**
 * Generate cache key from input
 */
const generateCacheKey = (prefix: string, input: string | number[]): string => {
  const inputStr = Array.isArray(input) ? input.join(",") : input;
  const hash = createHash("md5").update(inputStr).digest("hex");
  return `${prefix}:${hash}`;
};

/**
 * Cache for embeddings
 */
export const getCachedEmbedding = async (
  text: string,
  generateFn: (text: string) => Promise<number[]>
): Promise<number[]> => {
  const cacheKey = generateCacheKey("embedding", text);

  if (cache.has(cacheKey)) {
    logger.debug("Embedding cache hit", { cacheKey });
    return cache.get(cacheKey) as number[];
  }

  logger.debug("Embedding cache miss", { cacheKey });
  const embedding = await generateFn(text);
  cache.set(cacheKey, embedding, 7200); // 2 hours TTL for embeddings
  return embedding;
};

/**
 * Cache for search results
 */
export const getCachedSearchResults = async <T>(
  queryVector: number[],
  userId: string | undefined,
  topK: number,
  searchFn: (queryVector: number[], userId?: string, topK?: number) => Promise<T[]>
): Promise<T[]> => {
  const cacheKey = generateCacheKey(
    "search",
    `${queryVector.join(",")}:${userId || "all"}:${topK}`
  );

  if (cache.has(cacheKey)) {
    logger.debug("Search cache hit", { cacheKey });
    return cache.get(cacheKey) as T[];
  }

  logger.debug("Search cache miss", { cacheKey });
  const results = await searchFn(queryVector, userId, topK);
  cache.set(cacheKey, results, 1800); // 30 minutes TTL for search results
  return results;
};

/**
 * Cache for AI responses (with context)
 */
export const getCachedAIResponse = async (
  userMessage: string,
  context: string,
  systemPrompt: string,
  generateFn: (message: string, context: string, prompt: string) => Promise<string>
): Promise<string> => {
  const cacheKey = generateCacheKey("ai_response", `${userMessage}:${context}:${systemPrompt}`);

  if (cache.has(cacheKey)) {
    logger.debug("AI response cache hit", { cacheKey });
    return cache.get(cacheKey) as string;
  }

  logger.debug("AI response cache miss", { cacheKey });
  const response = await generateFn(userMessage, context, systemPrompt);
  cache.set(cacheKey, response, 900); // 15 minutes TTL for AI responses
  return response;
};

/**
 * Cache for token counts
 */
export const getCachedTokenCount = async (
  text: string,
  countFn: (text: string) => Promise<number>
): Promise<number> => {
  const cacheKey = generateCacheKey("tokens", text);

  if (cache.has(cacheKey)) {
    logger.debug("Token count cache hit", { cacheKey });
    return cache.get(cacheKey) as number;
  }

  logger.debug("Token count cache miss", { cacheKey });
  const count = await countFn(text);
  cache.set(cacheKey, count, 3600); // 1 hour TTL for token counts
  return count;
};

/**
 * Cache for context building
 */
export const getCachedContext = async (
  searchResults: Array<{ id: string; score: number; metadata: { content: string } }>,
  maxTokens: number,
  buildFn: (
    results: Array<{ id: string; score: number; metadata: { content: string } }>,
    maxTokens: number
  ) => Promise<string>
): Promise<string> => {
  const resultsKey = searchResults.map((r) => `${r.id}:${r.score}`).join(",");
  const cacheKey = generateCacheKey("context", `${resultsKey}:${maxTokens}`);

  if (cache.has(cacheKey)) {
    logger.debug("Context cache hit", { cacheKey });
    return cache.get(cacheKey) as string;
  }

  logger.debug("Context cache miss", { cacheKey });
  const context = await buildFn(searchResults, maxTokens);
  cache.set(cacheKey, context, 1800); // 30 minutes TTL for context
  return context;
};

/**
 * Clear cache by pattern
 */
export const clearCacheByPattern = (pattern: string): number => {
  const keys = cache.keys().filter((key) => key.includes(pattern));
  return cache.del(keys);
};

/**
 * Clear all cache
 */
export const clearAllCache = (): void => {
  cache.flushAll();
  logger.info("All cache cleared");
};

/**
 * Get cache statistics
 */
export const getCacheStats = (): CacheStats => {
  const stats = cache.getStats();
  return {
    hits: stats.hits,
    misses: stats.misses,
    keys: cache.keys().length,
    size: cache.getStats().ksize,
  };
};

/**
 * Cache middleware for functions
 */
export const withCache = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string,
  ttl: number = 3600
) => {
  return async (...args: T): Promise<R> => {
    const cacheKey = keyGenerator(...args);

    if (cache.has(cacheKey)) {
      logger.debug("Function cache hit", { cacheKey });
      return cache.get(cacheKey) as R;
    }

    logger.debug("Function cache miss", { cacheKey });
    const result = await fn(...args);
    cache.set(cacheKey, result, ttl);
    return result;
  };
};

/**
 * Cache health check
 */
export const isCacheHealthy = (): boolean => {
  try {
    cache.set("health_check", "ok", 1);
    const result = cache.get("health_check");
    return result === "ok";
  } catch (error) {
    logger.error("Cache health check failed", { error });
    return false;
  }
};

export default {
  getCachedEmbedding,
  getCachedSearchResults,
  getCachedAIResponse,
  getCachedTokenCount,
  getCachedContext,
  clearCacheByPattern,
  clearAllCache,
  getCacheStats,
  withCache,
  isCacheHealthy,
};
