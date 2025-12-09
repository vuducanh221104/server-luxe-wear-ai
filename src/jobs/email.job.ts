/**
 * @file email.job.ts
 * @description Email queue job for sending emails asynchronously
 * Uses Bull queue for reliable email delivery with retry logic
 */

import Bull from "bull";
import logger from "../config/logger";

export interface EmailJobData {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  template?: string;
  templateData?: Record<string, unknown>;
  priority?: "high" | "normal" | "low";
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailConfig {
  /** Redis connection string */
  redisUrl?: string;
  /** Maximum retry attempts */
  maxRetries: number;
  /** Delay between retries in ms */
  retryDelay: number;
  /** Whether email sending is enabled */
  enabled: boolean;
}

const DEFAULT_CONFIG: EmailConfig = {
  redisUrl: process.env.REDIS_URL,
  maxRetries: 3,
  retryDelay: 5000,
  enabled: process.env.EMAIL_ENABLED === "true",
};

export class EmailJob {
  private queue: Bull.Queue<EmailJobData> | null = null;
  private config: EmailConfig;
  private isRunning = false;

  constructor(config: Partial<EmailConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start the email job processor
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("Email job is already running");
      return;
    }

    if (!this.config.enabled) {
      logger.info("Email job is disabled");
      return;
    }

    if (!this.config.redisUrl) {
      logger.warn("Email job: Redis URL not configured, email queue disabled");
      return;
    }

    try {
      this.queue = new Bull<EmailJobData>("email-queue", this.config.redisUrl, {
        defaultJobOptions: {
          attempts: this.config.maxRetries,
          backoff: {
            type: "exponential",
            delay: this.config.retryDelay,
          },
          removeOnComplete: 100,
          removeOnFail: 50,
        },
      });

      this.setupProcessors();
      this.setupEventHandlers();

      this.isRunning = true;
      logger.info("Email job started");
    } catch (error) {
      logger.error("Failed to start email job", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  /**
   * Stop the email job processor
   */
  async stop(): Promise<void> {
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
    this.isRunning = false;
    logger.info("Email job stopped");
  }

  /**
   * Add an email to the queue
   */
  async addToQueue(emailData: EmailJobData): Promise<string | null> {
    if (!this.queue) {
      logger.warn("Email queue not initialized, email not sent", { to: emailData.to });
      return null;
    }

    const priority = this.getPriorityValue(emailData.priority);

    const job = await this.queue.add(emailData, {
      priority,
      jobId: `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    });

    logger.info("Email added to queue", {
      jobId: job.id,
      to: emailData.to,
      subject: emailData.subject,
    });

    return job.id?.toString() || null;
  }

  /**
   * Send email immediately (bypass queue)
   */
  async sendImmediate(emailData: EmailJobData): Promise<EmailResult> {
    return await this.sendEmail(emailData);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    if (!this.queue) {
      return {
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      };
    }

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.queue.getWaitingCount(),
      this.queue.getActiveCount(),
      this.queue.getCompletedCount(),
      this.queue.getFailedCount(),
      this.queue.getDelayedCount(),
    ]);

    return { waiting, active, completed, failed, delayed };
  }

  /**
   * Setup queue processors
   */
  private setupProcessors(): void {
    if (!this.queue) return;

    this.queue.process(async (job) => {
      const result = await this.sendEmail(job.data);

      if (!result.success) {
        throw new Error(result.error || "Email sending failed");
      }

      return result;
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    if (!this.queue) return;

    this.queue.on("completed", (job, result) => {
      logger.info("Email sent successfully", {
        jobId: job.id,
        to: job.data.to,
        messageId: result?.messageId,
      });
    });

    this.queue.on("failed", (job, error) => {
      logger.error("Email sending failed", {
        jobId: job.id,
        to: job.data.to,
        error: error.message,
        attempts: job.attemptsMade,
      });
    });

    this.queue.on("stalled", (job) => {
      logger.warn("Email job stalled", { jobId: job.id });
    });

    this.queue.on("error", (error) => {
      logger.error("Email queue error", { error: error.message });
    });
  }

  /**
   * Send email (actual implementation)
   * This is a placeholder - integrate with your email provider
   */
  private async sendEmail(emailData: EmailJobData): Promise<EmailResult> {
    try {
      // TODO: Implement actual email sending logic
      // Example with nodemailer, SendGrid, AWS SES, etc.

      // For now, just log and simulate success
      logger.info("Sending email", {
        to: emailData.to,
        subject: emailData.subject,
        template: emailData.template,
      });

      // Simulate email sending delay
      await new Promise((resolve) => setTimeout(resolve, 100));

      // In production, replace with actual email sending:
      // const transporter = nodemailer.createTransport({...});
      // const info = await transporter.sendMail({...});

      return {
        success: true,
        messageId: `mock-${Date.now()}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Convert priority string to number
   */
  private getPriorityValue(priority?: "high" | "normal" | "low"): number {
    switch (priority) {
      case "high":
        return 1;
      case "low":
        return 10;
      default:
        return 5;
    }
  }

  /**
   * Check if email job is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
}

export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

// Export singleton instance
export const emailJob = new EmailJob();
export default emailJob;
