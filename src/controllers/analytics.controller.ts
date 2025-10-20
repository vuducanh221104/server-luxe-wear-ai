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
   * Get tenant analytics
   * GET /api/analytics/tenant
   * @access User + Tenant Context
   */
  async getTenantAnalytics(req: Request, res: Response): Promise<Response> {
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

        const tenantId = req.tenant.id;
        const { period = "30d", startDate, endDate } = req.query;

        // Build date filter
        let dateFilter: { gte?: string; lte?: string } = {};
        if (startDate && endDate) {
          dateFilter = {
            gte: startDate as string,
            lte: endDate as string,
          };
        } else {
          // Default period filter
          const days = period === "7d" ? 7 : period === "30d" ? 30 : period === "90d" ? 90 : 30;
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);
          dateFilter = {
            gte: startDate.toISOString(),
          };
        }

        // Get analytics data for the tenant
        const { data: analytics, error } = await supabaseAdmin
          .from("analytics")
          .select("*")
          .eq("tenant_id", tenantId)
          .gte("created_at", dateFilter.gte)
          .order("created_at", { ascending: false })
          .limit(1000);

        if (error) {
          logger.error("Get tenant analytics error", { error: error.message, tenantId });
          throw new Error(error.message);
        }

        // Process analytics data
        const totalQueries = analytics?.length || 0;
        const uniqueUsers = new Set(analytics?.map((a) => a.user_id)).size;
        const uniqueAgents = new Set(analytics?.map((a) => a.agent_id)).size;
        const avgResponseLength = analytics?.length
          ? Math.round(
              analytics.reduce((sum, a) => sum + (a.response?.length || 0), 0) / analytics.length
            )
          : 0;

        // Get daily usage stats
        const dailyStats = analytics?.reduce(
          (acc, a) => {
            const date = new Date(a.created_at).toISOString().split("T")[0];
            acc[date] = (acc[date] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        // Get top agents by usage
        const agentUsage = analytics?.reduce(
          (acc, a) => {
            acc[a.agent_id] = (acc[a.agent_id] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>
        );

        const topAgents = Object.entries(agentUsage || {})
          .sort(([, a], [, b]) => (b as number) - (a as number))
          .slice(0, 5)
          .map(([agentId, count]) => ({ agentId, count }));

        logger.info("Tenant analytics retrieved", {
          tenantId,
          totalQueries,
          uniqueUsers,
          uniqueAgents,
          period,
        });

        return successResponse(
          res,
          {
            tenantId,
            totalQueries,
            uniqueUsers,
            uniqueAgents,
            avgResponseLength,
            period,
            dailyStats,
            topAgents,
            recentQueries: analytics?.slice(0, 20) || [],
          },
          "Tenant analytics retrieved successfully"
        );
      },
      "get tenant analytics",
      {
        context: {
          tenantId: req.tenant?.id,
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
   * Export analytics data
   * GET /api/analytics/export
   * @access User + Tenant Context
   */
  async exportAnalytics(req: Request, res: Response): Promise<Response> {
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

        const { format = "json", startDate, endDate, agentId } = req.query;
        const userId = req.user.id;
        const tenantId = req.tenant.id;

        // Build query
        let query = supabaseAdmin.from("analytics").select("*").eq("tenant_id", tenantId);

        // Add filters
        if (agentId) {
          query = query.eq("agent_id", agentId);
        }

        if (startDate && endDate) {
          query = query.gte("created_at", startDate).lte("created_at", endDate);
        }

        const { data: analytics, error } = await query.order("created_at", { ascending: false });

        if (error) {
          logger.error("Export analytics error", { error: error.message, userId, tenantId });
          throw new Error(error.message);
        }

        // Format data based on requested format
        if (format === "csv") {
          const csvHeader = "Date,Agent ID,User ID,Query,Response Length,Vector Score\n";
          const csvData = analytics
            ?.map((a) => {
              const date = new Date(a.created_at).toISOString();
              const query = (a.query || "").replace(/"/g, '""');
              const response = (a.response || "").replace(/"/g, '""');
              return `"${date}","${a.agent_id}","${a.user_id}","${query}",${response.length},${a.vector_score || 0}`;
            })
            .join("\n");

          res.setHeader("Content-Type", "text/csv");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="analytics-${tenantId}-${new Date().toISOString().split("T")[0]}.csv"`
          );
          return res.send(csvHeader + csvData);
        } else {
          // JSON format
          return successResponse(
            res,
            {
              exportDate: new Date().toISOString(),
              tenantId,
              totalRecords: analytics?.length || 0,
              data: analytics || [],
            },
            "Analytics exported successfully"
          );
        }
      },
      "export analytics",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.tenant?.id,
          format: req.query.format,
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
export const {
  getUserAnalytics,
  getTenantAnalytics,
  getAgentAnalytics,
  exportAnalytics,
  getSystemAnalytics,
  healthCheck,
} = analyticsController;

export default analyticsController;
