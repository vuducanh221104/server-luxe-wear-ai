/**
 * @file webhook.service.ts
 * @description Service layer for webhook management and database operations
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import {
  Webhook,
  WebhookInsert,
  WebhookUpdate,
  WebhookListOptions,
  WebhookListResponse,
  WebhookStats,
  WebhookSearchOptions,
} from "../types";

/**
 * Webhook service class for database operations
 */
export class WebhookService {
  /**
   * Create a new webhook
   */
  async createWebhook(data: WebhookInsert): Promise<Webhook> {
    try {
      logger.info("Creating webhook", {
        agentId: data.agent_id,
        eventType: data.event_type,
        url: data.url?.substring(0, 50) + "...",
      });

      const { data: webhook, error } = await supabaseAdmin
        .from("webhooks")
        .insert(data)
        .select()
        .single();

      if (error) {
        logger.error("Failed to create webhook", {
          error: error.message,
          data,
        });
        throw new Error(`Failed to create webhook: ${error.message}`);
      }

      logger.info("Webhook created successfully", {
        webhookId: webhook.id,
        agentId: webhook.agent_id,
      });

      return webhook;
    } catch (error) {
      logger.error("Create webhook service error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get webhook by ID
   */
  async getWebhookById(id: string, tenantId?: string): Promise<Webhook | null> {
    try {
      let query = supabaseAdmin.from("webhooks").select("*").eq("id", id);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data: webhook, error } = await query.single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new Error(`Failed to get webhook: ${error.message}`);
      }

      return webhook;
    } catch (error) {
      logger.error("Get webhook by ID service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        webhookId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get webhooks by agent ID
   */
  async getWebhooksByAgentId(
    agentId: string,
    options: WebhookListOptions = {},
    tenantId?: string
  ): Promise<WebhookListResponse> {
    try {
      const { page = 1, limit = 10, eventType } = options;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from("webhooks")
        .select("*", { count: "exact" })
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      if (eventType) {
        query = query.eq("event_type", eventType);
      }

      const { data: webhooks, error, count } = await query;

      if (error) {
        throw new Error(`Failed to get webhooks: ${error.message}`);
      }

      return {
        webhooks: webhooks || [],
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      logger.error("Get webhooks by agent ID service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        agentId,
        options,
      });
      throw error;
    }
  }

  /**
   * Update webhook
   */
  async updateWebhook(id: string, data: WebhookUpdate, tenantId?: string): Promise<Webhook> {
    try {
      logger.info("Updating webhook", {
        webhookId: id,
        updates: Object.keys(data),
        tenantId,
      });

      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      let query = supabaseAdmin.from("webhooks").update(updateData).eq("id", id);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data: webhook, error } = await query.select().single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Webhook not found");
        }
        throw new Error(`Failed to update webhook: ${error.message}`);
      }

      if (!webhook) {
        throw new Error("Webhook not found");
      }

      logger.info("Webhook updated successfully", {
        webhookId: webhook.id,
        tenantId,
      });

      return webhook;
    } catch (error) {
      logger.error("Update webhook service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        webhookId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(id: string, tenantId?: string): Promise<void> {
    try {
      logger.info("Deleting webhook", { webhookId: id, tenantId });

      let query = supabaseAdmin.from("webhooks").delete().eq("id", id);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { error } = await query;

      if (error) {
        throw new Error(`Failed to delete webhook: ${error.message}`);
      }

      logger.info("Webhook deleted successfully", { webhookId: id, tenantId });
    } catch (error) {
      logger.error("Delete webhook service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        webhookId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Check if user owns webhook
   */
  async isWebhookOwner(webhookId: string, userId: string, tenantId?: string): Promise<boolean> {
    try {
      let query = supabaseAdmin
        .from("webhooks")
        .select("agent_id, agents(owner_id)")
        .eq("id", webhookId);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        return false;
      }

      // Handle the joined data safely
      const webhook = data as { agent_id: string; agents: { owner_id: string }[] | null };
      const agentData = webhook.agents?.[0];

      // Check if agents data exists and has owner_id
      if (!agentData || !agentData.owner_id) {
        return false;
      }

      return agentData.owner_id === userId;
    } catch (error) {
      logger.error("Check webhook ownership error", {
        error: error instanceof Error ? error.message : "Unknown error",
        webhookId,
        userId,
        tenantId,
      });
      return false;
    }
  }

  /**
   * Get webhook statistics for an agent
   */
  async getWebhookStats(agentId: string, tenantId?: string): Promise<WebhookStats> {
    try {
      // Get total count and group by event type
      let query = supabaseAdmin
        .from("webhooks")
        .select("event_type, created_at, updated_at")
        .eq("agent_id", agentId);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data: webhooks, error } = await query;

      if (error) {
        throw new Error(`Failed to get webhook stats: ${error.message}`);
      }

      const byEventType: Record<string, number> = {};
      let recentCreated = 0;
      let recentUpdated = 0;
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      for (const webhook of webhooks || []) {
        // Count by event type
        byEventType[webhook.event_type] = (byEventType[webhook.event_type] || 0) + 1;

        // Count recent activity
        if (webhook.created_at && new Date(webhook.created_at) > oneDayAgo) {
          recentCreated++;
        }
        if (webhook.updated_at && new Date(webhook.updated_at) > oneDayAgo) {
          recentUpdated++;
        }
      }

      return {
        total: webhooks?.length || 0,
        byEventType,
        recentActivity: {
          created: recentCreated,
          updated: recentUpdated,
        },
        totalHandlers: webhooks?.length || 0,
        handlersByProvider: {},
        registeredProviders: [],
        tenantId,
      };
    } catch (error) {
      logger.error("Get webhook stats service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        agentId,
      });
      throw error;
    }
  }

  /**
   * Search webhooks
   */
  async searchWebhooks(
    query: string,
    userId: string,
    options: WebhookSearchOptions = {},
    tenantId?: string
  ): Promise<WebhookListResponse> {
    try {
      const { page = 1, limit = 10 } = options;
      const offset = (page - 1) * limit;

      let dbQuery = supabaseAdmin
        .from("webhooks")
        .select("*, agents!inner(owner_id)", { count: "exact" })
        .eq("agents.owner_id", userId)
        .or(`event_type.ilike.%${query}%,url.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (tenantId) {
        dbQuery = dbQuery.eq("tenant_id", tenantId);
      }

      const { data: webhooks, error, count } = await dbQuery;

      if (error) {
        throw new Error(`Failed to search webhooks: ${error.message}`);
      }

      return {
        webhooks: webhooks || [],
        total: count || 0,
        page,
        limit,
      };
    } catch (error) {
      logger.error("Search webhooks service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        query,
        userId,
      });
      throw error;
    }
  }
}

/**
 * Default webhook service instance
 */
export const webhookService = new WebhookService();

export default webhookService;
