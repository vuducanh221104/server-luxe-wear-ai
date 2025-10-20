/**
 * @file analytics.router.ts
 * @description Analytics and statistics routes with multi-tenancy support
 */

import { Router } from "express";
import * as analyticsController from "../controllers/analytics.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/admin.middleware";
import { tenantMiddleware } from "../middlewares/tenant.middleware";
import { param } from "express-validator";

const router = Router();

// ===========================
// User Routes (Analytics)
// ===========================

/**
 * GET /api/analytics/user
 * Get user analytics
 * @access User + Tenant Context
 */
router.get("/user", authMiddleware, tenantMiddleware, analyticsController.getUserAnalytics);

/**
 * GET /api/analytics/tenant
 * Get tenant analytics
 * @access User + Tenant Context
 */
router.get("/tenant", authMiddleware, tenantMiddleware, analyticsController.getTenantAnalytics);

/**
 * GET /api/analytics/export
 * Export analytics data
 * @access User + Tenant Context
 */
router.get("/export", authMiddleware, tenantMiddleware, analyticsController.exportAnalytics);

/**
 * GET /api/analytics/agents/:agentId
 * Get agent analytics
 * @access User (Agent Owner) + Tenant Context
 */
router.get(
  "/agents/:agentId",
  authMiddleware,
  tenantMiddleware,
  [param("agentId").isUUID().withMessage("Agent ID must be a valid UUID")],
  analyticsController.getAgentAnalytics
);

// ===========================
// Admin Routes (System Analytics)
// ===========================

/**
 * GET /api/analytics/system
 * Get system analytics (Admin only)
 * @access Admin
 */
router.get("/system", authMiddleware, adminMiddleware, analyticsController.getSystemAnalytics);

/**
 * GET /api/analytics/health
 * Health check for analytics service
 * @access Public
 */
router.get("/health", analyticsController.healthCheck);

export default router;
