/**
 * @file tenant.router.ts
 * @description Tenant routes for multi-tenancy management
 */

import { Router } from "express";
import { param, body } from "express-validator";
import * as tenantController from "../controllers/tenant.controller";
import { authMiddleware } from "../middlewares/auth.middleware";
import { adminMiddleware } from "../middlewares/auth.middleware";
import { strictRateLimiter } from "../middlewares/rateLimiter.middleware";

const router = Router();

// ===========================
// User Routes (Tenant Management)
// ===========================

/**
 * POST /api/tenants
 * Create a new tenant
 * @access User (Tenant Owner)
 */
router.post(
  "/",
  authMiddleware,
  strictRateLimiter,
  [
    body("name")
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage("Tenant name must be between 1 and 100 characters"),
    body("plan")
      .optional()
      .isIn(["free", "pro", "enterprise"])
      .withMessage("Plan must be one of: free, pro, enterprise"),
    body("status")
      .optional()
      .isIn(["active", "inactive", "suspended"])
      .withMessage("Status must be one of: active, inactive, suspended"),
  ],
  tenantController.createTenant
);

/**
 * GET /api/tenants
 * List user's tenants
 * @access User (Tenant Member)
 */
router.get("/", authMiddleware, tenantController.listUserTenants);

/**
 * GET /api/tenants/:tenantId
 * Get tenant by ID
 * @access User (Tenant Member)
 */
router.get(
  "/:tenantId",
  authMiddleware,
  [param("tenantId").isUUID().withMessage("Tenant ID must be a valid UUID")],
  tenantController.getTenant
);

/**
 * PUT /api/tenants/:tenantId
 * Update tenant
 * @access User (Tenant Owner/Admin)
 */
router.put(
  "/:tenantId",
  authMiddleware,
  strictRateLimiter,
  [
    param("tenantId").isUUID().withMessage("Tenant ID must be a valid UUID"),
    body("name")
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage("Tenant name must be between 1 and 100 characters"),
    body("plan")
      .optional()
      .isIn(["free", "pro", "enterprise"])
      .withMessage("Plan must be one of: free, pro, enterprise"),
    body("status")
      .optional()
      .isIn(["active", "inactive", "suspended"])
      .withMessage("Status must be one of: active, inactive, suspended"),
  ],
  tenantController.updateTenant
);

/**
 * DELETE /api/tenants/:tenantId
 * Delete tenant
 * @access User (Tenant Owner)
 */
router.delete(
  "/:tenantId",
  authMiddleware,
  strictRateLimiter,
  [param("tenantId").isUUID().withMessage("Tenant ID must be a valid UUID")],
  tenantController.deleteTenant
);

/**
 * GET /api/tenants/:tenantId/stats
 * Get tenant statistics
 * @access User (Tenant Member)
 */
router.get(
  "/:tenantId/stats",
  authMiddleware,
  [param("tenantId").isUUID().withMessage("Tenant ID must be a valid UUID")],
  tenantController.getTenantStats
);

/**
 * GET /api/tenants/:tenantId/members
 * List tenant members
 * @access User (Tenant Member)
 */
router.get(
  "/:tenantId/members",
  authMiddleware,
  [param("tenantId").isUUID().withMessage("Tenant ID must be a valid UUID")],
  tenantController.listTenantMembers
);

/**
 * POST /api/tenants/:tenantId/members
 * Add user to tenant
 * @access User (Tenant Owner/Admin)
 */
router.post(
  "/:tenantId/members",
  authMiddleware,
  strictRateLimiter,
  [
    param("tenantId").isUUID().withMessage("Tenant ID must be a valid UUID"),
    body("userId").isUUID().withMessage("User ID must be a valid UUID"),
    body("role")
      .optional()
      .isIn(["owner", "admin", "member"])
      .withMessage("Role must be one of: owner, admin, member"),
  ],
  tenantController.addUserToTenant
);

/**
 * PUT /api/tenants/:tenantId/members/:userId
 * Update member role
 * @access User (Tenant Owner/Admin)
 */
router.put(
  "/:tenantId/members/:userId",
  authMiddleware,
  strictRateLimiter,
  [
    param("tenantId").isUUID().withMessage("Tenant ID must be a valid UUID"),
    param("userId").isUUID().withMessage("User ID must be a valid UUID"),
    body("role")
      .isIn(["owner", "admin", "member"])
      .withMessage("Role must be one of: owner, admin, member"),
  ],
  tenantController.updateMemberRole
);

/**
 * DELETE /api/tenants/:tenantId/members/:userId
 * Remove user from tenant
 * @access User (Tenant Owner/Admin)
 */
router.delete(
  "/:tenantId/members/:userId",
  authMiddleware,
  strictRateLimiter,
  [
    param("tenantId").isUUID().withMessage("Tenant ID must be a valid UUID"),
    param("userId").isUUID().withMessage("User ID must be a valid UUID"),
  ],
  tenantController.removeUserFromTenant
);

// ===========================
// Admin Routes (System Administration)
// ===========================

/**
 * GET /api/tenants/admin/all
 * List all tenants with pagination
 * @access Admin
 */
router.get(
  "/admin/all",
  authMiddleware,
  adminMiddleware,
  [
    param("page").optional().isInt({ min: 1 }).withMessage("Page must be a positive integer"),
    param("perPage")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Per page must be between 1 and 100"),
    param("status")
      .optional()
      .isIn(["active", "inactive", "suspended"])
      .withMessage("Status must be one of: active, inactive, suspended"),
    param("plan")
      .optional()
      .isIn(["free", "pro", "enterprise"])
      .withMessage("Plan must be one of: free, pro, enterprise"),
  ],
  tenantController.listAllTenants
);

export default router;
