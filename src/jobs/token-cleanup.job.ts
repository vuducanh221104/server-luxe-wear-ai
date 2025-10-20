/**
 * @file token-cleanup.job.ts
 * @description Scheduled job to clean up expired tokens
 */

import cron from "node-cron";
import { tokenService } from "../services/token.service";
import logger from "../config/logger";

export class TokenCleanupJob {
  private isRunning = false;

  /**
   * Start the token cleanup job
   * Runs every hour to clean up expired tokens
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Token cleanup job is already running");
      return;
    }

    // Run every hour at minute 0
    cron.schedule("0 * * * *", async () => {
      await this.cleanupExpiredTokens();
    });

    // Also run immediately on startup
    this.cleanupExpiredTokens();

    this.isRunning = true;
    logger.info("Token cleanup job started - running every hour");
  }

  /**
   * Stop the token cleanup job
   */
  stop(): void {
    this.isRunning = false;
    logger.info("Token cleanup job stopped");
  }

  /**
   * Clean up expired tokens
   */
  private async cleanupExpiredTokens(): Promise<void> {
    try {
      logger.info("Starting token cleanup...");

      const cleanedCount = await tokenService.cleanupExpiredTokens();

      if (cleanedCount > 0) {
        logger.info(`Token cleanup completed - removed ${cleanedCount} expired tokens`);
      } else {
        logger.debug("Token cleanup completed - no expired tokens found");
      }

      // Log token statistics
      const stats = await tokenService.getTokenStats();
      logger.info("Token statistics", {
        totalTokens: stats.totalTokens,
        activeTokens: stats.activeTokens,
        expiredTokens: stats.expiredTokens,
        revokedTokens: stats.revokedTokens,
        tokensByType: stats.tokensByType,
      });
    } catch (error) {
      logger.error("Token cleanup failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Manual cleanup (for testing or immediate cleanup)
   */
  async manualCleanup(): Promise<number> {
    logger.info("Manual token cleanup requested");
    return await tokenService.cleanupExpiredTokens();
  }
}

// Export singleton instance
export const tokenCleanupJob = new TokenCleanupJob();
export default tokenCleanupJob;
