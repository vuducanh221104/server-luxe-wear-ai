/**
 * @file cleanup.job.ts
 * @description Scheduled job to clean up old data (logs, analytics, temporary files)
 */

import cron from "node-cron";
import logger from "../config/logger";
import { supabaseAdmin } from "../config/supabase";

export interface CleanupConfig {
  /** Days to keep analytics data */
  analyticsRetentionDays: number;
  /** Days to keep chat history */
  chatHistoryRetentionDays: number;
  /** Days to keep deleted items in soft-delete state */
  softDeleteRetentionDays: number;
}

const DEFAULT_CONFIG: CleanupConfig = {
  analyticsRetentionDays: 90,
  chatHistoryRetentionDays: 30,
  softDeleteRetentionDays: 30,
};

export class CleanupJob {
  private isRunning = false;
  private config: CleanupConfig;

  constructor(config: Partial<CleanupConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the cleanup job
   * Runs daily at 3 AM
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Cleanup job is already running");
      return;
    }

    // Run daily at 3:00 AM
    cron.schedule("0 3 * * *", async () => {
      await this.runCleanup();
    });

    this.isRunning = true;
    logger.info("Cleanup job started - running daily at 3:00 AM");
  }

  /**
   * Stop the cleanup job
   */
  stop(): void {
    this.isRunning = false;
    logger.info("Cleanup job stopped");
  }

  /**
   * Run all cleanup tasks
   */
  async runCleanup(): Promise<CleanupResult> {
    const startTime = Date.now();
    logger.info("Starting scheduled cleanup...");

    const result: CleanupResult = {
      analyticsDeleted: 0,
      chatHistoryDeleted: 0,
      softDeletedPurged: 0,
      errors: [],
    };

    // Clean old analytics
    try {
      result.analyticsDeleted = await this.cleanupOldAnalytics();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`Analytics cleanup failed: ${errorMsg}`);
      logger.error("Analytics cleanup failed", { error: errorMsg });
    }

    // Clean old chat history
    try {
      result.chatHistoryDeleted = await this.cleanupOldChatHistory();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`Chat history cleanup failed: ${errorMsg}`);
      logger.error("Chat history cleanup failed", { error: errorMsg });
    }

    // Purge soft-deleted items
    try {
      result.softDeletedPurged = await this.purgeSoftDeletedItems();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      result.errors.push(`Soft delete purge failed: ${errorMsg}`);
      logger.error("Soft delete purge failed", { error: errorMsg });
    }

    const duration = Date.now() - startTime;
    logger.info("Cleanup completed", {
      duration: `${duration}ms`,
      ...result,
    });

    return result;
  }

  /**
   * Clean up old analytics data
   */
  private async cleanupOldAnalytics(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.analyticsRetentionDays);

    const { data, error } = await supabaseAdmin
      .from("analytics")
      .delete()
      .lt("created_at", cutoffDate.toISOString())
      .select("id");

    if (error) {
      throw new Error(`Failed to delete old analytics: ${error.message}`);
    }

    const count = data?.length || 0;
    if (count > 0) {
      logger.info(
        `Deleted ${count} analytics records older than ${this.config.analyticsRetentionDays} days`
      );
    }

    return count;
  }

  /**
   * Clean up old chat history
   */
  private async cleanupOldChatHistory(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.chatHistoryRetentionDays);

    const { data, error } = await supabaseAdmin
      .from("chat_history")
      .delete()
      .lt("created_at", cutoffDate.toISOString())
      .select("id");

    if (error) {
      // Table might not exist, which is fine
      if (error.code === "42P01") {
        logger.debug("chat_history table does not exist, skipping cleanup");
        return 0;
      }
      throw new Error(`Failed to delete old chat history: ${error.message}`);
    }

    const count = data?.length || 0;
    if (count > 0) {
      logger.info(
        `Deleted ${count} chat history records older than ${this.config.chatHistoryRetentionDays} days`
      );
    }

    return count;
  }

  /**
   * Purge soft-deleted items that have been deleted for too long
   */
  private async purgeSoftDeletedItems(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.softDeleteRetentionDays);

    let totalPurged = 0;

    // Purge soft-deleted knowledge entries
    const { data: knowledgeData, error: knowledgeError } = await supabaseAdmin
      .from("knowledge")
      .delete()
      .eq("is_deleted", true)
      .lt("deleted_at", cutoffDate.toISOString())
      .select("id");

    if (knowledgeError && knowledgeError.code !== "42703") {
      // 42703 = column does not exist
      logger.warn("Knowledge soft delete purge issue", { error: knowledgeError.message });
    } else if (knowledgeData) {
      totalPurged += knowledgeData.length;
    }

    // Purge soft-deleted agents
    const { data: agentData, error: agentError } = await supabaseAdmin
      .from("agents")
      .delete()
      .eq("is_deleted", true)
      .lt("deleted_at", cutoffDate.toISOString())
      .select("id");

    if (agentError && agentError.code !== "42703") {
      logger.warn("Agent soft delete purge issue", { error: agentError.message });
    } else if (agentData) {
      totalPurged += agentData.length;
    }

    if (totalPurged > 0) {
      logger.info(
        `Purged ${totalPurged} soft-deleted items older than ${this.config.softDeleteRetentionDays} days`
      );
    }

    return totalPurged;
  }

  /**
   * Manual cleanup (for testing or immediate cleanup)
   */
  async manualCleanup(): Promise<CleanupResult> {
    logger.info("Manual cleanup requested");
    return await this.runCleanup();
  }

  /**
   * Update cleanup configuration
   */
  updateConfig(config: Partial<CleanupConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("Cleanup job configuration updated", { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): CleanupConfig {
    return { ...this.config };
  }
}

export interface CleanupResult {
  analyticsDeleted: number;
  chatHistoryDeleted: number;
  softDeletedPurged: number;
  errors: string[];
}

// Export singleton instance
export const cleanupJob = new CleanupJob();
export default cleanupJob;
