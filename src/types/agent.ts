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
  config?: AgentConfig;
  isPublic?: boolean;
  allowedOrigins?: string[];
}

/**
 * Agent list response interface
 */
export interface AgentListResponse {
  agents: Agent[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * Agent statistics interface
 */
export interface AgentStats {
  totalQueries: number;
  totalKnowledge: number;
  totalWebhooks: number;
  createdAt: string;
  lastUsedAt: string | null;
}
