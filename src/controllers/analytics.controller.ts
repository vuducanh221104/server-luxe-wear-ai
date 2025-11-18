/**
 * @file analytics.controller.ts
 * @description Analytics controller for data analysis and reporting
 * Handles HTTP requests for analytics-related operations
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { successResponse, errorResponse } from "../utils/response";
import { handleAsyncOperationStrict } from "../utils/errorHandler";
import logger from "../config/logger";
import analyticsService from "../services/analytics.service";

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

        // Call service to get analytics
        const result = await analyticsService.getUserAnalytics(
          userId,
          req.tenant.id,
          period as string
        );

        return successResponse(res, result, "User analytics retrieved successfully");
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
        const { period = "30d", startDate, endDate, agentId } = req.query;

        // Call service to get analytics
        const result = await analyticsService.getTenantAnalytics(
          tenantId,
          period as string,
          startDate as string | undefined,
          endDate as string | undefined,
          agentId as string | undefined
        );

        return successResponse(res, result, "Tenant analytics retrieved successfully");
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

        // Call service to get analytics
        const result = await analyticsService.getAgentAnalytics(agentId, userId, req.tenant.id);

        return successResponse(res, result, "Agent analytics retrieved successfully");
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
        const tenantId = req.tenant.id;

        // Call service to export analytics
        const analytics = await analyticsService.exportAnalytics(tenantId, {
          startDate: startDate as string | undefined,
          endDate: endDate as string | undefined,
          agentId: agentId as string | undefined,
        });

        // Format data based on requested format
        if (format === "csv") {
          const csvData = analyticsService.formatAsCSV(analytics);

          res.setHeader("Content-Type", "text/csv");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename="analytics-${tenantId}-${new Date().toISOString().split("T")[0]}.csv"`
          );
          return res.send(csvData);
        } else {
          // JSON format
          return successResponse(
            res,
            {
              exportDate: new Date().toISOString(),
              tenantId,
              totalRecords: analytics.length,
              data: analytics,
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

        // Call service to get system analytics
        const result = await analyticsService.getSystemAnalytics();

        logger.info("Admin: System analytics retrieved", {
          adminId: req.user?.id,
          ...result,
        });

        return successResponse(res, result, "System analytics retrieved successfully");
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
