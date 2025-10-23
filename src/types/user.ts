/**
 * @file user.ts
 * @description User-related types and interfaces for custom users table
 */

/**
 * Custom User interface (replaces Supabase auth.users)
 */
export interface User {
  id: string;
  email: string;
  password_hash: string;
  name: string | null;
  avatar_url: string | null;
  phone: string | null;
  website: string | null;
  role: UserRole;
  preferences: Record<string, unknown>;
  is_active: boolean;
  email_verified: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * User role types for SaaS platform
 * - member: Regular user in a tenant
 * - admin: Tenant administrator (can manage users in their tenant)
 * - owner: Tenant owner (full control over tenant + billing)
 * - super_admin: Platform administrator (can manage all tenants)
 */
export type UserRole = "member" | "admin" | "owner" | "super_admin";

/**
 * User tenant membership interface
 */
export interface UserTenantMembership {
  id: string;
  user_id: string;
  tenant_id: string;
  role: TenantRole;
  status: MembershipStatus;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

/**
 * User tenant membership with full tenant details
 */
export interface UserTenantMembershipWithTenant extends UserTenantMembership {
  tenant: {
    id: string;
    name: string;
    plan: string;
    status: string;
    created_at: string;
    updated_at: string;
  } | null;
}

/**
 * Tenant role types (same as UserRole for consistency)
 * Used in user_tenant_memberships table
 */
export type TenantRole = UserRole;

/**
 * Membership status types
 */
export type MembershipStatus = "active" | "inactive" | "pending" | "suspended";

/**
 * User creation data interface
 */
export interface CreateUserData {
  email: string;
  password_hash: string;
  name?: string;
  avatar_url?: string;
  phone?: string;
  website?: string;
  role?: UserRole;
  preferences?: Record<string, unknown>;
}

/**
 * User update data interface
 */
export interface UpdateUserData {
  email?: string;
  password_hash?: string;
  name?: string;
  avatar_url?: string;
  phone?: string;
  website?: string;
  role?: UserRole;
  preferences?: Record<string, unknown>;
  is_active?: boolean;
  email_verified?: boolean;
  last_login?: string;
}

/**
 * User profile update data interface (for public profile updates)
 */
export interface UpdateUserProfileData {
  name?: string;
  avatar_url?: string;
  phone?: string;
  website?: string;
  preferences?: Record<string, unknown>;
}

/**
 * User with tenant memberships interface
 */
export interface UserWithMemberships extends User {
  memberships: UserTenantMembership[];
}

/**
 * User statistics interface
 */
export interface UserStats {
  agentsCount: number;
  totalQueries: number;
  tenantsCount: number;
  lastLoginAt: string | null;
  createdAt: string;
}

/**
 * User list response interface
 */
export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

/**
 * User authentication data interface
 */
export interface UserAuthData {
  email: string;
  password: string;
  name?: string;
}

/**
 * User login response interface
 */
export interface UserLoginResponse {
  user: User;
  token: string;
  refreshToken: string;
}

/**
 * User tenant membership creation data
 */
export interface CreateMembershipData {
  user_id: string;
  tenant_id: string;
  role?: TenantRole;
  status?: MembershipStatus;
}

/**
 * User tenant membership update data
 */
export interface UpdateMembershipData {
  role?: TenantRole;
  status?: MembershipStatus;
}
