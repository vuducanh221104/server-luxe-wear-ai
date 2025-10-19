/**
 * @file index.ts
 * @description Central routes export
 * Consolidates all route modules for easy import
 */

import { Router } from "express";
import authRoutes from "./auth.router";
import userRoutes from "./user.router";
import agentRoutes from "./agent.router";
import knowledgeRoutes from "./knowledge.router";
import analyticsRoutes from "./analytics.router";
import publicRoutes from "./public.router";
import tenantRoutes from "./tenant.router";
import webhookRoutes from "./webhook.router";

const router = Router();

/**
 * Mount all routes
 * This provides a single entry point for all API routes
 */
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/agents", agentRoutes);
router.use("/knowledge", knowledgeRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/public", publicRoutes);
router.use("/tenants", tenantRoutes);
router.use("/webhooks", webhookRoutes);

/**
 * Health check endpoint (can be moved to app.ts if preferred)
 */
router.get("/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

export default router;

/**
 * Named exports for individual routes (optional, for flexibility)
 */
export {
  authRoutes,
  userRoutes,
  agentRoutes,
  knowledgeRoutes,
  analyticsRoutes,
  publicRoutes,
  tenantRoutes,
  webhookRoutes,
};
