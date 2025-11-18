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
import { securityMiddleware } from "./middlewares/logger.middleware";
import { rateLimiterMiddleware } from "./middlewares/rateLimiter.middleware";

// Routes
import apiRoutes from "./routes";

// Config
import logger from "./config/logger";
import passport from "./config/passport";

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
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Get server URL for same-origin requests
  const SERVER_URL = process.env.SERVER_URL || process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3001";
  let SERVER_HOST = "http://localhost:3001";
  try {
    SERVER_HOST = new URL(SERVER_URL).origin; // Extract just origin (protocol + host + port)
  } catch (error) {
    // Fallback to default if URL parsing fails
    logger.warn("Failed to parse SERVER_URL, using default", { SERVER_URL });
  }

  app.use(
    cors({
      origin: (origin, callback) => {
        // allow non-browser requests (e.g., curl, server-to-server)
        if (!origin) return callback(null, true);
        
        // Allow same-origin requests (widget calling API from same server)
        // This handles cases where widget HTML is served from the same server
        if (origin === SERVER_HOST) {
          return callback(null, true);
        }
        
        // Allow configured origins
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        
        return callback(new Error(`CORS: Origin not allowed: ${origin}`));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Tenant-Id", "X-API-Key"],
      optionsSuccessStatus: 204,
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
  // Passport OAuth Authentication
  // ===========================

  // Initialize Passport
  app.use(passport.initialize());

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
    corsOrigins: allowedOrigins.join(","),
  });

  return app;
};

export default createApp;
