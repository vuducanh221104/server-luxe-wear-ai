/**
 * @file app.ts
 * @description Express application configuration
 * Configures middlewares, routes, and error handling for the Luxe Wear AI backend
 */

import express, { Application, Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

// Middlewares
import { requestLogger } from "./middlewares/logger.middleware";
import { errorHandler } from "./middlewares/error.middleware";
import { securityMiddleware } from "./middlewares/security.middleware";
import { rateLimiterMiddleware } from "./middlewares/rateLimiter.middleware";

// Routes
import apiRoutes from "./routes";

// Config
import logger from "./config/logger";

/**
 * Creates and configures the Express application
 * @returns Configured Express application instance
 */
const createApp = (): Application => {
  const app: Application = express();

  // ===========================
  // Security Middlewares
  // ===========================

  // Helmet - Security headers
  app.use(helmet());

  // CORS - Cross-Origin Resource Sharing
  app.use(
    cors({
      origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  // Rate limiting - DDoS protection
  app.use(rateLimiterMiddleware);

  // Additional security measures
  app.use(securityMiddleware);

  // ===========================
  // Request Parsing
  // ===========================

  // Parse JSON bodies
  app.use(express.json({ limit: "10mb" }));

  // Parse URL-encoded bodies
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  // ===========================
  // Logging Middlewares
  // ===========================

  // Morgan HTTP request logger (development only)
  if (process.env.NODE_ENV === "development") {
    app.use(morgan("dev"));
  }

  // Custom request logger with Winston
  app.use(requestLogger);

  // ===========================
  // API Routes
  // ===========================

  const API_PREFIX = "/api";

  // Mount all API routes
  app.use(API_PREFIX, apiRoutes);

  // ===========================
  // 404 Handler
  // ===========================

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: "Route not found",
      timestamp: new Date().toISOString(),
    });
  });

  // ===========================
  // Global Error Handler
  // ===========================

  app.use(errorHandler);

  // ===========================
  // Logging Configuration
  // ===========================

  logger.info("Express application configured successfully", {
    environment: process.env.NODE_ENV || "development",
    corsOrigins: process.env.ALLOWED_ORIGINS || "*",
  });

  return app;
};

export default createApp;
