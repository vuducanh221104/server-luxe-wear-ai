/**
 * @file types/shared.types.ts
 * @description Shared types for both Function Calling and MCP Server
 */

/**
 * MCP Protocol Version
 */
export const MCP_PROTOCOL_VERSION = "2024-11-05";

/**
 * MCP Tool Category (shared between both implementations)
 */
export enum MCPToolCategory {
  TENANT_MANAGEMENT = "tenant_management",
  AGENT_MANAGEMENT = "agent_management",
  KNOWLEDGE_MANAGEMENT = "knowledge_management",
  ANALYTICS = "analytics",
  WEBHOOK = "webhook",
  DEBUG = "debug",
}

/**
 * Operation Result (standardized across both implementations)
 */
export interface OperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTime?: number;
    source?: string;
    cached?: boolean;
  };
}

/**
 * Pagination (shared type)
 */
export interface Pagination {
  page: number;
  perPage: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/**
 * Context for operations (shared)
 */
export interface BaseOperationContext {
  userId?: string;
  tenantId: string;
  sessionId?: string;
  requestId?: string;
}
