/**
 * @file tenant.controller.ts
 * @description Tenant controller for multi-tenancy management
 * Handles HTTP requests for tenant-related operations
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { tenantService } from "../services/tenant.service";
import { successResponse, errorResponse } from "../utils/response";
import { handleAsyncOperationStrict } from "../utils/errorHandler";
import { Tenant, UserTenantMembership } from "../types/tenant";

/**
 * Tenant Controller Class
 * Object-based controller for tenant operations
 */
export class TenantController {
  /**
   * Create a new tenant
   * POST /api/tenants
   * @access User (Tenant Owner)
   */
  async createTenant(req: Request, res: Response): Promise<Response> {
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

        const { name, plan, status } = req.body;

        const tenant = await tenantService.createTenant(
          {
            name,
            plan: plan || "free",
            status: status || "active",
          },
          req.user.id
        );

        return successResponse(
          res,
          {
            id: tenant.id,
            name: tenant.name,
            plan: tenant.plan,
            status: tenant.status,
            createdAt: tenant.created_at,
            updatedAt: tenant.updated_at,
          },
          "Tenant created successfully",
          201
        );
      },
      "create tenant",
      {
        context: {
          userId: req.user?.id,
          tenantName: req.body?.name,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Get tenant by ID
   * GET /api/tenants/:tenantId
   * @access User (Tenant Member)
   */
  async getTenant(req: Request, res: Response): Promise<Response> {
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

        const { tenantId } = req.params;

        // Check if user is member of this tenant
        const isMember = await tenantService.isUserMemberOfTenant(req.user.id, tenantId);
        if (!isMember) {
          return errorResponse(res, "Access denied to this tenant", 403);
        }

        const tenant = await tenantService.getTenantById(tenantId);
        if (!tenant) {
          return errorResponse(res, "Tenant not found", 404);
        }

        return successResponse(
          res,
          {
            id: tenant.id,
            name: tenant.name,
            plan: tenant.plan,
            status: tenant.status,
            createdAt: tenant.created_at,
            updatedAt: tenant.updated_at,
          },
          "Tenant retrieved successfully"
        );
      },
      "get tenant",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.params.tenantId,
        },
      }
    );
  }

  /**
   * List user's tenants
   * GET /api/tenants
   * @access User (Tenant Member)
   */
  async listUserTenants(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        if (!req.user) {
          return errorResponse(res, "User not authenticated", 401);
        }

        const memberships = await tenantService.getUserTenants(req.user.id);

        return successResponse(
          res,
          {
            tenants: memberships.map((membership: UserTenantMembership) => ({
              id: membership.tenant.id,
              name: membership.tenant.name,
              plan: membership.tenant.plan,
              status: membership.tenant.status,
              role: membership.role,
              joinedAt: membership.joinedAt,
              createdAt: membership.tenant.created_at,
              updatedAt: membership.tenant.updated_at,
            })),
            count: memberships.length,
          },
          "User tenants retrieved successfully"
        );
      },
      "list user tenants",
      {
        context: {
          userId: req.user?.id,
        },
      }
    );
  }

  /**
   * Update tenant
   * PUT /api/tenants/:tenantId
   * @access User (Tenant Owner/Admin)
   */
  async updateTenant(req: Request, res: Response): Promise<Response> {
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

        const { tenantId } = req.params;
        const { name, plan, status } = req.body;

        // Check if user has permission to update this tenant
        const userRole = await tenantService.getUserRoleInTenant(req.user.id, tenantId);
        if (!userRole || !["owner", "admin"].includes(userRole)) {
          return errorResponse(res, "Insufficient permissions to update this tenant", 403);
        }

        const tenant = await tenantService.updateTenant(tenantId, {
          name,
          plan,
          status,
        });

        return successResponse(
          res,
          {
            id: tenant.id,
            name: tenant.name,
            plan: tenant.plan,
            status: tenant.status,
            createdAt: tenant.created_at,
            updatedAt: tenant.updated_at,
          },
          "Tenant updated successfully"
        );
      },
      "update tenant",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.params.tenantId,
          updateFields: Object.keys(req.body || {}),
        },
      }
    );
  }

  /**
   * Delete tenant
   * DELETE /api/tenants/:tenantId
   * @access User (Tenant Owner)
   */
  async deleteTenant(req: Request, res: Response): Promise<Response> {
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

        const { tenantId } = req.params;

        // Check if user is owner of this tenant
        const userRole = await tenantService.getUserRoleInTenant(req.user.id, tenantId);
        if (userRole !== "owner") {
          return errorResponse(res, "Only tenant owners can delete tenants", 403);
        }

        await tenantService.deleteTenant(tenantId);

        return successResponse(res, null, "Tenant deleted successfully");
      },
      "delete tenant",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.params.tenantId,
        },
      }
    );
  }

  /**
   * Get tenant statistics
   * GET /api/tenants/:tenantId/stats
   * @access User (Tenant Member)
   */
  async getTenantStats(req: Request, res: Response): Promise<Response> {
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

        const { tenantId } = req.params;

        // Check if user is member of this tenant
        const isMember = await tenantService.isUserMemberOfTenant(req.user.id, tenantId);
        if (!isMember) {
          return errorResponse(res, "Access denied to this tenant", 403);
        }

        const stats = await tenantService.getTenantStats(tenantId);

        return successResponse(res, stats, "Tenant statistics retrieved successfully");
      },
      "get tenant stats",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.params.tenantId,
        },
      }
    );
  }

  /**
   * Add user to tenant
   * POST /api/tenants/:tenantId/members
   * @access User (Tenant Owner/Admin)
   */
  async addUserToTenant(req: Request, res: Response): Promise<Response> {
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

        const { tenantId } = req.params;
        const { userId, role } = req.body;

        // Check if user has permission to add members to this tenant
        const userRole = await tenantService.getUserRoleInTenant(req.user.id, tenantId);
        if (!userRole || !["owner", "admin"].includes(userRole)) {
          return errorResponse(res, "Insufficient permissions to add members to this tenant", 403);
        }

        const userTenant = await tenantService.addUserToTenant(tenantId, userId, role || "member");

        return successResponse(
          res,
          {
            id: userTenant.id,
            userId: userTenant.user_id,
            tenantId: userTenant.tenant_id,
            role: userTenant.role,
            createdAt: userTenant.created_at,
          },
          "User added to tenant successfully",
          201
        );
      },
      "add user to tenant",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.params.tenantId,
          targetUserId: req.body?.userId,
          role: req.body?.role,
        },
      }
    );
  }

  /**
   * Remove user from tenant
   * DELETE /api/tenants/:tenantId/members/:userId
   * @access User (Tenant Owner/Admin)
   */
  async removeUserFromTenant(req: Request, res: Response): Promise<Response> {
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

        const { tenantId, userId } = req.params;

        // Check if user has permission to remove members from this tenant
        const userRole = await tenantService.getUserRoleInTenant(req.user.id, tenantId);
        if (!userRole || !["owner", "admin"].includes(userRole)) {
          return errorResponse(
            res,
            "Insufficient permissions to remove members from this tenant",
            403
          );
        }

        // Prevent removing the last owner
        if (userRole === "admin") {
          const targetUserRole = await tenantService.getUserRoleInTenant(userId, tenantId);
          if (targetUserRole === "owner") {
            return errorResponse(res, "Admins cannot remove tenant owners", 403);
          }
        }

        await tenantService.removeUserFromTenant(tenantId, userId);

        return successResponse(res, null, "User removed from tenant successfully");
      },
      "remove user from tenant",
      {
        context: {
          userId: req.user?.id,
          tenantId: req.params.tenantId,
          targetUserId: req.params.userId,
        },
      }
    );
  }

  // ===========================
  // Admin Routes (System Administration)
  // ===========================

  /**
   * List all tenants (Admin only)
   * GET /api/tenants/admin/all
   * @access Admin
   */
  async listAllTenants(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const page = parseInt(req.query.page as string) || 1;
        const perPage = parseInt(req.query.perPage as string) || 10;
        const status = req.query.status as string;
        const plan = req.query.plan as string;

        const result = await tenantService.listTenants(page, perPage, { status, plan });

        return successResponse(
          res,
          {
            tenants: result.tenants.map((tenant: Tenant) => ({
              id: tenant.id,
              name: tenant.name,
              plan: tenant.plan,
              status: tenant.status,
              createdAt: tenant.created_at,
              updatedAt: tenant.updated_at,
            })),
            pagination: {
              page: result.page,
              perPage: result.perPage,
              total: result.total,
              totalPages: result.totalPages,
            },
          },
          "All tenants retrieved successfully"
        );
      },
      "list all tenants (admin)",
      {
        context: {
          adminId: req.user?.id,
          page: req.query.page,
          perPage: req.query.perPage,
          filters: { status: req.query.status, plan: req.query.plan },
        },
      }
    );
  }
}

// Create and export controller instance
export const tenantController = new TenantController();

// Export individual methods for backward compatibility
export const {
  createTenant,
  getTenant,
  listUserTenants,
  updateTenant,
  deleteTenant,
  getTenantStats,
  addUserToTenant,
  removeUserFromTenant,
  listAllTenants,
} = tenantController;

export default tenantController;
