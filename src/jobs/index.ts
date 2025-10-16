/**
 * @file index.ts
 * @description Background jobs scheduler
 */

import cron from "node-cron";
import logger from "../config/logger";

/**
 * List of scheduled jobs
 */
const jobs: cron.ScheduledTask[] = [];

/**
 * Start all background jobs
 */
export const startJobs = (): void => {
  logger.info("Starting background jobs...");

  // TODO: Import and schedule jobs
  // Example: Daily cleanup at 2 AM
  // const cleanupJob = cron.schedule("0 2 * * *", async () => {
  //   logger.info("Running cleanup job...");
  //   await cleanupService.runCleanup();
  // });
  // jobs.push(cleanupJob);

  // Example: Reindex every 6 hours
  // const reindexJob = cron.schedule("0 */6 * * *", async () => {
  //   logger.info("Running reindex job...");
  //   await reindexService.reindexVectors();
  // });
  // jobs.push(reindexJob);

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
