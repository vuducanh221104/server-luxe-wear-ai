/**
 * @file auth.controller.ts
 * @description Authentication controller
 * Handles HTTP requests for authentication endpoints
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import * as authService from "../services/auth.service";
import { tenantService } from "../services/tenant.service";
import { successResponse, errorResponse } from "../utils/response";
import { handleAsyncOperationStrict } from "../utils/errorHandler";
import logger from "../config/logger";

/**
 * Auth Controller Class
 * Object-based controller for authentication operations
 */
export class AuthController {
  /**
   * Register a new user
   * POST /api/auth/register
   */
  async register(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { email, password, name } = req.body;

        // Call service layer
        const result = await authService.register({ email, password, name });

        // Check if email confirmation is required
        if (!result.session) {
          // Email confirmation required - return user info only
          return successResponse(
            res,
            {
              user: {
                id: result.user.id,
                email: result.user.email,
                name: result.user.user_metadata?.name,
                emailConfirmedAt: result.user.email_confirmed_at,
              },
              requiresEmailConfirmation: true,
              message: "Please check your email to confirm your account before logging in",
            },
            "Registration successful - email confirmation required",
            201
          );
        }

        // Registration successful - user needs to login separately
        return successResponse(
          res,
          {
            user: {
              id: result.user.id,
              email: result.user.email,
              name: result.user.user_metadata?.name,
              emailConfirmedAt: result.user.email_confirmed_at,
            },
            message: "Registration successful - please login to continue",
          },
          "Registration successful",
          201
        );
      },
      "register user",
      {
        context: {
          email: req.body?.email,
          name: req.body?.name,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Login user
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { email, password } = req.body;

        // Call service layer
        const result = await authService.login({ email, password });

        // Get user's tenants
        const userTenants = await tenantService.getUserTenants(result.user.id);

        return successResponse(
          res,
          {
            user: {
              id: result.user.id,
              email: result.user.email,
              name: result.user.user_metadata?.name,
            },
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            tenants: userTenants.map((membership) => ({
              id: membership.tenant.id,
              name: membership.tenant.name,
              plan: membership.tenant.plan,
              status: membership.tenant.status,
              role: membership.role,
              joinedAt: membership.joinedAt,
            })),
            defaultTenant: userTenants[0]
              ? {
                  id: userTenants[0].tenant.id,
                  name: userTenants[0].tenant.name,
                  plan: userTenants[0].tenant.plan,
                }
              : null,
          },
          "Login successful"
        );
      },
      "login user",
      {
        context: {
          email: req.body?.email,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(_req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        await authService.logout();

        return successResponse(res, null, "Logout successful");
      },
      "logout user",
      {
        context: {
          ip: _req.ip,
        },
      }
    );
  }

  /**
   * Refresh access token
   * POST /api/auth/refresh
   */
  async refreshAccessToken(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { refreshToken } = req.body;

        // Call service layer
        const result = await authService.refreshToken(refreshToken);

        // Get user's tenants
        const userTenants = await tenantService.getUserTenants(result.user.id);

        return successResponse(
          res,
          {
            user: {
              id: result.user.id,
              email: result.user.email,
              name: result.user.user_metadata?.name,
            },
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            tenants: userTenants.map((membership) => ({
              id: membership.tenant.id,
              name: membership.tenant.name,
              plan: membership.tenant.plan,
              status: membership.tenant.status,
              role: membership.role,
              joinedAt: membership.joinedAt,
            })),
            defaultTenant: userTenants[0]
              ? {
                  id: userTenants[0].tenant.id,
                  name: userTenants[0].tenant.name,
                  plan: userTenants[0].tenant.plan,
                }
              : null,
          },
          "Token refreshed successfully"
        );
      },
      "refresh access token",
      {
        context: {
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Request password reset
   * POST /api/auth/forgot-password
   */
  async forgotPassword(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { email } = req.body;

        await authService.forgotPassword(email);

        // Always return success even if email doesn't exist (security best practice)
        return successResponse(
          res,
          null,
          "If the email exists, a password reset link has been sent"
        );
      },
      "forgot password",
      {
        context: {
          email: req.body?.email,
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Reset password with token
   * POST /api/auth/reset-password
   */
  async resetPassword(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        // Check validation results
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        const { password } = req.body;

        await authService.resetPassword(password);

        return successResponse(res, null, "Password reset successful");
      },
      "reset password",
      {
        context: {
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Get current user profile
   * GET /api/auth/me
   */
  async getCurrentUser(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const token = req.headers.authorization?.split(" ")[1];

        if (!token) {
          return errorResponse(res, "No token provided", 401);
        }

        const user = await authService.verifyToken(token);

        return successResponse(
          res,
          {
            id: user.id,
            email: user.email,
            name: user.user_metadata?.name,
            createdAt: user.created_at,
          },
          "User retrieved successfully"
        );
      },
      "get current user",
      {
        context: {
          ip: req.ip,
        },
      }
    );
  }

  /**
   * Handle Supabase auth callback from URL fragment
   * GET /api/auth/callback
   */
  async handleAuthCallback(req: Request, res: Response): Promise<Response> {
    try {
      // Check both query parameters and URL fragment
      let access_token = req.query.access_token as string;
      let refresh_token = req.query.refresh_token as string;
      let type = req.query.type as string;

      // If no query params, check URL fragment (for cases where Supabase redirects with #)
      if (!access_token && req.url.includes("#")) {
        const hash = req.url.split("#")[1];
        const params = new URLSearchParams(hash);
        access_token = params.get("access_token") || "";
        refresh_token = params.get("refresh_token") || "";
        type = params.get("type") || "";
      }

      if (!access_token) {
        return errorResponse(res, "Access token is required", 400);
      }

      // Verify the token and get user info
      const user = await authService.verifyToken(access_token);

      logger.info("Auth callback successful", {
        userId: user.id,
        email: user.email,
        type,
      });

      // Return success page with user info
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #28a745; }
            .info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .token { word-break: break-all; font-family: monospace; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1 class="success">✅ Authentication Successful!</h1>
          <div class="info">
            <h3>User Information:</h3>
            <p><strong>Email:</strong> ${user.email}</p>
            <p><strong>Name:</strong> ${user.user_metadata?.name || "N/A"}</p>
            <p><strong>User ID:</strong> ${user.id}</p>
            <p><strong>Email Verified:</strong> ${user.email_confirmed_at ? "Yes" : "No"}</p>
          </div>
          <div class="info">
            <h3>Access Token:</h3>
            <div class="token">${access_token}</div>
          </div>
          <div class="info">
            <h3>Refresh Token:</h3>
            <div class="token">${refresh_token}</div>
          </div>
          <p><em>You can now close this window and use the API with the provided tokens.</em></p>
        </body>
        </html>
      `;

      res.setHeader("Content-Type", "text/html");
      return res.status(200).send(html);
    } catch (error) {
      logger.error("Auth callback controller error", { error });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Failed</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .error { color: #dc3545; }
            .info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ Authentication Failed</h1>
          <div class="info">
            <p><strong>Error:</strong> ${error instanceof Error ? error.message : "Unknown error"}</p>
            <p>Please try again or contact support if the problem persists.</p>
          </div>
        </body>
        </html>
      `;

      res.setHeader("Content-Type", "text/html");
      return res.status(400).send(html);
    }
  }

  /**
   * Handle Supabase auth callback from URL fragment
   * GET /api/auth/callback-fragment
   */
  async handleAuthCallbackFragment(_req: Request, res: Response): Promise<Response> {
    try {
      // Render HTML page that extracts tokens from URL fragment
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Callback</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .success { color: #28a745; }
            .error { color: #dc3545; }
            .info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
            .token { background: #e9ecef; padding: 10px; border-radius: 3px; word-break: break-all; font-family: monospace; }
          </style>
        </head>
        <body>
          <h1>🔐 Authentication Callback</h1>
          <div class="info">
            <p>Processing authentication...</p>
            <div id="status">⏳ Extracting tokens from URL fragment...</div>
            <div id="tokens" style="display: none;">
              <h3>✅ Tokens Extracted:</h3>
              <p><strong>Access Token:</strong></p>
              <div class="token" id="access-token"></div>
              <p><strong>Refresh Token:</strong></p>
              <div class="token" id="refresh-token"></div>
              <p><strong>Expires In:</strong> <span id="expires-in"></span> seconds</p>
            </div>
            <div id="error" style="display: none;" class="error">
              <h3>❌ Error:</h3>
              <p id="error-message"></p>
            </div>
          </div>

          <script>
            // Extract tokens from URL fragment
            const hash = window.location.hash.substring(1); // Remove #
            const params = new URLSearchParams(hash);

            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');
            const expiresIn = params.get('expires_in');

            if (accessToken) {
              document.getElementById('status').innerHTML = '✅ Tokens extracted successfully!';
              document.getElementById('tokens').style.display = 'block';
              document.getElementById('access-token').textContent = accessToken;
              document.getElementById('refresh-token').textContent = refreshToken;
              document.getElementById('expires-in').textContent = expiresIn || 'N/A';

              // Auto-verify token with backend
              fetch('/api/auth/verify-token', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ access_token: accessToken })
              })
              .then(response => response.json())
              .then(data => {
                if (data.success) {
                  document.getElementById('status').innerHTML += '<br>✅ Token verified with backend!';
                  document.getElementById('status').innerHTML += '<br>🎉 Authentication successful!';
                } else {
                  document.getElementById('status').innerHTML += '<br>❌ Token verification failed: ' + data.message;
                }
              })
              .catch(error => {
                document.getElementById('status').innerHTML += '<br>❌ Verification error: ' + error.message;
              });
            } else {
              document.getElementById('status').innerHTML = '❌ No access token found in URL fragment';
              document.getElementById('error').style.display = 'block';
              document.getElementById('error-message').textContent = 'URL fragment does not contain access_token parameter';
            }
          </script>
        </body>
        </html>
      `;

      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch (error) {
      logger.error("Auth callback fragment error", { error });

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Authentication Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { color: #dc3545; }
            .info { background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1 class="error">❌ Authentication Failed</h1>
          <div class="info">
            <p><strong>Error:</strong> ${error instanceof Error ? error.message : "Unknown error"}</p>
            <p>Please try again or contact support if the problem persists.</p>
          </div>
        </body>
        </html>
      `;

      res.setHeader("Content-Type", "text/html");
      return res.status(400).send(html);
    }
  }

  /**
   * Verify access token
   * POST /api/auth/verify-token
   */
  async verifyToken(req: Request, res: Response): Promise<Response> {
    return handleAsyncOperationStrict(
      async () => {
        const { access_token } = req.body;

        if (!access_token) {
          return errorResponse(res, "Access token is required", 400);
        }

        const user = await authService.verifyToken(access_token);

        return successResponse(
          res,
          {
            user: {
              id: user.id,
              email: user.email,
              name: user.user_metadata?.name || user.email?.split("@")[0],
              email_confirmed_at: user.email_confirmed_at,
              created_at: user.created_at,
            },
            authenticated: true,
          },
          "Token verified successfully"
        );
      },
      "verify token",
      {
        context: {
          ip: req.ip,
        },
      }
    );
  }
}

// Create and export controller instance
export const authController = new AuthController();

// Export individual methods for backward compatibility
export const {
  register,
  login,
  logout,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  handleAuthCallback,
  handleAuthCallbackFragment,
  verifyToken,
} = authController;

export default authController;
