/**
 * @file unhandledRejectionHandler.ts
 * @description Handle unhandled promise rejections and uncaught exceptions
 */

import logger from "../config/logger";

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (reason: any, promise: Promise<any>) => {
  logger.error("Unhandled Promise Rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
  });

  // Don't exit the process in production, just log the error
  if (process.env.NODE_ENV === "development") {
    console.error("Unhandled Promise Rejection:", reason);
  }
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (error: Error) => {
  logger.error("Uncaught Exception", {
    error: error.message,
    stack: error.stack,
  });

  console.error("Uncaught Exception:", error);

  // Exit the process for uncaught exceptions
  process.exit(1);
};

/**
 * Setup global error handlers
 */
export const setupGlobalErrorHandlers = () => {
  process.on("unhandledRejection", handleUnhandledRejection);
  process.on("uncaughtException", handleUncaughtException);

  logger.info("Global error handlers setup complete");
};
