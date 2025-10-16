/**
 * @file apiKey.ts
 * @description Utilities for API key generation and validation
 */

import crypto from "crypto";

/**
 * Generate a secure API key for agent access
 * Format: ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (32 random chars)
 * @returns Generated API key string
 */
export const generateApiKey = (): string => {
  const randomBytes = crypto.randomBytes(16);
  const apiKey = `ak_${randomBytes.toString("hex")}`;
  return apiKey;
};

/**
 * Validate API key format
 * @param apiKey - API key to validate
 * @returns True if format is valid
 */
export const isValidApiKeyFormat = (apiKey: string): boolean => {
  const apiKeyRegex = /^ak_[a-f0-9]{32}$/;
  return apiKeyRegex.test(apiKey);
};

/**
 * Hash API key for secure storage (optional - for future use)
 * @param apiKey - API key to hash
 * @returns Hashed API key
 */
export const hashApiKey = (apiKey: string): string => {
  return crypto.createHash("sha256").update(apiKey).digest("hex");
};

/**
 * Generate a secure random string for various purposes
 * @param length - Length of random string
 * @returns Random string
 */
export const generateRandomString = (length: number = 32): string => {
  return crypto
    .randomBytes(Math.ceil(length / 2))
    .toString("hex")
    .slice(0, length);
};
