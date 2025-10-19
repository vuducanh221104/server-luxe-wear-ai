/**
 * @file auth.ts
 * @description Authentication-related types and interfaces
 */

import { User, Session } from "@supabase/supabase-js";

/**
 * Registration data interface
 */
export interface RegisterData {
  email: string;
  password: string;
  name?: string;
  role?: "authenticated" | "admin";
}

/**
 * Login credentials interface
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * OAuth provider type
 */
export type OAuthProvider = "google" | "github" | "facebook" | "twitter";

/**
 * Auth response interface
 */
export interface AuthResponse {
  user: User; // Supabase User type
  session: Session | null; // Supabase Session type (null if email confirmation required)
  accessToken: string;
  refreshToken: string;
  userTenants?: any[]; // User's tenant memberships
}

/**
 * OAuth URL response interface
 */
export interface OAuthUrlResponse {
  url: string;
}
