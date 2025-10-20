/**
 * @file agent.service.ts
 * @description Agent service using Supabase
 * Handles AI agent management and operations with multi-tenancy support
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import { generateApiKey } from "../utils/apiKey";
import { Agent, CreateAgentData, UpdateAgentData, AgentListResponse, AgentStats } from "../types";

/**
 * Agent Service Class
 * Class-based service for agent operations
 */
export class AgentService {
  /**
   * Create a new agent
   * @param userId - Owner user ID
   * @param agentData - Agent data
   * @param tenantId - Tenant ID for multi-tenancy
   * @returns Created agent
   */
  async createAgent(userId: string, agentData: CreateAgentData, tenantId: string): Promise<Agent> {
    logger.info("Creating agent", { userId, agentData, tenantId });

    // Check if agent name already exists for this user in this tenant
    const { data: existingAgent } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("owner_id", userId)
      .eq("tenant_id", tenantId)
      .eq("name", agentData.name)
      .single();

    if (existingAgent) {
      throw new Error("Agent name already exists");
    }

    // Generate API key for the agent
    const apiKey = generateApiKey();

    const { data, error } = await supabaseAdmin
      .from("agents")
      .insert({
        name: agentData.name,
        description: agentData.description,
        owner_id: userId,
        tenant_id: tenantId,
        config: agentData.config || {},
        api_key: apiKey,
        system_prompt: agentData.systemPrompt,
        is_public: agentData.isPublic || false,
        allowed_origins: agentData.allowedOrigins || [],
      })
      .select()
      .single();

    if (error) {
      logger.error("Failed to create agent", { error: error.message, userId, agentData });
      throw new Error(error.message);
    }

    logger.info("Agent created successfully", { agentId: data.id, userId });
    return data;
  }

  /**
   * Get agent by ID
   * @param agentId - Agent ID
   * @param userId - User ID (for ownership check)
   * @param tenantId - Tenant ID
   * @returns Agent data
   */
  async getAgentById(agentId: string, userId: string, tenantId: string): Promise<Agent> {
    logger.info("Getting agent by ID", { agentId, userId, tenantId });

    const { data, error } = await supabaseAdmin
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("tenant_id", tenantId)
      .single();

    if (error) {
      logger.error("Failed to get agent", { error: error.message, agentId });
      throw new Error("Agent not found");
    }

    // Check ownership
    if (data.owner_id !== userId) {
      logger.warn("User attempted to access agent they don't own", { agentId, userId });
      throw new Error("Access denied");
    }

    logger.info("Agent retrieved successfully", { agentId });
    return data;
  }

  /**
   * List user's agents
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param page - Page number
   * @param perPage - Items per page
   * @returns Agent list response
   */
  async listUserAgents(
    userId: string,
    tenantId: string,
    page: number = 1,
    perPage: number = 10
  ): Promise<AgentListResponse> {
    logger.info("Listing user agents", { userId, tenantId, page, perPage });

    const offset = (page - 1) * perPage;

    const { data, error, count } = await supabaseAdmin
      .from("agents")
      .select("*", { count: "exact" })
      .eq("owner_id", userId)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (error) {
      logger.error("Failed to list agents", { error: error.message, userId });
      throw new Error(error.message);
    }

    const totalPages = Math.ceil((count || 0) / perPage);

    logger.info("Agents listed successfully", {
      userId,
      count: data?.length || 0,
      totalCount: count || 0,
    });

    return {
      agents: data || [],
      pagination: {
        page,
        perPage,
        totalCount: count || 0,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Update agent
   * @param agentId - Agent ID
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param updateData - Update data
   * @returns Updated agent
   */
  async updateAgent(
    agentId: string,
    userId: string,
    tenantId: string,
    updateData: UpdateAgentData
  ): Promise<Agent> {
    logger.info("Updating agent", { agentId, userId, updateData });

    // Check ownership first
    await this.getAgentById(agentId, userId, tenantId);

    const { data, error } = await supabaseAdmin
      .from("agents")
      .update({
        name: updateData.name,
        description: updateData.description,
        config: updateData.config,
        system_prompt: updateData.systemPrompt,
        is_public: updateData.isPublic,
        allowed_origins: updateData.allowedOrigins,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId)
      .eq("owner_id", userId)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update agent", { error: error.message, agentId });
      throw new Error(error.message);
    }

    logger.info("Agent updated successfully", { agentId });
    return data;
  }

  /**
   * Delete agent
   * @param agentId - Agent ID
   * @param userId - User ID
   * @param tenantId - Tenant ID
   */
  async deleteAgent(agentId: string, userId: string, tenantId: string): Promise<void> {
    logger.info("Deleting agent", { agentId, userId });

    // Check ownership first
    await this.getAgentById(agentId, userId, tenantId);

    const { error } = await supabaseAdmin
      .from("agents")
      .delete()
      .eq("id", agentId)
      .eq("owner_id", userId)
      .eq("tenant_id", tenantId);

    if (error) {
      logger.error("Failed to delete agent", { error: error.message, agentId });
      throw new Error(error.message);
    }

    logger.info("Agent deleted successfully", { agentId });
  }

  /**
   * Get agent statistics
   * @param agentId - Agent ID
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Agent statistics
   */
  async getAgentStats(agentId: string, userId: string, tenantId: string): Promise<AgentStats> {
    logger.info("Getting agent stats", { agentId, userId });

    // Check ownership first
    await this.getAgentById(agentId, userId, tenantId);

    // Get knowledge count
    const { count: knowledgeCount } = await supabaseAdmin
      .from("knowledge")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId);

    // Get webhook count
    const { count: webhookCount } = await supabaseAdmin
      .from("webhooks")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", agentId);

    logger.info("Agent stats retrieved successfully", { agentId });

    return {
      knowledgeCount: knowledgeCount || 0,
      webhookCount: webhookCount || 0,
      totalRequests: 0, // TODO: Implement request tracking
      lastActivity: new Date().toISOString(),
    };
  }

  /**
   * Search agents
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param query - Search query
   * @param page - Page number
   * @param perPage - Items per page
   * @returns Search results
   */
  async searchAgents(
    userId: string,
    tenantId: string,
    query: string,
    page: number = 1,
    perPage: number = 10
  ): Promise<AgentListResponse> {
    logger.info("Searching agents", { userId, tenantId, query, page, perPage });

    const offset = (page - 1) * perPage;

    const { data, error, count } = await supabaseAdmin
      .from("agents")
      .select("*", { count: "exact" })
      .eq("owner_id", userId)
      .eq("tenant_id", tenantId)
      .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .range(offset, offset + perPage - 1);

    if (error) {
      logger.error("Failed to search agents", { error: error.message, userId, query });
      throw new Error(error.message);
    }

    const totalPages = Math.ceil((count || 0) / perPage);

    logger.info("Agent search completed", {
      userId,
      query,
      count: data?.length || 0,
      totalCount: count || 0,
    });

    return {
      agents: data || [],
      pagination: {
        page,
        perPage,
        totalCount: count || 0,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
    };
  }

  /**
   * Get agent by API key
   * @param apiKey - API key
   * @returns Agent data
   */
  async getAgentByApiKey(apiKey: string): Promise<Agent | null> {
    logger.info("Getting agent by API key");

    const { data, error } = await supabaseAdmin
      .from("agents")
      .select("*")
      .eq("api_key", apiKey)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        logger.warn("Agent not found for API key");
        return null;
      }
      logger.error("Failed to get agent by API key", { error: error.message });
      throw new Error(error.message);
    }

    logger.info("Agent retrieved by API key", { agentId: data.id });
    return data;
  }

  /**
   * Regenerate API key
   * @param agentId - Agent ID
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Updated agent with new API key
   */
  async regenerateApiKey(agentId: string, userId: string, tenantId: string): Promise<Agent> {
    logger.info("Regenerating API key", { agentId, userId });

    // Check ownership first
    await this.getAgentById(agentId, userId, tenantId);

    const newApiKey = generateApiKey();

    const { data, error } = await supabaseAdmin
      .from("agents")
      .update({
        api_key: newApiKey,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId)
      .eq("owner_id", userId)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to regenerate API key", { error: error.message, agentId });
      throw new Error(error.message);
    }

    logger.info("API key regenerated successfully", { agentId });
    return data;
  }

  /**
   * Toggle agent public status
   * @param agentId - Agent ID
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param isPublic - Public status
   * @returns Updated agent
   */
  async toggleAgentPublicStatus(
    agentId: string,
    userId: string,
    tenantId: string,
    isPublic: boolean
  ): Promise<Agent> {
    logger.info("Toggling agent public status", { agentId, userId, isPublic });

    // Check ownership first
    await this.getAgentById(agentId, userId, tenantId);

    const { data, error } = await supabaseAdmin
      .from("agents")
      .update({
        is_public: isPublic,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId)
      .eq("owner_id", userId)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to toggle agent public status", { error: error.message, agentId });
      throw new Error(error.message);
    }

    logger.info("Agent public status toggled successfully", { agentId, isPublic });
    return data;
  }

  /**
   * Update allowed origins
   * @param agentId - Agent ID
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param allowedOrigins - Allowed origins array
   * @returns Updated agent
   */
  async updateAllowedOrigins(
    agentId: string,
    userId: string,
    tenantId: string,
    allowedOrigins: string[]
  ): Promise<Agent> {
    logger.info("Updating allowed origins", { agentId, userId, allowedOrigins });

    // Check ownership first
    await this.getAgentById(agentId, userId, tenantId);

    const { data, error } = await supabaseAdmin
      .from("agents")
      .update({
        allowed_origins: allowedOrigins,
        updated_at: new Date().toISOString(),
      })
      .eq("id", agentId)
      .eq("owner_id", userId)
      .eq("tenant_id", tenantId)
      .select()
      .single();

    if (error) {
      logger.error("Failed to update allowed origins", { error: error.message, agentId });
      throw new Error(error.message);
    }

    logger.info("Allowed origins updated successfully", { agentId });
    return data;
  }
}

// Create and export service instance
export const agentService = new AgentService();
export default agentService;
