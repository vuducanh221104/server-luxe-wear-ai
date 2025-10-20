/**
 * @file auth.ts
 * @description Authentication-related types and interfaces for custom users
 */

import { User, UserRole } from "../types/user";

/**
 * Registration data interface
 */
export interface RegisterData {
  email: string;
  password: string;
  name?: string;
  role?: UserRole;
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
  user: User; // Custom User type
  token: string; // JWT access token
  refreshToken: string; // JWT refresh token
  message: string;
}

/**
 * OAuth URL response interface
 */
export interface OAuthUrlResponse {
  url: string;
}

/**
 * Password change request interface
 */
export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Password reset request interface
 */
export interface PasswordResetRequest {
  email: string;
}

/**
 * User session interface
 */
export interface UserSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  metadata: Record<string, unknown>;
}
