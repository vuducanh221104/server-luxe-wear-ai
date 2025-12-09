/**
 * @file index.ts
 * @description Background jobs scheduler
 */

import cron from "node-cron";
import logger from "../config/logger";
import { tokenCleanupJob } from "./tokenCleanup.job";
import { cleanupJob } from "./cleanup.job";
import { emailJob } from "./email.job";
import { reindexJob } from "./reindex.job";

/**
 * List of scheduled jobs
 */
const jobs: cron.ScheduledTask[] = [];

/**
 * Start all background jobs
 */
export const startJobs = (): void => {
  logger.info("Starting background jobs...");

  // Start token cleanup job (every hour)
  tokenCleanupJob.start();

  // Start cleanup job (daily at 3 AM)
  cleanupJob.start();

  // Start email job (queue processor)
  emailJob.start();

  // Start reindex job (weekly on Sunday at 2 AM)
  reindexJob.start();

  logger.info("All background jobs started");
};

/**
 * Stop all background jobs
 */
export const stopJobs = async (): Promise<void> => {
  logger.info("Stopping background jobs...");

  tokenCleanupJob.stop();
  cleanupJob.stop();
  await emailJob.stop();
  reindexJob.stop();

  for (const job of jobs) {
    job.stop();
  }

  logger.info("All background jobs stopped");
};

// Export individual jobs for direct access
export { tokenCleanupJob, cleanupJob, emailJob, reindexJob };
