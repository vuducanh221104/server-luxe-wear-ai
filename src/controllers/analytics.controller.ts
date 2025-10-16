/**
 * @file analytics.controller.ts
 * @description Analytics controller for data analysis and reporting
 * Handles HTTP requests for analytics-related operations
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { successResponse, errorResponse } from "../utils/response";
import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";

/**
 * Analytics Controller Class
 * Object-based controller for analytics operations
 */
export class AnalyticsController {
  /**
   * Get user analytics
   * GET /api/analytics/user
   * @access User
   */
  async getUserAnalytics(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      if (!req.user) {
        return errorResponse(res, "User not authenticated", 401);
      }

      const userId = req.user.id;
      const { period = "30d" } = req.query;

      // Get analytics data for the user
      const { data: analytics, error } = await supabaseAdmin
        .from("analytics")
        .select("*")
        .eq("user_id", userId)
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
    } catch (error) {
      logger.error("Get user analytics controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to get user analytics",
        500
      );
    }
  }

  /**
   * Get agent analytics
   * GET /api/analytics/agents/:agentId
   * @access User (Agent Owner)
   */
  async getAgentAnalytics(req: Request, res: Response): Promise<Response> {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      if (!req.user) {
        return errorResponse(res, "User not authenticated", 401);
      }

      const { agentId } = req.params;
      const userId = req.user.id;

      // Get analytics data for the specific agent
      const { data: analytics, error } = await supabaseAdmin
        .from("analytics")
        .select("*")
        .eq("agent_id", agentId)
        .eq("user_id", userId)
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
    } catch (error) {
      logger.error("Get agent analytics controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        agentId: req.params.agentId,
        userId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to get agent analytics",
        500
      );
    }
  }

  /**
   * Get system analytics (Admin only)
   * GET /api/analytics/system
   * @access Admin
   */
  async getSystemAnalytics(req: Request, res: Response): Promise<Response> {
    try {
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

      logger.info("Admin: System analytics retrieved", {
        adminId: req.user?.id,
        totalAnalytics,
        uniqueUsersCount,
        uniqueAgentsCount,
      });

      return successResponse(
        res,
        {
          totalAnalytics: totalAnalytics || 0,
          uniqueUsers: uniqueUsersCount,
          uniqueAgents: uniqueAgentsCount,
        },
        "System analytics retrieved successfully"
      );
    } catch (error) {
      logger.error("Get system analytics controller error", {
        error: error instanceof Error ? error.message : "Unknown error",
        adminId: req.user?.id,
      });
      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to get system analytics",
        500
      );
    }
  }

  /**
   * Health check for analytics
   * GET /api/analytics/health
   * @access Public
   */
  async healthCheck(_req: Request, res: Response): Promise<Response> {
    return successResponse(
      res,
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "analytics",
      },
      "Analytics service is healthy"
    );
  }
}

// Create and export controller instance
export const analyticsController = new AnalyticsController();

// Export individual methods for backward compatibility
export const { getUserAnalytics, getAgentAnalytics, getSystemAnalytics, healthCheck } =
  analyticsController;

export default analyticsController;
