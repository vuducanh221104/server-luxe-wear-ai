/**
 * @file logger.middleware.ts
 * @description Request logging middleware using Winston
 */

import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";

/**
 * Request logger middleware
 * Logs incoming requests with method, URL, status, and response time
 */
export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();

  // Log when response finishes
  res.on("finish", () => {
    const duration = Date.now() - start;
    const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

    // Log level based on status code
    if (res.statusCode >= 500) {
      logger.error(message, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
    } else if (res.statusCode >= 400) {
      logger.warn(message, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
      });
    } else {
      logger.http(message, {
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
      });
    }
  });

  next();
};

export default requestLogger;
