/**
 * @file error.middleware.ts
 * @description Global error handling middleware
 */

import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";

/**
 * Custom error interface
 */
export interface ApiError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

/**
 * Global error handler middleware
 */
export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  // Log error
  logger.error("Error occurred", {
    error: message,
    statusCode,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    stack: err.stack,
  });

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};

export default errorHandler;
