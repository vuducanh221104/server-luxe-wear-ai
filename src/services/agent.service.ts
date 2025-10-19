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
 * Create a new agent
 * @param userId - Owner user ID
 * @param agentData - Agent data
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns Created agent
 */
export const createAgent = async (
  userId: string,
  agentData: CreateAgentData,
  tenantId: string
): Promise<Agent> => {
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
      is_public: agentData.isPublic || false,
      allowed_origins: agentData.allowedOrigins || null,
    })
    .select()
    .single();

  if (error) {
    logger.error("Create agent failed", { userId, error: error.message });
    throw new Error(error.message);
  }

  logger.info("Agent created successfully", {
    userId,
    tenantId,
    agentId: data.id,
    isPublic: data.is_public,
    hasApiKey: !!data.api_key,
  });
  return data;
};

/**
 * Get agent by ID
 * @param agentId - Agent ID
 * @param userId - Owner user ID (for authorization)
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns Agent data
 */
export const getAgentById = async (
  agentId: string,
  userId: string,
  tenantId: string
): Promise<Agent> => {
  logger.info("Getting agent by ID", { agentId, userId, tenantId });

  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("owner_id", userId)
    .eq("tenant_id", tenantId)
    .single();

  if (error) {
    logger.error("Get agent failed", { agentId, userId, error: error.message });
    throw new Error(error.code === "PGRST116" ? "Agent not found" : error.message);
  }

  logger.info("Agent retrieved successfully", { agentId, userId });
  return data;
};

/**
 * List user's agents with pagination
 * @param userId - Owner user ID
 * @param tenantId - Tenant ID for multi-tenancy
 * @param page - Page number (1-based)
 * @param perPage - Items per page
 * @returns List of agents with pagination
 */
export const listUserAgents = async (
  userId: string,
  tenantId: string,
  page: number = 1,
  perPage: number = 10
): Promise<AgentListResponse> => {
  logger.info("Listing user agents", { userId, tenantId, page, perPage });

  const offset = (page - 1) * perPage;

  // Get total count
  const { count, error: countError } = await supabaseAdmin
    .from("agents")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("tenant_id", tenantId);

  if (countError) {
    logger.error("Count agents failed", { userId, error: countError.message });
    throw new Error(countError.message);
  }

  // Get agents with pagination
  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("owner_id", userId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .range(offset, offset + perPage - 1);

  if (error) {
    logger.error("List agents failed", { userId, error: error.message });
    throw new Error(error.message);
  }

  const total = count || 0;
  const totalPages = Math.ceil(total / perPage);

  logger.info("Agents listed successfully", {
    userId,
    total,
    page,
    perPage,
    totalPages,
  });

  return {
    agents: data,
    total,
    page,
    perPage,
    totalPages,
  };
};

/**
 * Update agent
 * @param agentId - Agent ID
 * @param userId - Owner user ID (for authorization)
 * @param tenantId - Tenant ID for multi-tenancy
 * @param updateData - Data to update
 * @returns Updated agent
 */
export const updateAgent = async (
  agentId: string,
  userId: string,
  tenantId: string,
  updateData: UpdateAgentData
): Promise<Agent> => {
  logger.info("Updating agent", { agentId, userId, tenantId, updateData });

  // Check if new name already exists (if name is being updated)
  if (updateData.name) {
    const { data: existingAgent } = await supabaseAdmin
      .from("agents")
      .select("id")
      .eq("owner_id", userId)
      .eq("tenant_id", tenantId)
      .eq("name", updateData.name)
      .neq("id", agentId)
      .single();

    if (existingAgent) {
      throw new Error("Agent name already exists");
    }
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .update({
      ...(updateData.name && { name: updateData.name }),
      ...(updateData.description !== undefined && { description: updateData.description }),
      ...(updateData.config && { config: updateData.config }),
      ...(updateData.isPublic !== undefined && { is_public: updateData.isPublic }),
      ...(updateData.allowedOrigins !== undefined && {
        allowed_origins: updateData.allowedOrigins,
      }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId)
    .eq("owner_id", userId)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) {
    logger.error("Update agent failed", { agentId, userId, error: error.message });
    throw new Error(error.code === "PGRST116" ? "Agent not found" : error.message);
  }

  logger.info("Agent updated successfully", { agentId, userId });
  return data;
};

/**
 * Delete agent
 * @param agentId - Agent ID
 * @param userId - Owner user ID (for authorization)
 * @param tenantId - Tenant ID for multi-tenancy
 */
export const deleteAgent = async (
  agentId: string,
  userId: string,
  tenantId: string
): Promise<void> => {
  logger.info("Deleting agent", { agentId, userId, tenantId });

  const { error } = await supabaseAdmin
    .from("agents")
    .delete()
    .eq("id", agentId)
    .eq("owner_id", userId)
    .eq("tenant_id", tenantId);

  if (error) {
    logger.error("Delete agent failed", { agentId, userId, error: error.message });
    throw new Error(error.message);
  }

  logger.info("Agent deleted successfully", { agentId, userId });
};

/**
 * Get agent statistics
 * @param agentId - Agent ID
 * @param userId - Owner user ID (for authorization)
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns Agent statistics
 */
export const getAgentStats = async (
  agentId: string,
  userId: string,
  tenantId: string
): Promise<AgentStats> => {
  logger.info("Getting agent statistics", { agentId, userId, tenantId });

  // Verify agent ownership
  await getAgentById(agentId, userId, tenantId);

  // Get queries count
  const { count: totalQueries, error: queriesError } = await supabaseAdmin
    .from("analytics")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("tenant_id", tenantId);

  if (queriesError) {
    logger.warn("Failed to get queries count", { agentId, error: queriesError.message });
  }

  // Get knowledge count
  const { count: totalKnowledge, error: knowledgeError } = await supabaseAdmin
    .from("knowledge")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("tenant_id", tenantId);

  if (knowledgeError) {
    logger.warn("Failed to get knowledge count", { agentId, error: knowledgeError.message });
  }

  // Get webhooks count
  const { count: totalWebhooks, error: webhooksError } = await supabaseAdmin
    .from("webhooks")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("tenant_id", tenantId);

  if (webhooksError) {
    logger.warn("Failed to get webhooks count", { agentId, error: webhooksError.message });
  }

  // Get last used date from analytics
  const { data: lastQuery } = await supabaseAdmin
    .from("analytics")
    .select("created_at")
    .eq("agent_id", agentId)
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  // Get agent creation date
  const agent = await getAgentById(agentId, userId, tenantId);

  const stats = {
    totalQueries: totalQueries || 0,
    totalKnowledge: totalKnowledge || 0,
    totalWebhooks: totalWebhooks || 0,
    createdAt: agent.created_at!,
    lastUsedAt: lastQuery?.created_at || null,
  };

  logger.info("Agent statistics retrieved", { agentId, userId, stats });
  return stats;
};

/**
 * Search agents by name
 * @param userId - Owner user ID
 * @param tenantId - Tenant ID for multi-tenancy
 * @param searchTerm - Search term
 * @param limit - Maximum results
 * @returns Matching agents
 */
export const searchAgents = async (
  userId: string,
  tenantId: string,
  searchTerm: string,
  limit: number = 10
): Promise<Agent[]> => {
  logger.info("Searching agents", { userId, tenantId, searchTerm, limit });

  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("owner_id", userId)
    .eq("tenant_id", tenantId)
    .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("Search agents failed", { userId, error: error.message });
    throw new Error(error.message);
  }

  logger.info("Agents search completed", { userId, searchTerm, count: data.length });
  return data;
};

/**
 * Get agent by API key (for public access)
 * @param apiKey - Agent API key
 * @returns Agent data if public and valid
 */
export const getAgentByApiKey = async (apiKey: string): Promise<Agent | null> => {
  logger.info("Getting agent by API key", { apiKey: apiKey.substring(0, 8) + "..." });

  const { data, error } = await supabaseAdmin
    .from("agents")
    .select("*")
    .eq("api_key", apiKey)
    .eq("is_public", true)
    .single();

  if (error) {
    logger.debug("Get agent by API key failed", { error: error.message });
    return null;
  }

  logger.info("Agent retrieved by API key", { agentId: data.id });
  return data;
};

/**
 * Regenerate API key for an agent
 * @param agentId - Agent ID
 * @param userId - Owner user ID (for authorization)
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns Updated agent with new API key
 */
export const regenerateApiKey = async (
  agentId: string,
  userId: string,
  tenantId: string
): Promise<Agent> => {
  logger.info("Regenerating API key", { agentId, userId, tenantId });

  // Verify agent ownership
  await getAgentById(agentId, userId, tenantId);

  // Generate new API key
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
    logger.error("Regenerate API key failed", { agentId, userId, error: error.message });
    throw new Error(error.message);
  }

  logger.info("API key regenerated successfully", { agentId, userId });
  return data;
};

/**
 * Toggle agent public status
 * @param agentId - Agent ID
 * @param userId - Owner user ID (for authorization)
 * @param tenantId - Tenant ID for multi-tenancy
 * @param isPublic - New public status
 * @returns Updated agent
 */
export const toggleAgentPublicStatus = async (
  agentId: string,
  userId: string,
  tenantId: string,
  isPublic: boolean
): Promise<Agent> => {
  logger.info("Toggling agent public status", { agentId, userId, tenantId, isPublic });

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
    logger.error("Toggle public status failed", { agentId, userId, error: error.message });
    throw new Error(error.code === "PGRST116" ? "Agent not found" : error.message);
  }

  logger.info("Agent public status updated", { agentId, userId, isPublic });
  return data;
};

/**
 * Update allowed origins for an agent
 * @param agentId - Agent ID
 * @param userId - Owner user ID (for authorization)
 * @param tenantId - Tenant ID for multi-tenancy
 * @param allowedOrigins - Array of allowed origins
 * @returns Updated agent
 */
export const updateAllowedOrigins = async (
  agentId: string,
  userId: string,
  tenantId: string,
  allowedOrigins: string[]
): Promise<Agent> => {
  logger.info("Updating allowed origins", { agentId, userId, tenantId, allowedOrigins });

  const { data, error } = await supabaseAdmin
    .from("agents")
    .update({
      allowed_origins: allowedOrigins.length > 0 ? allowedOrigins : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agentId)
    .eq("owner_id", userId)
    .eq("tenant_id", tenantId)
    .select()
    .single();

  if (error) {
    logger.error("Update allowed origins failed", { agentId, userId, error: error.message });
    throw new Error(error.code === "PGRST116" ? "Agent not found" : error.message);
  }

  logger.info("Allowed origins updated", { agentId, userId, allowedOrigins });
  return data;
};
