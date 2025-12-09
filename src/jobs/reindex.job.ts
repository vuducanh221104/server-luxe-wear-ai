/**
 * @file reindex.job.ts
 * @description Scheduled job to reindex knowledge vectors in Pinecone
 * Ensures vector embeddings stay up-to-date and handles failed indexing
 */

import cron from "node-cron";
import logger from "../config/logger";
import { supabaseAdmin } from "../config/supabase";
import { batchStoreKnowledge } from "../services/vector.service";

export interface ReindexConfig {
  /** Batch size for reindexing */
  batchSize: number;
  /** Delay between batches in ms */
  batchDelay: number;
  /** Maximum items to reindex per run */
  maxItemsPerRun: number;
  /** Whether to force reindex all items */
  forceReindex: boolean;
}

const DEFAULT_CONFIG: ReindexConfig = {
  batchSize: 50,
  batchDelay: 1000,
  maxItemsPerRun: 500,
  forceReindex: false,
};

export class ReindexJob {
  private isRunning = false;
  private isProcessing = false;
  private config: ReindexConfig;

  constructor(config: Partial<ReindexConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the reindex job
   * Runs weekly on Sunday at 2 AM
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Reindex job is already running");
      return;
    }

    // Run weekly on Sunday at 2:00 AM
    cron.schedule("0 2 * * 0", async () => {
      await this.runReindex();
    });

    this.isRunning = true;
    logger.info("Reindex job started - running weekly on Sunday at 2:00 AM");
  }

  /**
   * Stop the reindex job
   */
  stop(): void {
    this.isRunning = false;
    logger.info("Reindex job stopped");
  }

  /**
   * Run the reindex process
   */
  async runReindex(): Promise<ReindexResult> {
    if (this.isProcessing) {
      logger.warn("Reindex job is already processing");
      return {
        success: false,
        itemsProcessed: 0,
        itemsFailed: 0,
        errors: ["Job already running"],
      };
    }

    this.isProcessing = true;
    const startTime = Date.now();
    logger.info("Starting knowledge reindex...");

    const result: ReindexResult = {
      success: true,
      itemsProcessed: 0,
      itemsFailed: 0,
      errors: [],
    };

    try {
      // Get items that need reindexing
      const items = await this.getItemsToReindex();

      if (items.length === 0) {
        logger.info("No items need reindexing");
        return result;
      }

      logger.info(`Found ${items.length} items to reindex`);

      // Process in batches
      for (let i = 0; i < items.length; i += this.config.batchSize) {
        const batch = items.slice(i, i + this.config.batchSize);

        try {
          await this.processBatch(batch);
          result.itemsProcessed += batch.length;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : "Unknown error";
          result.errors.push(
            `Batch ${Math.floor(i / this.config.batchSize) + 1} failed: ${errorMsg}`
          );
          result.itemsFailed += batch.length;
          logger.error("Batch reindex failed", { error: errorMsg, batchIndex: i });
        }

        // Delay between batches to avoid rate limiting
        if (i + this.config.batchSize < items.length) {
          await this.delay(this.config.batchDelay);
        }
      }

      if (result.itemsFailed > 0) {
        result.success = false;
      }
    } catch (error) {
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : "Unknown error");
      logger.error("Reindex job failed", { error: result.errors });
    } finally {
      this.isProcessing = false;
    }

    const duration = Date.now() - startTime;
    logger.info("Reindex completed", {
      duration: `${duration}ms`,
      ...result,
    });

    return result;
  }

  /**
   * Get items that need reindexing
   */
  private async getItemsToReindex(): Promise<KnowledgeItem[]> {
    let query = supabaseAdmin
      .from("knowledge")
      .select("id, title, tenant_id, user_id, agent_id, file_url, metadata")
      .limit(this.config.maxItemsPerRun);

    // If not forcing reindex, only get items that need it
    if (!this.config.forceReindex) {
      query = query.or("needs_reindex.eq.true,embedding_version.is.null");
    }

    const { data, error } = await query;

    if (error) {
      // Handle case where columns don't exist
      if (error.code === "42703") {
        logger.debug("Reindex tracking columns not found, skipping reindex");
        return [];
      }
      throw new Error(`Failed to fetch items for reindex: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Process a batch of items
   */
  private async processBatch(items: KnowledgeItem[]): Promise<void> {
    const entries: Array<{
      id: string;
      content: string;
      metadata?: Record<string, unknown>;
    }> = [];

    for (const item of items) {
      // Get content for embedding
      const content = await this.getContentForEmbedding(item);

      if (!content) {
        logger.warn("No content available for knowledge item", { id: item.id });
        continue;
      }

      entries.push({
        id: item.id,
        content: content,
        metadata: {
          title: item.title,
          user_id: item.user_id,
          tenant_id: item.tenant_id,
          agent_id: item.agent_id,
          ...((item.metadata as Record<string, unknown>) || {}),
        },
      });
    }

    if (entries.length === 0) {
      return;
    }

    // Store embeddings in batch
    await batchStoreKnowledge(entries);

    // Mark items as reindexed
    await this.markAsReindexed(items.map((i) => i.id));

    logger.debug(`Reindexed ${entries.length} items`);
  }

  /**
   * Get content for generating embedding
   */
  private async getContentForEmbedding(item: KnowledgeItem): Promise<string | null> {
    // For items with file_url, we would need to fetch and parse the file
    // For now, use title and metadata as content
    const parts: string[] = [];

    if (item.title) {
      parts.push(item.title);
    }

    if (item.metadata) {
      const meta = item.metadata as Record<string, unknown>;
      if (meta.description) {
        parts.push(String(meta.description));
      }
      if (meta.content) {
        parts.push(String(meta.content));
      }
    }

    return parts.length > 0 ? parts.join("\n\n") : null;
  }

  /**
   * Mark items as successfully reindexed
   */
  private async markAsReindexed(ids: string[]): Promise<void> {
    const { error } = await supabaseAdmin
      .from("knowledge")
      .update({
        needs_reindex: false,
        embedding_version: "v1",
        reindexed_at: new Date().toISOString(),
      })
      .in("id", ids);

    if (error && error.code !== "42703") {
      logger.warn("Failed to mark items as reindexed", { error: error.message });
    }
  }

  /**
   * Manual reindex (for testing or immediate reindex)
   */
  async manualReindex(options?: Partial<ReindexConfig>): Promise<ReindexResult> {
    const originalConfig = { ...this.config };

    if (options) {
      this.config = { ...this.config, ...options };
    }

    logger.info("Manual reindex requested", { options });

    try {
      return await this.runReindex();
    } finally {
      this.config = originalConfig;
    }
  }

  /**
   * Reindex a specific knowledge item
   */
  async reindexItem(knowledgeId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from("knowledge")
        .select("id, title, tenant_id, user_id, agent_id, file_url, metadata")
        .eq("id", knowledgeId)
        .single();

      if (error || !data) {
        logger.error("Failed to fetch knowledge item for reindex", {
          knowledgeId,
          error: error?.message,
        });
        return false;
      }

      await this.processBatch([data]);
      return true;
    } catch (error) {
      logger.error("Failed to reindex item", {
        knowledgeId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return false;
    }
  }

  /**
   * Update reindex configuration
   */
  updateConfig(config: Partial<ReindexConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info("Reindex job configuration updated", { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): ReindexConfig {
    return { ...this.config };
  }

  /**
   * Check if job is currently processing
   */
  isJobProcessing(): boolean {
    return this.isProcessing;
  }

  /**
   * Helper delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

interface KnowledgeItem {
  id: string;
  title: string;
  tenant_id: string;
  user_id: string;
  agent_id: string | null;
  file_url: string | null;
  metadata: unknown;
}

export interface ReindexResult {
  success: boolean;
  itemsProcessed: number;
  itemsFailed: number;
  errors: string[];
}

// Export singleton instance
export const reindexJob = new ReindexJob();
export default reindexJob;
