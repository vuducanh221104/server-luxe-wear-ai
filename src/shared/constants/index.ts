/**
 * @file shared/constants/index.ts
 * @description Centralized constants for the application
 * Organizing all magic numbers and configuration values in one place
 */

// ============================================================================
// AUTHENTICATION CONSTANTS
// ============================================================================
export const AUTH = {
  /** Password hashing rounds for bcrypt */
  SALT_ROUNDS: 12,
  /** Default JWT expiration */
  JWT_EXPIRES_IN: "7d",
  /** Refresh token expiration in days */
  REFRESH_TOKEN_EXPIRES_DAYS: 30,
  /** Maximum login attempts before lockout */
  MAX_LOGIN_ATTEMPTS: 5,
  /** Lockout duration in minutes */
  LOCKOUT_DURATION_MINUTES: 15,
} as const;

// ============================================================================
// PAGINATION CONSTANTS
// ============================================================================
export const PAGINATION = {
  /** Default page number */
  DEFAULT_PAGE: 1,
  /** Default items per page */
  DEFAULT_LIMIT: 10,
  /** Maximum items per page */
  MAX_LIMIT: 100,
  /** Minimum items per page */
  MIN_LIMIT: 1,
} as const;

// ============================================================================
// RATE LIMITING CONSTANTS
// ============================================================================
export const RATE_LIMIT = {
  /** General API rate limit window in ms (15 minutes) */
  WINDOW_MS: 15 * 60 * 1000,
  /** General API max requests per window */
  MAX_REQUESTS: 100,
  /** Auth endpoints max requests per window */
  AUTH_MAX_REQUESTS: 20,
  /** Strict endpoints max requests per window */
  STRICT_MAX_REQUESTS: 50,
} as const;

// ============================================================================
// VECTOR/AI CONSTANTS
// ============================================================================
export const VECTOR = {
  /** Default number of search results */
  DEFAULT_TOP_K: 5,
  /** Maximum search results */
  MAX_TOP_K: 20,
  /** Minimum similarity score threshold */
  MIN_SCORE_THRESHOLD: 0.3,
  /** Embedding batch size */
  EMBEDDING_BATCH_SIZE: 10,
  /** Delay between embedding batches in ms */
  EMBEDDING_BATCH_DELAY_MS: 1000,
  /** Pinecone upsert batch size */
  PINECONE_BATCH_SIZE: 200,
} as const;

// ============================================================================
// FILE UPLOAD CONSTANTS
// ============================================================================
export const UPLOAD = {
  /** Maximum file size in bytes (10MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** Allowed file types for knowledge base */
  ALLOWED_MIME_TYPES: [
    "text/plain",
    "text/markdown",
    "application/pdf",
    "application/json",
  ] as string[],
  /** Default chunk size for text splitting */
  DEFAULT_CHUNK_SIZE: 5000,
  /** Default chunk overlap */
  DEFAULT_CHUNK_OVERLAP: 200,
} as const;

// ============================================================================
// CACHE CONSTANTS
// ============================================================================
export const CACHE = {
  /** Default TTL in seconds (5 minutes) */
  DEFAULT_TTL_SECONDS: 300,
  /** Embedding cache TTL in seconds (1 hour) */
  EMBEDDING_TTL_SECONDS: 3600,
  /** Search results cache TTL in seconds (5 minutes) */
  SEARCH_TTL_SECONDS: 300,
} as const;

// ============================================================================
// API RESPONSE MESSAGES
// ============================================================================
export const MESSAGES = {
  // Success messages
  SUCCESS: {
    CREATED: "Resource created successfully",
    UPDATED: "Resource updated successfully",
    DELETED: "Resource deleted successfully",
    FETCHED: "Resource fetched successfully",
  },
  // Error messages
  ERROR: {
    NOT_FOUND: "Resource not found",
    UNAUTHORIZED: "Authentication required",
    FORBIDDEN: "Access denied",
    VALIDATION: "Validation failed",
    INTERNAL: "Internal server error",
    RATE_LIMIT: "Too many requests, please try again later",
  },
  // Auth messages
  AUTH: {
    LOGIN_SUCCESS: "Login successful",
    LOGOUT_SUCCESS: "Logout successful",
    REGISTER_SUCCESS: "Registration successful",
    INVALID_CREDENTIALS: "Invalid email or password",
    USER_EXISTS: "User with this email already exists",
    TOKEN_EXPIRED: "Token has expired",
    TOKEN_INVALID: "Invalid token",
  },
} as const;

// ============================================================================
// HTTP STATUS CODES (for readability)
// ============================================================================
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
