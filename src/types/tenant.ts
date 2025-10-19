/**
 * @file tenant.ts
 * @description Tenant-related types and interfaces for multi-tenancy support
 */

import { Tables, TablesInsert, TablesUpdate } from "./database";

/**
 * Tenant type from database
 */
export type Tenant = Tables<"tenants">;
export type TenantInsert = TablesInsert<"tenants">;
export type TenantUpdate = TablesUpdate<"tenants">;

/**
 * User-Tenant mapping type from database
 */
export type UserTenant = Tables<"user_tenants">;
export type UserTenantInsert = TablesInsert<"user_tenants">;
export type UserTenantUpdate = TablesUpdate<"user_tenants">;

/**
 * Tenant plan types
 */
export type TenantPlan = "free" | "pro" | "enterprise";

/**
 * Tenant status types
 */
export type TenantStatus = "active" | "inactive" | "suspended";

/**
 * User role in tenant
 */
export type TenantRole = "owner" | "admin" | "member";

/**
 * Tenant configuration interface
 */
export interface TenantConfig {
  maxAgents?: number;
  maxKnowledge?: number;
  maxWebhooks?: number;
  maxAnalytics?: number;
  features?: string[];
  [key: string]: unknown;
}

/**
 * Create tenant data interface
 */
export interface CreateTenantData {
  name: string;
  plan?: TenantPlan;
  status?: TenantStatus;
  config?: TenantConfig;
}

/**
 * Update tenant data interface
 */
export interface UpdateTenantData {
  name?: string;
  plan?: TenantPlan;
  status?: TenantStatus;
  config?: TenantConfig;
}

/**
 * Tenant list response interface
 */
export interface TenantListResponse {
  tenants: Tenant[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * Tenant statistics interface
 */
export interface TenantStats {
  totalAgents: number;
  totalKnowledge: number;
  totalWebhooks: number;
  totalAnalytics: number;
  totalUsers: number;
  createdAt: string;
  lastActivityAt: string | null;
}

/**
 * User tenant membership interface
 */
export interface UserTenantMembership {
  id: string;
  tenant: Tenant;
  role: TenantRole;
  joinedAt: string;
}

/**
 * Tenant context interface (for middleware)
 */
export interface TenantContext {
  id: string;
  name: string;
  plan: TenantPlan;
  status: TenantStatus;
  role: TenantRole;
  config?: TenantConfig;
}

/**
 * Interface for RPC result from get_user_tenants
 */
export interface UserTenantRPCResult {
  id: string;
  tenant: {
    id: string;
    name: string;
    plan: string;
    status: string;
    created_at: string;
    updated_at: string;
  };
  role: string;
  created_at: string;
}

/**
 * Tenant invitation interface
 */
export interface TenantInvitation {
  id: string;
  tenantId: string;
  email: string;
  role: TenantRole;
  invitedBy: string;
  expiresAt: string;
  status: "pending" | "accepted" | "expired" | "cancelled";
  createdAt: string;
}

/**
 * Tenant billing interface
 */
export interface TenantBilling {
  tenantId: string;
  plan: TenantPlan;
  status: "active" | "past_due" | "cancelled";
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  subscriptionId?: string;
}
