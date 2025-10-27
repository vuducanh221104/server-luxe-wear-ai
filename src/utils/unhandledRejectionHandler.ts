/**
 * @file unhandledRejectionHandler.ts
 * @description Handle unhandled promise rejections and uncaught exceptions
 */

import logger from "../config/logger";

/**
 * Handle unhandled promise rejections
 */
export const handleUnhandledRejection = (reason: unknown, promise: Promise<unknown>): void => {
  logger.error("Unhandled Promise Rejection", {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise: promise.toString(),
  });
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.error("Unhandled Promise Rejection:", reason);
  }
};

/**
 * Handle uncaught exceptions
 */
export const handleUncaughtException = (error: Error): void => {
  logger.error("Uncaught Exception", {
    error: error.message,
    stack: error.stack,
  });

  // eslint-disable-next-line no-console
  console.error("Uncaught Exception:", error);
  process.exit(1);
};

/**
 * Setup global error handlers
 */
export const setupGlobalErrorHandlers = (): void => {
  process.on("unhandledRejection", handleUnhandledRejection);
  process.on("uncaughtException", handleUncaughtException);

  logger.info("Global error handlers setup complete");
};
