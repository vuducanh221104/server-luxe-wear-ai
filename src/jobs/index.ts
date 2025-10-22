/**
 * @file index.ts
 * @description Background jobs scheduler
 */

import cron from "node-cron";
import logger from "../config/logger";
import { tokenCleanupJob } from "./tokenCleanup.job";

/**
 * List of scheduled jobs
 */
const jobs: cron.ScheduledTask[] = [];

/**
 * Start all background jobs
 */
export const startJobs = (): void => {
  logger.info("Starting background jobs...");

  // Start token cleanup job
  tokenCleanupJob.start();

  logger.info(`${jobs.length} background job(s) scheduled`);
};

/**
 * Stop all background jobs
 */
export const stopJobs = async (): Promise<void> => {
  logger.info("Stopping background jobs...");

  for (const job of jobs) {
    job.stop();
  }

  logger.info("All background jobs stopped");
};
