/**
 * @file agent.controller.ts
 * @description Agent controller for AI agent management
 * Handles HTTP requests for agent-related operations with multi-tenancy support
 *
 * Routes are organized as:
 * - User Routes: Agent owners can manage their own agents within their tenant
 * - Admin Routes: System administrators can manage all agents across tenants
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { agentService } from "../services/agent.service";
import { successResponse, errorResponse } from "../utils/response";
import { chatWithRAG } from "../services/rag.service";
import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import { handleAsyncOperationStrict } from "../utils/errorHandler";

/**
 * Agent Controller Class
 * Object-based controller for agent operations with multi-tenancy support
 */
export class AgentController {
  // ===========================
  // User Routes (Agent Owners)
  // ===========================

  /**
   * Create a new agent
   * POST /api/agents
   * @access User (Agent Owner) + Tenant Context
   */
  async createAgent(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { name, description, config } = req.body;

        const agent = await agentService.createAgent(
          req.user.id,
          {
            name,
            description,
            config,
          },
          req.tenant.id
        );

        return successResponse(
          res,
          {
            id: agent.id,
            name: agent.name,
            description: agent.description,
            config: agent.config,
            createdAt: agent.created_at,
            updatedAt: agent.updated_at,
          },
          "Agent created successfully",
          201
        );
      },
      "create agent",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          agentName: req.body?.name,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Get agent by ID
   * GET /api/agents/:agentId
   * @access User (Agent Owner) + Tenant Context
   */
  async getAgent(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { agentId } = req.params;

        const agent = await agentService.getAgentById(agentId, req.user.id, req.tenant.id);

        return successResponse(
          res,
          {
            id: agent.id,
            name: agent.name,
            description: agent.description,
            config: agent.config,
            createdAt: agent.created_at,
            updatedAt: agent.updated_at,
          },
          "Agent retrieved successfully"
        );
      },
      "get agent",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          agentId: req.params.agentId,
        },
      }
    );
  }

  /**
   * List user's agents
   * GET /api/agents
   * @access User (Agent Owner) + Tenant Context
   */
  async listAgents(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.perPage as string) || 10;

        const result = await agentService.listUserAgents(req.user.id, req.tenant.id, page, perPage);

        return successResponse(
          res,
          {
            agents: result.agents.map((agent) => ({
              id: agent.id,
              name: agent.name,
              description: agent.description,
              config: agent.config,
              tenant: agent.tenant_id,
              createdAt: agent.created_at,
              updatedAt: agent.updated_at,
            })),
            pagination: result.pagination,
          },
          "Agents retrieved successfully"
        );
      },
      "list agents",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          page: req.query.page,
          perPage: req.query.perPage,
        },
      }
    );
  }

  /**
   * Update agent
   * PUT /api/agents/:agentId
   * @access User (Agent Owner) + Tenant Context
   */
  async updateAgent(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { agentId } = req.params;
        const { name, description, config } = req.body;

        const agent = await agentService.updateAgent(agentId, req.user.id, req.tenant.id, {
          name,
          description,
          config,
        });

        return successResponse(
          res,
          {
            id: agent.id,
            name: agent.name,
            description: agent.description,
            config: agent.config,
            createdAt: agent.created_at,
            updatedAt: agent.updated_at,
          },
          "Agent updated successfully"
        );
      },
      "update agent",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          agentId: req.params.agentId,
          updateFields: Object.keys(req.body || {}),
        },
      }
    );
  }

  /**
   * Delete agent
   * DELETE /api/agents/:agentId
   * @access User (Agent Owner) + Tenant Context
   */
  async deleteAgent(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { agentId } = req.params;

        await agentService.deleteAgent(agentId, req.user.id, req.tenant.id);

        return successResponse(res, null, "Agent deleted successfully");
      },
      "delete agent",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          agentId: req.params.agentId,
        },
      }
    );
  }

  /**
   * Get agent statistics
   * GET /api/agents/:agentId/stats
   * @access User (Agent Owner) + Tenant Context
   */
  async getAgentStats(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { agentId } = req.params;

        const stats = await agentService.getAgentStats(agentId, req.user.id, req.tenant.id);

        return successResponse(res, stats, "Agent statistics retrieved successfully");
      },
      "get agent stats",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          agentId: req.params.agentId,
        },
      }
    );
  }

  /**
   * Search agents
   * GET /api/agents/search
   * @access User (Agent Owner) + Tenant Context
   */
  async searchAgents(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const searchTerm = req.query.q as string;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;

        const result = await agentService.searchAgents(
          req.user.id,
          req.tenant.id,
          searchTerm,
          page,
          limit
        );

        return successResponse(
          res,
          {
            agents: result.agents.map((agent) => ({
              id: agent.id,
              name: agent.name,
              description: agent.description,
              config: agent.config,
              createdAt: agent.created_at,
              updatedAt: agent.updated_at,
            })),
            pagination: result.pagination,
          },
          "Agent search completed successfully"
        );
      },
      "search agents",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          searchTerm: req.query.q,
          limit: req.query.limit,
        },
      }
    );
  }

  /**
   * Chat with agent (private - requires authentication)
   * POST /api/agents/:agentId/chat
   * @access User (Agent Owner) + Tenant Context
   */
  async chatWithAgent(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { agentId } = req.params;
        const { message, context } = req.body;

        // Get agent and verify ownership
        const agent = await agentService.getAgentById(agentId, req.user.id, req.tenant.id);

        // Get agent configuration
        const agentConfig = agent.config as Record<string, unknown>;
        const systemPrompt =
          (agentConfig?.systemPrompt as string) || "You are a helpful AI assistant.";

        const startTime = Date.now();

        logger.info("Agent chat request", {
          agentId,
          userId: req.user.id,
          tenantId: req.tenant.id,
          messageLength: message.length,
          hasContext: !!context,
        });

        // Check if user has knowledge base to decide RAG vs direct AI
        let useRag = false;
        try {
          const { count, error: countError } = await supabaseAdmin
            .from("knowledge")
            .select("*", { count: "exact", head: true })
            .eq("user_id", req.user.id)
            .eq("tenant_id", req.tenant.id)
            .limit(1);

          if (!countError) {
            useRag = (count || 0) > 0;
          }

          logger.info("Knowledge base check", {
            agentId,
            userId: req.user.id,
            hasKnowledge: useRag,
            knowledgeCount: count || 0,
          });
        } catch (error) {
          logger.warn("Failed to check knowledge base, defaulting to direct AI", {
            agentId,
            error: error instanceof Error ? error.message : "Unknown error",
          });
          useRag = false;
        }

        // Generate AI response
        const aiStartTime = Date.now();
        let response: string;

        if (useRag) {
          // Use RAG pipeline with knowledge base
          logger.info("Using RAG pipeline with knowledge base");
          response = await chatWithRAG(
            context ? `${context}\n\nUser: ${message}` : message,
            req.user.id,
            systemPrompt
          );
        } else {
          // Direct AI call without RAG (faster - use Flash model)
          logger.info("Using direct AI (no knowledge base)");
          const { geminiApi } = await import("../integrations/gemini.api");
          const fullMessage = context ? `${context}\n\nUser: ${message}` : message;
          const prompt = `${systemPrompt}\n\nUser: ${fullMessage}\n\n[IMPORTANT: Keep response focused and under 2000 words. Be detailed but concise.]`;

          const result = await geminiApi.generateContent(prompt, {
            model: "gemini-2.5-flash",
            maxOutputTokens: 3072,
            temperature: 0.7,
          });

          if (!result.data) {
            throw new Error("AI response is empty");
          }

          response = result.data;
        }

        const aiDuration = Date.now() - aiStartTime;

        // Log analytics asynchronously (fire-and-forget)
        const userId = req.user.id;
        const tenantId = req.tenant.id;
        (async (): Promise<void> => {
          try {
            await supabaseAdmin.from("analytics").insert({
              agent_id: agentId,
              user_id: userId,
              tenant_id: tenantId,
              query: message,
              response: response,
              vector_score: null,
            });
            logger.debug("Analytics logged", { agentId });
          } catch (analyticsError) {
            logger.warn("Failed to log analytics", {
              agentId,
              userId,
              tenantId,
              error: analyticsError instanceof Error ? analyticsError.message : "Unknown error",
            });
          }
        })();

        const totalDuration = Date.now() - startTime;

        logger.info("Agent chat completed", {
          agentId,
          userId: req.user.id,
          tenantId: req.tenant.id,
          responseLength: response.length,
          aiDuration: `${aiDuration}ms`,
          totalDuration: `${totalDuration}ms`,
          usedRag: useRag,
        });

        return successResponse(
          res,
          {
            response,
            agent: {
              id: agent.id,
              name: agent.name,
              description: agent.description,
            },
            timestamp: new Date().toISOString(),
            performance: {
              aiDuration,
              totalDuration,
              useRag,
            },
          },
          "Chat response generated successfully"
        );
      },
      "chat with agent",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          agentId: req.params.agentId,
          messageLength: req.body?.message?.length,
        },
      }
    );
  }

  /**
   * Regenerate agent API key
   * POST /api/agents/:agentId/regenerate-key
   * @access User (Agent Owner) + Tenant Context
   */
  async regenerateAgentApiKey(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { agentId } = req.params;

        const agent = await agentService.regenerateApiKey(agentId, req.user.id, req.tenant.id);

        return successResponse(
          res,
          {
            id: agent.id,
            name: agent.name,
            apiKey: agent.api_key,
            updatedAt: agent.updated_at,
          },
          "API key regenerated successfully"
        );
      },
      "regenerate agent API key",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          agentId: req.params.agentId,
        },
      }
    );
  }

  /**
   * Toggle agent public status
   * PATCH /api/agents/:agentId/public
   * @access User (Agent Owner) + Tenant Context
   */
  async toggleAgentPublic(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        if (!req.tenant) {
          return errorResponse(res, "Tenant context not found", 400);
        }

        const { agentId } = req.params;
        const { isPublic } = req.body;

        const agent = await agentService.toggleAgentPublicStatus(
          agentId,
          req.user.id,
          req.tenant.id,
          isPublic
        );

        return successResponse(
          res,
          {
            id: agent.id,
            name: agent.name,
            isPublic: agent.is_public,
            apiKey: agent.is_public ? agent.api_key : undefined, // Only show API key if public
            updatedAt: agent.updated_at,
          },
          `Agent ${isPublic ? "made public" : "made private"} successfully`
        );
      },
      "toggle agent public status",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          agentId: req.params.agentId,
          isPublic: req.body?.isPublic,
        },
      }
    );
  }

  // ===========================
  // Admin Routes (System Administration)
  // ===========================

  /**
   * List all agents in system (Admin only)
   * GET /api/agents/admin/all
   * @access Admin
   */
  async listAllAgents(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.perPage as string) || 10;
        const offset = (page - 1) * perPage;

        // Get total count of all agents
        const { count, error: countError } = await supabaseAdmin
          .from("agents")
          .select("*", { count: "exact", head: true });

        if (countError) {
          throw new Error(countError.message);
        }

        // Get all agents with pagination (no owner filter)
        const { data: agents, error } = await supabaseAdmin
          .from("agents")
          .select(
            `
          *,
          owner:owner_id (
            id,
            email,
            name,
            role
          ),
          tenant:tenant_id (
            id,
            name,
            plan
          )
        `
          )
          .order("created_at", { ascending: false })
          .range(offset, offset + perPage - 1);

        if (error) {
          throw new Error(error.message);
        }

        const total = count || 0;
        const totalPages = Math.ceil(total / perPage);

        logger.info("Admin: All agents listed", {
          adminId: req.user?.id,
          total,
          page,
          perPage,
        });

        return successResponse(
          res,
          {
            agents: agents.map((agent) => ({
              id: agent.id,
              name: agent.name,
              description: agent.description,
              isPublic: agent.is_public,
              hasApiKey: !!agent.api_key,
              owner: agent.owner,
              tenant: agent.tenant,
              createdAt: agent.created_at,
              updatedAt: agent.updated_at,
            })),
            pagination: {
              page,
              perPage,
              total,
              totalPages,
            },
          },
          "All agents retrieved successfully"
        );
      },
      "list all agents (admin)",
      {
        context: {
          adminId: req.user?.id,
          page: req.query.page,
          perPage: req.query.perPage,
        },
      }
    );
  }

  /**
   * Get system-wide agent statistics (Admin only)
   * GET /api/agents/admin/stats
   * @access Admin
   */
  async getSystemAgentStats(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const stats = await agentService.getSystemAgentStats();

        logger.info("Admin: System stats retrieved", {
          adminId: req.user?.id,
          totalAgents: stats.totalAgents,
          publicAgents: stats.publicAgents,
          totalTenants: stats.totalTenants,
        });

        return successResponse(res, stats, "System statistics retrieved successfully");
      },
      "get system agent stats (admin)",
      {
        context: { adminId: req.user?.id },
      }
    );
  }

  /**
   * Force delete any agent (Admin only)
   * DELETE /api/agents/admin/:agentId
   * @access Admin
   */
  async forceDeleteAgent(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { agentId } = req.params;

        const agent = await agentService.forceDeleteAgent(agentId);

        logger.warn("Admin: Agent force deleted", {
          agentId,
          agentName: agent.name,
          originalOwner: agent.owner_id,
          tenantId: agent.tenant_id,
          adminId: req.user?.id,
          adminEmail: req.user?.email,
        });

        return successResponse(res, null, "Agent deleted successfully");
      },
      "force delete agent (admin)",
      {
        context: {
          adminId: req.user?.id,
          agentId: req.params.agentId,
        },
      }
    );
  }

  /**
   * Get specific user's agents (Admin only)
   * GET /api/agents/admin/users/:userId/agents
   * @access Admin
   */
  async getUserAgents(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { userId } = req.params;
        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.perPage as string) || 10;

        const result = await agentService.getUserAgents(userId, page, perPage);

        logger.info("Admin: User agents retrieved", {
          targetUserId: userId,
          adminId: req.user?.id,
          total: result.pagination.totalCount,
        });

        return successResponse(
          res,
          {
            userId,
            agents: result.agents.map((agent) => {
              const agentWithTenant = agent as typeof agent & {
                tenant?: { id: string; name: string; plan: string };
              };
              return {
                id: agent.id,
                name: agent.name,
                description: agent.description,
                isPublic: agent.is_public,
                hasApiKey: !!agent.api_key,
                tenant: agentWithTenant.tenant_id,
                createdAt: agent.created_at,
                updatedAt: agent.updated_at,
              };
            }),
            pagination: {
              page: result.pagination.page,
              perPage: result.pagination.perPage,
              total: result.pagination.totalCount,
              totalPages: result.pagination.totalPages,
            },
          },
          "User agents retrieved successfully"
        );
      },
      "get user agents (admin)",
      {
        context: {
          adminId: req.user?.id,
          targetUserId: req.params.userId,
          page: req.query.page,
          perPage: req.query.perPage,
        },
      }
    );
  }
}

// Create and export controller instance
export const agentController = new AgentController();

// Export individual methods for backward compatibility
export const {
  createAgent,
  getAgent,
  listAgents,
  updateAgent,
  deleteAgent,
  getAgentStats,
  searchAgents,
  chatWithAgent,
  regenerateAgentApiKey,
  toggleAgentPublic,
  listAllAgents,
  getSystemAgentStats,
  forceDeleteAgent,
  getUserAgents,
} = agentController;

export default agentController;
