/**
 * @file tenant.service.ts
 * @description Service layer for tenant management and multi-tenancy operations
 */

import { supabaseAdmin } from "../config/supabase";
import logger from "../config/logger";
import {
  Tenant,
  UserTenant,
  CreateTenantData,
  UpdateTenantData,
  TenantListResponse,
  TenantStats,
  UserTenantMembership,
  TenantRole,
} from "../types/tenant";

/**
 * Tenant service class for database operations
 */
export class TenantService {
  /**
   * Create a new tenant
   */
  async createTenant(data: CreateTenantData, ownerId: string): Promise<Tenant> {
    try {
      logger.info("Creating tenant", {
        name: data.name,
        plan: data.plan,
        ownerId,
      });

      // Create tenant
      const { data: tenant, error: tenantError } = await supabaseAdmin
        .from("tenants")
        .insert({
          name: data.name,
          plan: data.plan || "free",
          status: data.status || "active",
        })
        .select()
        .single();

      if (tenantError) {
        logger.error("Failed to create tenant", {
          error: tenantError.message,
          data,
        });
        throw new Error(`Failed to create tenant: ${tenantError.message}`);
      }

      // Add owner as tenant member
      const { error: membershipError } = await supabaseAdmin.from("user_tenants").insert({
        user_id: ownerId,
        tenant_id: tenant.id,
        role: "owner",
      });

      if (membershipError) {
        // Rollback tenant creation
        await supabaseAdmin.from("tenants").delete().eq("id", tenant.id);
        logger.error("Failed to create tenant membership", {
          error: membershipError.message,
          tenantId: tenant.id,
          ownerId,
        });
        throw new Error(`Failed to create tenant membership: ${membershipError.message}`);
      }

      logger.info("Tenant created successfully", {
        tenantId: tenant.id,
        name: tenant.name,
        ownerId,
      });

      return tenant;
    } catch (error) {
      logger.error("Create tenant service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        data,
        ownerId,
      });
      throw error;
    }
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(id: string): Promise<Tenant | null> {
    try {
      const { data: tenant, error } = await supabaseAdmin
        .from("tenants")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new Error(`Failed to get tenant: ${error.message}`);
      }

      return tenant;
    } catch (error) {
      logger.error("Get tenant by ID service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        tenantId: id,
      });
      throw error;
    }
  }

  /**
   * Update tenant
   */
  async updateTenant(id: string, data: UpdateTenantData): Promise<Tenant> {
    try {
      logger.info("Updating tenant", {
        tenantId: id,
        updates: Object.keys(data),
      });

      const { data: tenant, error } = await supabaseAdmin
        .from("tenants")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          throw new Error("Tenant not found");
        }
        throw new Error(`Failed to update tenant: ${error.message}`);
      }

      logger.info("Tenant updated successfully", {
        tenantId: tenant.id,
      });

      return tenant;
    } catch (error) {
      logger.error("Update tenant service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        tenantId: id,
      });
      throw error;
    }
  }

  /**
   * Delete tenant
   */
  async deleteTenant(id: string): Promise<void> {
    try {
      logger.info("Deleting tenant", { tenantId: id });

      // Delete tenant (cascade will handle user_tenants)
      const { error } = await supabaseAdmin.from("tenants").delete().eq("id", id);

      if (error) {
        throw new Error(`Failed to delete tenant: ${error.message}`);
      }

      logger.info("Tenant deleted successfully", { tenantId: id });
    } catch (error) {
      logger.error("Delete tenant service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        tenantId: id,
      });
      throw error;
    }
  }

  /**
   * List tenants with pagination
   */
  async listTenants(
    page: number = 1,
    perPage: number = 10,
    filters?: { status?: string; plan?: string }
  ): Promise<TenantListResponse> {
    try {
      const offset = (page - 1) * perPage;

      let query = supabaseAdmin
        .from("tenants")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(offset, offset + perPage - 1);

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.plan) {
        query = query.eq("plan", filters.plan);
      }

      const { data: tenants, error, count } = await query;

      if (error) {
        throw new Error(`Failed to list tenants: ${error.message}`);
      }

      return {
        tenants: tenants || [],
        total: count || 0,
        page,
        perPage,
        totalPages: Math.ceil((count || 0) / perPage),
      };
    } catch (error) {
      logger.error("List tenants service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        page,
        perPage,
        filters,
      });
      throw error;
    }
  }

  /**
   * Get tenant statistics
   */
  async getTenantStats(tenantId: string): Promise<TenantStats> {
    try {
      // Get counts for each resource type
      const [agentsCount, knowledgeCount, webhooksCount, analyticsCount, usersCount] =
        await Promise.all([
          supabaseAdmin
            .from("agents")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId),
          supabaseAdmin
            .from("knowledge")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId),
          supabaseAdmin
            .from("webhooks")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId),
          supabaseAdmin
            .from("analytics")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId),
          supabaseAdmin
            .from("user_tenants")
            .select("*", { count: "exact", head: true })
            .eq("tenant_id", tenantId),
        ]);

      // Get tenant creation date
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("created_at")
        .eq("id", tenantId)
        .single();

      // Get last activity date from analytics
      const { data: lastActivity } = await supabaseAdmin
        .from("analytics")
        .select("created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      return {
        totalAgents: agentsCount.count || 0,
        totalKnowledge: knowledgeCount.count || 0,
        totalWebhooks: webhooksCount.count || 0,
        totalAnalytics: analyticsCount.count || 0,
        totalUsers: usersCount.count || 0,
        createdAt: tenant?.created_at || "",
        lastActivityAt: lastActivity?.created_at || null,
      };
    } catch (error) {
      logger.error("Get tenant stats service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Add user to tenant
   */
  async addUserToTenant(
    tenantId: string,
    userId: string,
    role: string = "member"
  ): Promise<UserTenant> {
    try {
      logger.info("Adding user to tenant", {
        tenantId,
        userId,
        role,
      });

      const { data: userTenant, error } = await supabaseAdmin
        .from("user_tenants")
        .insert({
          user_id: userId,
          tenant_id: tenantId,
          role,
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to add user to tenant: ${error.message}`);
      }

      logger.info("User added to tenant successfully", {
        tenantId,
        userId,
        role,
      });

      return userTenant;
    } catch (error) {
      logger.error("Add user to tenant service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        tenantId,
        userId,
        role,
      });
      throw error;
    }
  }

  /**
   * Remove user from tenant
   */
  async removeUserFromTenant(tenantId: string, userId: string): Promise<void> {
    try {
      logger.info("Removing user from tenant", {
        tenantId,
        userId,
      });

      const { error } = await supabaseAdmin
        .from("user_tenants")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("user_id", userId);

      if (error) {
        throw new Error(`Failed to remove user from tenant: ${error.message}`);
      }

      logger.info("User removed from tenant successfully", {
        tenantId,
        userId,
      });
    } catch (error) {
      logger.error("Remove user from tenant service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        tenantId,
        userId,
      });
      throw error;
    }
  }

  /**
   * Get user's tenant memberships
   */
  async getUserTenants(userId: string): Promise<UserTenantMembership[]> {
    try {
      const { data: userTenants, error } = await supabaseAdmin
        .from("user_tenants")
        .select(
          `
          id,
          role,
          created_at,
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
        throw new Error(`Failed to get user tenants: ${error.message}`);
      }

      return (userTenants || []).map(
        (ut: {
          id: string;
          role: string;
          created_at: string;
          tenant: Array<{
            id: string;
            name: string;
            plan: string;
            status: string;
            created_at: string;
            updated_at: string;
          }>;
        }) => ({
          id: ut.id,
          tenant: ut.tenant[0], // tenant is an array from the join
          role: ut.role as TenantRole,
          joinedAt: ut.created_at,
        })
      );
    } catch (error) {
      logger.error("Get user tenants service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
      });
      throw error;
    }
  }

  /**
   * Check if user is member of tenant
   */
  async isUserMemberOfTenant(userId: string, tenantId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from("user_tenants")
        .select("id")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return false; // Not found
        }
        throw new Error(`Failed to check user membership: ${error.message}`);
      }

      return !!data;
    } catch (error) {
      logger.error("Check user membership service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        tenantId,
      });
      return false;
    }
  }

  /**
   * Get user's role in tenant
   */
  async getUserRoleInTenant(userId: string, tenantId: string): Promise<string | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("user_tenants")
        .select("role")
        .eq("user_id", userId)
        .eq("tenant_id", tenantId)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return null; // Not found
        }
        throw new Error(`Failed to get user role: ${error.message}`);
      }

      return data.role;
    } catch (error) {
      logger.error("Get user role service error", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId,
        tenantId,
      });
      return null;
    }
  }
}

/**
 * Default tenant service instance
 */
export const tenantService = new TenantService();

export default tenantService;
