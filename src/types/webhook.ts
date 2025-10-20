/**
 * @file webhook.ts
 * @description Webhook-related types and interfaces
 */

import { Tables, TablesInsert, TablesUpdate } from "./database";

/**
 * Webhook type from database
 */
export type Webhook = Tables<"webhooks">;
export type WebhookInsert = TablesInsert<"webhooks">;
export type WebhookUpdate = TablesUpdate<"webhooks">;

/**
 * Webhook list options interface
 */
export interface WebhookListOptions {
  page?: number;
  limit?: number;
  eventType?: string;
}

/**
 * Webhook list response interface
 */
export interface WebhookListResponse {
  webhooks: Webhook[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Webhook search options interface
 */
export interface WebhookSearchOptions {
  page?: number;
  limit?: number;
}

/**
 * Webhook provider type
 */
export type WebhookProvider = "stripe" | "github" | "shopify" | "generic";

/**
 * Webhook event interface
 */
export interface WebhookEvent {
  id: string;
  provider: WebhookProvider;
  type: string;
  timestamp: Date;
  data: Record<string, unknown>;
  headers: Record<string, string>;
  tenantId?: string;
}

/**
 * Webhook result interface
 */
export interface WebhookResult {
  success: boolean;
  eventId: string;
  provider: WebhookProvider;
  type: string;
  tenantId?: string;
  error?: string;
  processingTime: number;
}

/**
 * Webhook handler function type
 */
export type WebhookHandler = (event: WebhookEvent) => Promise<void> | void;

/**
 * Webhook statistics interface
 */
export interface WebhookStats {
  total?: number;
  byEventType?: Record<string, number>;
  recentActivity?: {
    created: number;
    updated: number;
  };
  totalHandlers: number;
  handlersByProvider: Record<string, number>;
  registeredProviders: WebhookProvider[];
  tenantId?: string;
}

/**
 * Webhook health check interface
 */
export interface WebhookHealthCheck {
  status: "healthy" | "unhealthy";
  configuredProviders: WebhookProvider[];
  totalHandlers: number;
  tenantId?: string;
  timestamp: string;
}

/**
 * Webhook signature verification config
 */
export interface WebhookSignatureConfig {
  provider: WebhookProvider;
  secret: string;
  algorithm?: "sha256" | "sha1";
  headerName?: string;
  timestampHeader?: string;
  toleranceSeconds?: number;
}

/**
 * Webhook signature verification result
 */
export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
}
