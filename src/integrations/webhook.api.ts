/**
 * @file webhook.api.ts
 * @description Webhook API integration for handling external service callbacks
 */

import crypto from "crypto";
import logger from "../config/logger";
import type {
  WebhookProvider,
  WebhookEvent,
  WebhookResult,
  WebhookHandler,
  WebhookStats,
  WebhookHealthCheck,
} from "../types/webhook";

export class WebhookApiIntegration {
  private handlers: Map<string, WebhookHandler> = new Map();

  constructor() {
    logger.info("Webhook API integration initialized");
  }

  registerHandler(provider: WebhookProvider, eventType: string, handler: WebhookHandler): void {
    const key = `${provider}:${eventType}`;
    this.handlers.set(key, handler);
    logger.info("Webhook handler registered", { provider, eventType });
  }

  async processWebhook(
    provider: WebhookProvider,
    payload: string,
    headers: Record<string, string>
  ): Promise<WebhookResult> {
    const startTime = Date.now();
    const eventId = crypto.randomUUID();

    try {
      const data = JSON.parse(payload);
      const eventType = this.extractEventType(provider, data, headers);

      const event: WebhookEvent = {
        id: eventId,
        provider,
        type: eventType,
        timestamp: new Date(),
        data,
        headers,
      };

      // Find and execute handler (specific first, then wildcard)
      const specificHandler = this.handlers.get(`${provider}:${eventType}`);
      const wildcardHandler = this.handlers.get(`${provider}:*`);
      const handler = specificHandler || wildcardHandler;

      if (handler) {
        await handler(event);
      } else {
        logger.warn("No handler found for webhook event", {
          eventId,
          provider,
          eventType,
        });
      }

      return {
        success: true,
        eventId,
        provider,
        type: eventType,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        eventId,
        provider,
        type: "unknown",
        error: error instanceof Error ? error.message : "Unknown error",
        processingTime: Date.now() - startTime,
      };
    }
  }

  private extractEventType(
    provider: WebhookProvider,
    data: Record<string, unknown>,
    headers: Record<string, string>
  ): string {
    switch (provider) {
      case "stripe":
        return (typeof data.type === "string" ? data.type : null) || "unknown";
      case "github":
        return headers["x-github-event"] || "unknown";
      default:
        return (
          (typeof data.type === "string" ? data.type : null) ||
          (typeof data.event === "string" ? data.event : null) ||
          "unknown"
        );
    }
  }

  /**
   * Get webhook handler statistics
   */
  getHandlerStats(): WebhookStats {
    const handlersByProvider: Record<string, number> = {};
    const registeredProviders = new Set<WebhookProvider>();

    for (const [key] of this.handlers) {
      const [provider] = key.split(":");
      handlersByProvider[provider] = (handlersByProvider[provider] || 0) + 1;
      registeredProviders.add(provider as WebhookProvider);
    }

    return {
      totalHandlers: this.handlers.size,
      handlersByProvider,
      registeredProviders: Array.from(registeredProviders),
    };
  }

  /**
   * Health check for webhook integration
   */
  healthCheck(): WebhookHealthCheck {
    const stats = this.getHandlerStats();

    return {
      status: "healthy",
      configuredProviders: stats.registeredProviders || [],
      totalHandlers: stats.totalHandlers || 0,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Register wildcard handler for all events from a provider
   */
  registerProviderHandler(provider: WebhookProvider, handler: WebhookHandler): void {
    const key = `${provider}:*`;
    this.handlers.set(key, handler);

    logger.info("Webhook provider handler registered", {
      provider,
      key,
    });
  }

  /**
   * Remove handler
   */
  removeHandler(provider: WebhookProvider, eventType: string): boolean {
    const key = `${provider}:${eventType}`;
    const removed = this.handlers.delete(key);

    if (removed) {
      logger.info("Webhook handler removed", { provider, eventType });
    }

    return removed;
  }
}

export const webhookApi = new WebhookApiIntegration();
export default webhookApi;
