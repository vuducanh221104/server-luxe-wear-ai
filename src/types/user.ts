/**
 * @file user.ts
 * @description User-related types and interfaces
 */

import { User } from "@supabase/supabase-js";

/**
 * User profile update data interface
 */
export interface UpdateUserProfileData {
  name?: string;
  avatar_url?: string;
  phone?: string;
  website?: string;
}

/**
 * User metadata interface
 */
export interface UserMetadata {
  name?: string;
  avatar_url?: string;
  phone?: string;
  website?: string;
  [key: string]: unknown;
}

/**
 * User statistics interface
 */
export interface UserStats {
  agentsCount: number;
  totalQueries: number;
  lastLoginAt: string | null;
  createdAt: string;
}

/**
 * User list response interface
 */
export interface UserListResponse {
  users: User[]; // Supabase User type
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}
