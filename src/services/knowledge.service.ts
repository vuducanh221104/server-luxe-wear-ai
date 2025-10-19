/**
 * @file knowledge.service.ts
 * @description Service layer for knowledge management and database operations
 * Handles knowledge base operations with multi-tenancy support
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import {
  Knowledge,
  KnowledgeInsert,
  KnowledgeUpdate,
  KnowledgeListOptions,
  KnowledgeListResponse,
  KnowledgeStats,
  KnowledgeSearchOptions,
} from "../types";

/**
 * Knowledge service class for database operations
 */
export class KnowledgeService {
  /**
   * Create a new knowledge entry
   */
  async createKnowledge(data: KnowledgeInsert): Promise<Knowledge> {
    try {
      logger.info("Creating knowledge entry", {
        title: data.title,
        agentId: data.agent_id,
        tenantId: data.tenant_id,
      });

      const { data: knowledge, error } = await supabaseAdmin
        .from("knowledge")
        .insert(data)
        .select()
        .single();

      if (error) {
        logger.error("Failed to create knowledge entry", {
          error: error.message,
          data,
        });
        throw new Error(`Failed to create knowledge entry: ${error.message}`);
      }

      logger.info("Knowledge entry created successfully", {
        knowledgeId: knowledge.id,
        title: knowledge.title,
        tenantId: knowledge.tenant_id,
      });

      return knowledge;
    } catch (error) {
      logger.error("Create knowledge service error", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get knowledge entry by ID
   */
  async getKnowledgeById(id: string, tenantId?: string): Promise<Knowledge | null> {
    try {
      let query = supabaseAdmin.from("knowledge").select("*").eq("id", id);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data: knowledge, error } = await query.single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new Error(`Failed to get knowledge entry: ${error.message}`);
      }

      return knowledge;
    } catch (error) {
      logger.error("Get knowledge by ID service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get knowledge entries by agent ID
   */
  async getKnowledgeByAgentId(
    agentId: string,
    options: KnowledgeListOptions = {},
    tenantId?: string
  ): Promise<KnowledgeListResponse> {
    try {
      const { page = 1, limit = 10 } = options;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from("knowledge")
        .select("*", { count: "exact" })
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data: knowledge, error, count } = await query;

      if (error) {
        throw new Error(`Failed to get knowledge entries: ${error.message}`);
      }

      return {
        knowledge: knowledge || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      logger.error("Get knowledge by agent ID service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        agentId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Get all knowledge entries for a tenant
   */
  async getKnowledgeByTenant(
    tenantId: string,
    options: KnowledgeListOptions = {}
  ): Promise<KnowledgeListResponse> {
    try {
      const { page = 1, limit = 10, agentId } = options;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from("knowledge")
        .select("*", { count: "exact" })
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (agentId) {
        query = query.eq("agent_id", agentId);
      }

      const { data: knowledge, error, count } = await query;

      if (error) {
        throw new Error(`Failed to get knowledge entries: ${error.message}`);
      }

      return {
        knowledge: knowledge || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      logger.error("Get knowledge by tenant service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Update knowledge entry
   */
  async updateKnowledge(id: string, data: KnowledgeUpdate, tenantId?: string): Promise<Knowledge> {
    try {
      const updateData = {
        ...data,
        updated_at: new Date().toISOString(),
      };

      let query = supabaseAdmin.from("knowledge").update(updateData).eq("id", id);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data: knowledge, error } = await query.select().single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Knowledge entry not found");
        }
        throw new Error(`Failed to update knowledge entry: ${error.message}`);
      }

      logger.info("Knowledge entry updated successfully", {
        knowledgeId: id,
        tenantId,
      });

      return knowledge;
    } catch (error) {
      logger.error("Update knowledge service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Delete knowledge entry
   */
  async deleteKnowledge(id: string, tenantId?: string): Promise<void> {
    try {
      let query = supabaseAdmin.from("knowledge").delete().eq("id", id);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { error } = await query;

      if (error) {
        throw new Error(`Failed to delete knowledge entry: ${error.message}`);
      }

      logger.info("Knowledge entry deleted successfully", { knowledgeId: id, tenantId });
    } catch (error) {
      logger.error("Delete knowledge service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId: id,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Check if user owns knowledge entry
   */
  async isKnowledgeOwner(knowledgeId: string, userId: string, tenantId?: string): Promise<boolean> {
    try {
      let query = supabaseAdmin
        .from("knowledge")
        .select("agent_id, agents(owner_id)")
        .eq("id", knowledgeId);

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data, error } = await query.single();

      if (error || !data) {
        return false;
      }

      // Handle the joined data safely
      const knowledge = data as { agent_id: string; agents: { owner_id: string }[] | null };
      const agentData = knowledge.agents?.[0];

      // Check if agents data exists and has owner_id
      if (!agentData || !agentData.owner_id) {
        return false;
      }

      return agentData.owner_id === userId;
    } catch (error) {
      logger.error("Check knowledge ownership error", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId,
        userId,
        tenantId,
      });
      return false;
    }
  }

  /**
   * Get knowledge statistics for a tenant
   */
  async getKnowledgeStats(tenantId?: string): Promise<KnowledgeStats> {
    try {
      let query = supabaseAdmin.from("knowledge").select("id, agent_id, created_at, updated_at");

      if (tenantId) {
        query = query.eq("tenant_id", tenantId);
      }

      const { data: knowledge, error } = await query;

      if (error) {
        throw new Error(`Failed to get knowledge stats: ${error.message}`);
      }

      const total = knowledge?.length || 0;
      const withAgents = knowledge?.filter((k) => k.agent_id).length || 0;
      const standalone = total - withAgents;

      // Count recent entries (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recent = knowledge?.filter((k) => new Date(k.created_at) > thirtyDaysAgo).length || 0;

      return {
        total,
        withAgents,
        standalone,
        recent,
      };
    } catch (error) {
      logger.error("Get knowledge stats service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Search knowledge entries
   */
  async searchKnowledge(
    options: KnowledgeSearchOptions,
    tenantId?: string
  ): Promise<KnowledgeListResponse> {
    try {
      const { query, page = 1, limit = 10, agentId } = options;
      const offset = (page - 1) * limit;

      let dbQuery = supabaseAdmin
        .from("knowledge")
        .select("*", { count: "exact" })
        .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

      if (tenantId) {
        dbQuery = dbQuery.eq("tenant_id", tenantId);
      }

      if (agentId) {
        dbQuery = dbQuery.eq("agent_id", agentId);
      }

      const { data: knowledge, error, count } = await dbQuery;

      if (error) {
        throw new Error(`Failed to search knowledge: ${error.message}`);
      }

      return {
        knowledge: knowledge || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      };
    } catch (error) {
      logger.error("Search knowledge service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        query: options.query,
        tenantId,
      });
      throw error;
    }
  }
}

// Create and export service instance
export const knowledgeService = new KnowledgeService();

// Export individual methods for backward compatibility
export const {
  createKnowledge,
  getKnowledgeById,
  getKnowledgeByAgentId,
  getKnowledgeByTenant,
  updateKnowledge,
  deleteKnowledge,
  isKnowledgeOwner,
  getKnowledgeStats,
  searchKnowledge,
} = knowledgeService;

export default knowledgeService;
