/**
 * @file env.ts
 * @description Environment variables configuration and validation
 */

import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Validates that a required environment variable is set
 */
const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

/**
 * Environment configuration
 */
export const env = {
  // Server
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT || "3001", 10),
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "*",

  // Supabase
  SUPABASE_URL: requireEnv("SUPABASE_URL"),
  SUPABASE_ANON_KEY: requireEnv("SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),

  // Pinecone
  PINECONE_API_KEY: requireEnv("PINECONE_API_KEY"),
  PINECONE_ENVIRONMENT: requireEnv("PINECONE_ENVIRONMENT"),
  PINECONE_INDEX_NAME: requireEnv("PINECONE_INDEX_NAME"),

  // AI
  GEMINI_API_KEY: requireEnv("GEMINI_API_KEY"),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),

  // Logging
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
};

export default env;
