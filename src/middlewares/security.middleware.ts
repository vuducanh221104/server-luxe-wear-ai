/**
 * @file security.middleware.ts
 * @description Additional security middlewares
 */

import { Request, Response, NextFunction } from "express";

/**
 * Security middleware for additional protections
 */
export const securityMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Remove X-Powered-By header
  res.removeHeader("X-Powered-By");

  // Add additional security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");

  next();
};

export default securityMiddleware;
