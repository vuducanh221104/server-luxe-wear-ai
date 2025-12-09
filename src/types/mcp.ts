/**
 * @file mcp.ts
 * @description TypeScript types for MCP (Model Context Protocol) tools and function calling
 * Used for AI agents to call tools during conversations
 */

import { z } from "zod";

/**
 * MCP Tool Categories
 */
export enum ToolCategory {
  KNOWLEDGE = "knowledge",
  BUSINESS = "business",
  ACTIONS = "actions",
  INTEGRATION = "integration",
}

/**
 * Tool permission levels
 */
export enum ToolPermission {
  PUBLIC = "public", // Anyone can use
  AUTHENTICATED = "authenticated", // Requires user auth
  ADMIN = "admin", // Admin only
  CUSTOM = "custom", // Custom permission logic
}

/**
 * Function declaration for Gemini API
 */
export interface FunctionDeclaration {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, PropertySchema>;
    required?: string[];
  };
}

/**
 * Property schema for function parameters
 */
export interface PropertySchema {
  type: "string" | "number" | "boolean" | "array" | "object";
  description: string;
  enum?: string[];
  items?: PropertySchema;
  properties?: Record<string, PropertySchema>;
}

/**
 * Function call from Gemini
 */
export interface FunctionCall {
  name: string;
  args: Record<string, unknown>;
}

/**
 * Function response to Gemini
 */
export interface FunctionResponse {
  name: string;
  response: {
    success: boolean;
    data?: unknown;
    error?: string;
  };
}

/**
 * MCP Tool definition
 */
export interface MCPTool {
  name: string;
  description: string;
  category: ToolCategory;
  permission: ToolPermission;
  enabled: boolean;
  schema: z.ZodSchema;
  handler: (args: unknown, context: ToolExecutionContext) => Promise<ToolResult>;
}

/**
 * Tool execution context
 */
export interface ToolExecutionContext {
  agentId: string;
  userId?: string;
  tenantId: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Tool execution result
 */
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: {
    executionTime?: number;
    source?: string;
    cached?: boolean;
  };
}

/**
 * Agent tools configuration
 */
export interface AgentToolsConfig {
  enabledTools: string[];
  toolSettings?: Record<
    string,
    {
      permission?: ToolPermission;
      rateLimit?: number;
      customConfig?: Record<string, unknown>;
    }
  >;
}

/**
 * Gemini function calling request
 */
export interface GeminiFunctionCallingRequest {
  prompt: string;
  tools: FunctionDeclaration[];
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

/**
 * Gemini function calling response
 */
export interface GeminiFunctionCallingResponse {
  text?: string;
  functionCall?: FunctionCall;
  isComplete: boolean;
}

/**
 * Tool registry entry
 */
export interface ToolRegistryEntry {
  tool: MCPTool;
  functionDeclaration: FunctionDeclaration;
}

/**
 * Search knowledge tool arguments
 */
export const SearchKnowledgeArgsSchema = z.object({
  query: z.string().describe("Search query for knowledge base"),
  limit: z.number().optional().default(5).describe("Maximum number of results (1-10)"),
  filters: z.record(z.unknown()).optional().describe("Optional filters for search"),
});

export type SearchKnowledgeArgs = z.infer<typeof SearchKnowledgeArgsSchema>;

/**
 * Get product info tool arguments
 */
export const GetProductInfoArgsSchema = z.object({
  product_id: z.string().describe("Product ID to fetch information for"),
});

export type GetProductInfoArgs = z.infer<typeof GetProductInfoArgsSchema>;

/**
 * Check inventory tool arguments
 */
export const CheckInventoryArgsSchema = z.object({
  product_id: z.string().describe("Product ID to check inventory"),
  location: z.string().optional().describe("Warehouse location (optional)"),
});

export type CheckInventoryArgs = z.infer<typeof CheckInventoryArgsSchema>;

/**
 * Create support ticket tool arguments
 */
export const CreateSupportTicketArgsSchema = z.object({
  subject: z.string().describe("Ticket subject"),
  description: z.string().describe("Detailed description of the issue"),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional().default("medium"),
  customer_email: z.string().email().optional().describe("Customer email for follow-up"),
});

export type CreateSupportTicketArgs = z.infer<typeof CreateSupportTicketArgsSchema>;

/**
 * Send email tool arguments
 */
export const SendEmailArgsSchema = z.object({
  to: z.string().email().describe("Recipient email address"),
  template: z.string().describe("Email template name"),
  data: z.record(z.unknown()).describe("Template data"),
});

export type SendEmailArgs = z.infer<typeof SendEmailArgsSchema>;

/**
 * Get order status tool arguments
 */
export const GetOrderStatusArgsSchema = z.object({
  order_id: z.string().describe("Order ID to check status"),
});

export type GetOrderStatusArgs = z.infer<typeof GetOrderStatusArgsSchema>;

/**
 * Calculate price tool arguments
 */
export const CalculatePriceArgsSchema = z.object({
  product_id: z.string().describe("Product ID"),
  quantity: z.number().positive().describe("Quantity to purchase"),
  coupon_code: z.string().optional().describe("Discount coupon code (optional)"),
});

export type CalculatePriceArgs = z.infer<typeof CalculatePriceArgsSchema>;

/**
 * Call external API tool arguments
 */
export const CallExternalApiArgsSchema = z.object({
  endpoint: z.string().url().describe("API endpoint URL"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
  data: z.record(z.unknown()).optional().describe("Request body data (for POST/PUT)"),
  headers: z.record(z.string()).optional().describe("Custom headers"),
});

export type CallExternalApiArgs = z.infer<typeof CallExternalApiArgsSchema>;
