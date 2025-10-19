/**
 * @file tenant.middleware.ts
 * @description Middleware for handling tenant context and multi-tenancy
 */

import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";
import { TenantContext } from "../types/tenant";
import logger from "../config/logger";
import { errorResponse } from "../utils/response";

// Extend Request interface to include tenant context
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
    }
  }
}

/**
 * Middleware to extract and validate tenant context from user
 * This middleware should be used after authentication middleware
 */
export const tenantMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Check if user is authenticated
    if (!req.user?.id) {
      res.status(401).json(errorResponse(res, "User not authenticated", 401));
      return;
    }

    const userId = req.user.id;

    // Get user's tenant memberships
    const { data: userTenants, error } = await supabaseAdmin
      .from("user_tenants")
      .select(
        `
        id,
        role,
        tenant_id,
        tenant:tenants (
          id,
          name,
          plan,
          status,
          created_at,
          updated_at
        )
      `
      )
      .eq("user_id", userId);

    if (error) {
      logger.error("Failed to fetch user tenants", {
        userId,
        error: error.message,
      });
      res.status(500).json(errorResponse(res, "Failed to fetch tenant information", 500));
      return;
    }

    if (!userTenants || userTenants.length === 0) {
      res.status(403).json(errorResponse(res, "User is not a member of any tenant", 403));
      return;
    }

    // For now, use the first tenant (in the future, you might want to support tenant switching)
    const userTenant = userTenants[0];
    const tenant = userTenant.tenant as any;

    if (!tenant) {
      res.status(403).json(errorResponse(res, "Invalid tenant information", 403));
      return;
    }

    // Check if tenant is active
    if (tenant.status !== "active") {
      res.status(403).json(errorResponse(res, "Tenant is not active", 403));
      return;
    }

    // Set tenant context
    req.tenant = {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan || "free",
      status: tenant.status || "active",
      role: userTenant.role || "member",
    };

    logger.debug("Tenant context set", {
      userId,
      tenantId: req.tenant.id,
      tenantName: req.tenant.name,
      role: req.tenant.role,
    });

    next();
  } catch (error) {
    logger.error("Tenant middleware error", {
      userId: req.user?.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    res.status(500).json(errorResponse(res, "Internal server error", 500));
  }
};

/**
 * Middleware to require specific tenant role
 * @param requiredRoles - Array of roles that are allowed
 */
export const requireTenantRole = (requiredRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      res.status(401).json(errorResponse(res, "Tenant context not found", 401));
      return;
    }

    if (!requiredRoles.includes(req.tenant.role)) {
      res
        .status(403)
        .json(
          errorResponse(
            res,
            `Insufficient permissions. Required roles: ${requiredRoles.join(", ")}`,
            403
          )
        );
      return;
    }

    next();
  };
};

/**
 * Middleware to require tenant owner role
 */
export const requireTenantOwner = requireTenantRole(["owner"]);

/**
 * Middleware to require tenant admin or owner role
 */
export const requireTenantAdmin = requireTenantRole(["owner", "admin"]);

/**
 * Middleware to validate tenant plan
 * @param requiredPlan - Required tenant plan
 */
export const requireTenantPlan = (requiredPlan: string) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenant) {
      res.status(401).json(errorResponse(res, "Tenant context not found", 401));
      return;
    }

    const planHierarchy = ["free", "pro", "enterprise"];
    const currentPlanIndex = planHierarchy.indexOf(req.tenant.plan);
    const requiredPlanIndex = planHierarchy.indexOf(requiredPlan);

    if (currentPlanIndex < requiredPlanIndex) {
      res
        .status(403)
        .json(errorResponse(res, `This feature requires ${requiredPlan} plan or higher`, 403));
      return;
    }

    next();
  };
};

/**
 * Middleware to check tenant limits
 * @param resourceType - Type of resource to check limits for
 */
export const checkTenantLimits = (
  resourceType: "agents" | "knowledge" | "webhooks" | "analytics"
) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenant) {
        res.status(401).json(errorResponse(res, "Tenant context not found", 401));
        return;
      }

      // Get current count for the resource type
      const { count, error } = await supabaseAdmin
        .from(resourceType)
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", req.tenant.id);

      if (error) {
        logger.error("Failed to check tenant limits", {
          tenantId: req.tenant.id,
          resourceType,
          error: error.message,
        });
        res.status(500).json(errorResponse(res, "Failed to check limits", 500));
        return;
      }

      // Define limits based on plan
      const limits = {
        free: { agents: 5, knowledge: 100, webhooks: 10, analytics: 1000 },
        pro: { agents: 50, knowledge: 1000, webhooks: 100, analytics: 10000 },
        enterprise: { agents: -1, knowledge: -1, webhooks: -1, analytics: -1 }, // -1 means unlimited
      };

      const currentCount = count || 0;
      const limit = limits[req.tenant.plan as keyof typeof limits]?.[resourceType];

      if (limit !== -1 && currentCount >= limit) {
        res
          .status(403)
          .json(
            errorResponse(res, `${resourceType} limit exceeded for ${req.tenant.plan} plan`, 403)
          );
        return;
      }

      next();
    } catch (error) {
      logger.error("Check tenant limits error", {
        tenantId: req.tenant?.id,
        resourceType,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      res.status(500).json(errorResponse(res, "Internal server error", 500));
    }
  };
};
