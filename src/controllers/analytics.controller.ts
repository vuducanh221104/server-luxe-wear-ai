/**
 * @file analytics.controller.ts
 * @description Analytics controller for data analysis and reporting
 * Handles HTTP requests for analytics-related operations
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { successResponse, errorResponse } from "../utils/response";
import { supabaseAdmin } from "../config/supabase";
import { handleAsyncOperationStrict } from "../utils/errorHandler";
import logger from "../config/logger";

/**
 * Analytics Controller Class
 * Object-based controller for analytics operations
 */
export class AnalyticsController {
  /**
   * Get user analytics
   * GET /api/analytics/user
   * @access User + Tenant Context
   */
  async getUserAnalytics(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
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

        const userId = req.user.id;
        const { period = "30d" } = req.query;

        // Get analytics data for the user
        const { data: analytics, error } = await supabaseAdmin
          .from("analytics")
          .select("*")
          .eq("user_id", userId)
          .eq("tenant_id", req.tenant.id)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          logger.error("Get user analytics error", { error: error.message, userId });
          throw new Error(error.message);
        }

        // Process analytics data
        const totalQueries = analytics?.length || 0;
        const uniqueAgents = new Set(analytics?.map((a) => a.agent_id)).size;
        const avgResponseLength = analytics?.length
          ? Math.round(
              analytics.reduce((sum, a) => sum + (a.response?.length || 0), 0) / analytics.length
            )
          : 0;

        return successResponse(
          res,
          {
            totalQueries,
            uniqueAgents,
            avgResponseLength,
            period,
            recentQueries: analytics?.slice(0, 10) || [],
          },
          "User analytics retrieved successfully"
        );
      },
      "get user analytics",
      {
        context: {
          userId: req.user?.id,
          period: req.query.period,
        },
      }
    );
  }

  /**
   * Get agent analytics
   * GET /api/analytics/agents/:agentId
   * @access User (Agent Owner) + Tenant Context
   */
  async getAgentAnalytics(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
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
        const userId = req.user.id;

        // Get analytics data for the specific agent
        const { data: analytics, error } = await supabaseAdmin
          .from("analytics")
          .select("*")
          .eq("agent_id", agentId)
          .eq("user_id", userId)
          .eq("tenant_id", req.tenant.id)
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) {
          logger.error("Get agent analytics error", { error: error.message, agentId, userId });
          throw new Error(error.message);
        }

        // Process analytics data
        const totalQueries = analytics?.length || 0;
        const avgResponseLength = analytics?.length
          ? Math.round(
              analytics.reduce((sum, a) => sum + (a.response?.length || 0), 0) / analytics.length
            )
          : 0;

        return successResponse(
          res,
          {
            agentId,
            totalQueries,
            avgResponseLength,
            recentQueries: analytics?.slice(0, 10) || [],
          },
          "Agent analytics retrieved successfully"
        );
      },
      "get agent analytics",
      {
        context: {
          userId: req.user?.id,
          agentId: req.params.agentId,
        },
      }
    );
  }

  /**
   * Get system analytics (Admin only)
   * GET /api/analytics/system
   * @access Admin
   */
  async getSystemAnalytics(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        // Get total analytics count
        const { count: totalAnalytics } = await supabaseAdmin
          .from("analytics")
          .select("*", { count: "exact", head: true });

        // Get unique users count
        const { data: uniqueUsers } = await supabaseAdmin
          .from("analytics")
          .select("user_id")
          .not("user_id", "is", null);

        const uniqueUsersCount = new Set(uniqueUsers?.map((u) => u.user_id)).size;

        // Get unique agents count
        const { data: uniqueAgents } = await supabaseAdmin
          .from("analytics")
          .select("agent_id")
          .not("agent_id", "is", null);

        const uniqueAgentsCount = new Set(uniqueAgents?.map((a) => a.agent_id)).size;

        // Get unique tenants count
        const { data: uniqueTenants } = await supabaseAdmin
          .from("analytics")
          .select("tenant_id")
          .not("tenant_id", "is", null);

        const uniqueTenantsCount = new Set(uniqueTenants?.map((t) => t.tenant_id)).size;

        logger.info("Admin: System analytics retrieved", {
          adminId: req.user?.id,
          totalAnalytics,
          uniqueUsersCount,
          uniqueAgentsCount,
          uniqueTenantsCount,
        });

        return successResponse(
          res,
          {
            totalAnalytics: totalAnalytics || 0,
            uniqueUsers: uniqueUsersCount,
            uniqueAgents: uniqueAgentsCount,
            uniqueTenants: uniqueTenantsCount,
          },
          "System analytics retrieved successfully"
        );
      },
      "get system analytics (admin)",
      {
        context: {
          adminId: req.user?.id,
        },
      }
    );
  }

  /**
   * Health check for analytics
   * GET /api/analytics/health
   * @access Public
   */
  async healthCheck(_req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        return successResponse(
          res,
          {
            status: "ok",
            timestamp: new Date().toISOString(),
            service: "analytics",
          },
          "Analytics service is healthy"
        );
      },
      "analytics health check",
      {
        context: {
          userAgent: _req.get("User-Agent"),
          ip: _req.ip,
        },
      }
    );
  }
}

// Create and export controller instance
export const analyticsController = new AnalyticsController();

// Export individual methods for backward compatibility
export const { getUserAnalytics, getAgentAnalytics, getSystemAnalytics, healthCheck } =
  analyticsController;

export default analyticsController;
