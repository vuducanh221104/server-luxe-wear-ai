/**
 * @file agent.ts
 * @description Agent-related types and interfaces
 */

import { Tables, TablesInsert, TablesUpdate } from "./database";

/**
 * Agent type from database
 */
export type Agent = Tables<"agents">;
export type AgentInsert = TablesInsert<"agents">;
export type AgentUpdate = TablesUpdate<"agents">;

/**
 * Agent configuration interface
 */
export interface AgentConfig {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  systemPrompt?: string;
  instructions?: string;
  tools?: string[];
  [key: string]: unknown;
}

/**
 * Create agent data interface
 */
export interface CreateAgentData {
  name: string;
  description?: string;
  systemPrompt?: string;
  config?: AgentConfig;
  isPublic?: boolean;
  allowedOrigins?: string[];
}

/**
 * Update agent data interface
 */
export interface UpdateAgentData {
  name?: string;
  description?: string;
  systemPrompt?: string;
  config?: AgentConfig;
  isPublic?: boolean;
  allowedOrigins?: string[];
}

/**
 * Agent list response interface
 */
export interface AgentListResponse {
  agents: Agent[];
  pagination: {
    page: number;
    perPage: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Agent statistics interface
 */
export interface AgentStats {
  knowledgeCount: number;
  webhookCount: number;
  totalRequests: number;
  lastActivity: string;
}
