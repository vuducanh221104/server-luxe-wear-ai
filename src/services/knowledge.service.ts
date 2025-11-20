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
} from "../types";

/**
 * Knowledge service class for database operations
 */
export class KnowledgeService {
  /**
   * Create a new knowledge entry with vector storage
   */
  async createKnowledge(data: KnowledgeInsert): Promise<Knowledge> {
    try {
      logger.info("Creating knowledge entry", {
        title: data.title,
        agentId: data.agent_id,
        tenantId: data.tenant_id,
        userId: data.user_id,
      });

      // Validate agent_id if provided
      if (data.agent_id) {
        const { data: agent, error: agentError } = await supabaseAdmin
          .from("agents")
          .select("id")
          .eq("id", data.agent_id)
          .eq("tenant_id", data.tenant_id)
          .single();

        if (agentError || !agent) {
          logger.warn("Agent not found, setting agent_id to null", {
            agentId: data.agent_id,
            tenantId: data.tenant_id,
          });
          data.agent_id = null; // Set to null if agent doesn't exist
        }
      }

      // 1. Store in Supabase database
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
        id: knowledge.id,
        title: knowledge.title,
      });

      return knowledge;
    } catch (error) {
      logger.error("Failed to create knowledge entry", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Get knowledge entry by ID
   */
  async getKnowledgeById(id: string, userId: string, tenantId: string): Promise<Knowledge | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("knowledge")
        .select("*")
        .eq("id", id)
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // Not found
          return null;
        }
        throw new Error(error.message);
      }

      return data;
    } catch (error) {
      logger.error("Failed to get knowledge entry", {
        error: error instanceof Error ? error.message : "Unknown error",
        id,
      });
      throw error;
    }
  }

  /**
   * List knowledge entries with pagination (generic method)
   */
  async listKnowledge(
    userId: string,
    tenantId: string,
    options: KnowledgeListOptions
  ): Promise<KnowledgeListResponse> {
    try {
      const { agentId, page = 1, limit = 10, search } = options;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from("knowledge")
        .select("*", { count: "exact" })
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      // Filter by agent if provided
      if (agentId) {
        query = query.eq("agent_id", agentId);
      }

      // Search filter
      if (search) {
        query = query.or(`title.ilike.%${search}%,metadata->>description.ilike.%${search}%`);
      }

      const { data, error, count } = await query.range(offset, offset + limit - 1);

      if (error) {
        throw new Error(error.message);
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        knowledge: data || [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error("Failed to list knowledge entries", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        tenantId,
        options,
      });
      throw error;
    }
  }

  /**
   * Get user knowledge entries (wrapper for listKnowledge)
   */
  async getUserKnowledge(
    userId: string,
    tenantId: string,
    options: KnowledgeListOptions
  ): Promise<KnowledgeListResponse> {
    return this.listKnowledge(userId, tenantId, options);
  }

  /**
   * Get all knowledge entries (admin only)
   */
  async getAllKnowledge(options: KnowledgeListOptions): Promise<KnowledgeListResponse> {
    try {
      const { page = 1, limit = 10, agentId, search } = options;
      const offset = (page - 1) * limit;

      let query = supabaseAdmin
        .from("knowledge")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false });

      if (agentId) {
        query = query.eq("agent_id", agentId);
      }

      if (search) {
        query = query.or(`title.ilike.%${search}%,metadata->>description.ilike.%${search}%`);
      }

      const { data, error, count } = await query.range(offset, offset + limit - 1);

      if (error) {
        throw new Error(error.message);
      }

      const total = count || 0;
      const totalPages = Math.ceil(total / limit);

      return {
        knowledge: data || [],
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
      };
    } catch (error) {
      logger.error("Failed to get all knowledge", {
        error: error instanceof Error ? error.message : "Unknown error",
        options,
      });
      throw error;
    }
  }

  /**
   * Update knowledge entry
   */
  async updateKnowledge(
    id: string,
    updates: KnowledgeUpdate,
    userId: string,
    tenantId: string
  ): Promise<Knowledge> {
    try {
      // Validate agent_id if provided in updates
      if (updates.agent_id !== undefined && updates.agent_id !== null) {
        const { data: agent, error: agentError } = await supabaseAdmin
          .from("agents")
          .select("id")
          .eq("id", updates.agent_id)
          .eq("tenant_id", tenantId)
          .single();

        if (agentError || !agent) {
          logger.warn("Agent not found during update, setting agent_id to null", {
            agentId: updates.agent_id,
            tenantId,
            knowledgeId: id,
          });
          updates.agent_id = null; // Set to null if agent doesn't exist
        }
      }

      const { data, error } = await supabaseAdmin
        .from("knowledge")
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .select()
        .single();

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error("Knowledge entry not found");
      }

      logger.info("Knowledge entry updated", {
        id,
        updates,
      });

      return data;
    } catch (error) {
      logger.error("Failed to update knowledge entry", {
        error: error instanceof Error ? error.message : "Unknown error",
        id,
      });
      throw error;
    }
  }

  /**
   * Delete knowledge entry
   */
  async deleteKnowledge(id: string, userId: string, tenantId: string): Promise<void> {
    try {
      // Get knowledge entry first to verify ownership
      const knowledge = await this.getKnowledgeById(id, userId, tenantId);

      if (!knowledge) {
        throw new Error("Knowledge entry not found");
      }

      // Delete from database first (fast operation) - return immediately
      const { error } = await supabaseAdmin
        .from("knowledge")
        .delete()
        .eq("id", id)
        .eq("user_id", userId)
        .eq("tenant_id", tenantId);

      if (error) {
        throw new Error(error.message);
      }

      logger.info("Knowledge entry deleted from database", { id });

      // Cleanup operations in background (don't wait for these)
      // Delete from vector database (non-blocking)
      Promise.all([
        (async () => {
          try {
            const { deleteKnowledge: deleteFromVector } = await import("./vector.service");
            await deleteFromVector(id);
            logger.info("Knowledge deleted from vector DB", { id });
          } catch (vectorError) {
            logger.warn("Failed to delete from vector database (non-critical)", {
              id,
              error: vectorError instanceof Error ? vectorError.message : "Unknown error",
            });
          }
        })(),
        // Delete file from storage if exists (non-blocking)
        knowledge.file_url
          ? (async () => {
              try {
                const { storageService } = await import("./storage.service");
                await storageService.deleteKnowledgeFile(knowledge.file_url!, userId);
                logger.info("Knowledge file deleted from storage", { id, fileUrl: knowledge.file_url });
              } catch (storageError) {
                logger.warn("Failed to delete file from storage (non-critical)", {
                  fileUrl: knowledge.file_url,
                  error: storageError instanceof Error ? storageError.message : "Unknown error",
                });
              }
            })()
          : Promise.resolve(),
      ]).catch((error) => {
        // Log but don't throw - cleanup failures are non-critical
        logger.warn("Background cleanup failed (non-critical)", {
          id,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      });
    } catch (error) {
      logger.error("Failed to delete knowledge entry", {
        error: error instanceof Error ? error.message : "Unknown error",
        id,
      });
      throw error;
    }
  }

  /**
   * Search knowledge entries
   */
  async searchKnowledge(
    query: string,
    userId: string,
    tenantId: string,
    limit: number = 20,
    agentId?: string
  ): Promise<Knowledge[]> {
    try {
      let dbQuery = supabaseAdmin
        .from("knowledge")
        .select("*")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .or(`title.ilike.%${query}%,metadata->>description.ilike.%${query}%`)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (agentId) {
        dbQuery = dbQuery.eq("agent_id", agentId);
      }

      const { data, error } = await dbQuery;

      if (error) {
        throw new Error(error.message);
      }

      return data || [];
    } catch (error) {
      logger.error("Failed to search knowledge", {
        error: error instanceof Error ? error.message : "Unknown error",
        query,
      });
      throw error;
    }
  }

  /**
   * Get knowledge entries by agent
   */
  async getKnowledgeByAgent(
    agentId: string,
    userId: string,
    tenantId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<KnowledgeListResponse> {
    return this.listKnowledge(userId, tenantId, {
      agentId,
      page,
      limit,
    });
  }

  /**
   * Get knowledge stats for user
   */
  async getKnowledgeStats(
    userId?: string,
    tenantId?: string
  ): Promise<{
    totalEntries: number;
    totalSize: number;
    entriesByAgent: Record<string, number>;
  }> {
    try {
      let query = supabaseAdmin.from("knowledge").select("id, agent_id, file_size");

      // If userId and tenantId provided, filter by them (user stats)
      if (userId && tenantId) {
        query = query.eq("user_id", userId).eq("tenant_id", tenantId);
      }
      // Otherwise, get global stats (admin stats)

      const { data, error } = await query;

      if (error) {
        throw new Error(error.message);
      }

      const totalEntries = data?.length || 0;
      const totalSize = data?.reduce((sum, entry) => sum + (entry.file_size || 0), 0) || 0;
      const entriesByAgent: Record<string, number> = {};

      data?.forEach((entry) => {
        const agentKey = entry.agent_id || "unassigned";
        entriesByAgent[agentKey] = (entriesByAgent[agentKey] || 0) + 1;
      });

      return {
        totalEntries,
        totalSize,
        entriesByAgent,
      };
    } catch (error) {
      logger.error("Failed to get knowledge stats", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Admin: Force delete knowledge entry
   */
  async forceDeleteKnowledge(id: string): Promise<void> {
    try {
      // Get knowledge entry
      const { data: knowledge, error: fetchError } = await supabaseAdmin
        .from("knowledge")
        .select("*")
        .eq("id", id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!knowledge) {
        throw new Error("Knowledge entry not found");
      }

      // Delete from vector database
      try {
        const { deleteKnowledge: deleteFromVector } = await import("./vector.service");
        await deleteFromVector(id);
      } catch (vectorError) {
        logger.warn("Failed to delete from vector database during force delete", {
          id,
          error: vectorError instanceof Error ? vectorError.message : "Unknown error",
        });
      }

      // Delete file from storage if exists
      if (knowledge.file_url && knowledge.user_id) {
        try {
          const { storageService } = await import("./storage.service");
          await storageService.deleteKnowledgeFile(knowledge.file_url, knowledge.user_id);
        } catch (storageError) {
          logger.warn("Failed to delete file from storage during force delete", {
            fileUrl: knowledge.file_url,
            error: storageError instanceof Error ? storageError.message : "Unknown error",
          });
        }
      }

      // Delete from database
      const { error } = await supabaseAdmin.from("knowledge").delete().eq("id", id);

      if (error) {
        throw new Error(error.message);
      }

      logger.info("Knowledge entry force deleted", { id });
    } catch (error) {
      logger.error("Failed to force delete knowledge", {
        error: error instanceof Error ? error.message : "Unknown error",
        knowledgeId: id,
      });
      throw error;
    }
  }
}

// Create and export service instance
export const knowledgeService = new KnowledgeService();
export default knowledgeService;
