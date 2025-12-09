/**
 * @file webhook.api.ts
 * @description Webhook API integration for handling external service callbacks
 * Updated for multi-tenancy support
 */

import * as crypto from "crypto";
import logger from "../config/logger";
import type {
  WebhookProvider,
  WebhookEvent,
  WebhookResult,
  WebhookHandler,
  WebhookStats,
  WebhookHealthCheck,
} from "../types/webhook";
import type { TenantContext } from "../types/tenant";

export class WebhookApiIntegration {
  private handlers: Map<string, WebhookHandler> = new Map();
  private tenantHandlers: Map<string, Map<string, WebhookHandler>> = new Map();

  constructor() {
    logger.info("Webhook API integration initialized with multi-tenancy support");
  }

  registerHandler(provider: WebhookProvider, eventType: string, handler: WebhookHandler): void {
    const key = `${provider}:${eventType}`;
    this.handlers.set(key, handler);
    logger.info("Webhook handler registered", { provider, eventType });
  }

  /**
   * Register tenant-specific webhook handler
   */
  registerTenantHandler(
    tenantId: string,
    provider: WebhookProvider,
    eventType: string,
    handler: WebhookHandler
  ): void {
    if (!this.tenantHandlers.has(tenantId)) {
      this.tenantHandlers.set(tenantId, new Map());
    }

    const tenantHandlerMap = this.tenantHandlers.get(tenantId)!;
    const key = `${provider}:${eventType}`;
    tenantHandlerMap.set(key, handler);

    logger.info("Tenant webhook handler registered", {
      tenantId,
      provider,
      eventType,
    });
  }

  async processWebhook(
    provider: WebhookProvider,
    payload: string,
    headers: Record<string, string>,
    tenantContext?: TenantContext
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
        tenantId: tenantContext?.id,
      };

      // Find and execute handler (tenant-specific first, then global)
      let handler: WebhookHandler | undefined;

      if (tenantContext?.id) {
        // Try tenant-specific handlers first
        const tenantHandlerMap = this.tenantHandlers.get(tenantContext.id);
        if (tenantHandlerMap) {
          handler =
            tenantHandlerMap.get(`${provider}:${eventType}`) ||
            tenantHandlerMap.get(`${provider}:*`);
        }
      }

      // Fallback to global handlers
      if (!handler) {
        handler =
          this.handlers.get(`${provider}:${eventType}`) || this.handlers.get(`${provider}:*`);
      }

      if (handler) {
        await handler(event);
        logger.info("Webhook event processed successfully", {
          eventId,
          provider,
          eventType,
          tenantId: tenantContext?.id,
        });
      } else {
        logger.warn("No handler found for webhook event", {
          eventId,
          provider,
          eventType,
          tenantId: tenantContext?.id,
        });
      }

      return {
        success: true,
        eventId,
        provider,
        type: eventType,
        tenantId: tenantContext?.id,
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      logger.error("Webhook processing failed", {
        eventId,
        provider,
        tenantId: tenantContext?.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return {
        success: false,
        eventId,
        provider,
        type: "unknown",
        tenantId: tenantContext?.id,
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
  getHandlerStats(tenantId?: string): WebhookStats {
    const handlersByProvider: Record<string, number> = {};
    const registeredProviders = new Set<WebhookProvider>();
    let totalHandlers = 0;

    if (tenantId && this.tenantHandlers.has(tenantId)) {
      // Get tenant-specific stats
      const tenantHandlerMap = this.tenantHandlers.get(tenantId)!;
      totalHandlers = tenantHandlerMap.size;

      for (const [key] of tenantHandlerMap) {
        const [provider] = key.split(":");
        handlersByProvider[provider] = (handlersByProvider[provider] || 0) + 1;
        registeredProviders.add(provider as WebhookProvider);
      }
    } else {
      // Get global stats
      totalHandlers = this.handlers.size;

      for (const [key] of this.handlers) {
        const [provider] = key.split(":");
        handlersByProvider[provider] = (handlersByProvider[provider] || 0) + 1;
        registeredProviders.add(provider as WebhookProvider);
      }

      // Add tenant-specific handlers to total
      for (const tenantHandlerMap of this.tenantHandlers.values()) {
        totalHandlers += tenantHandlerMap.size;
        for (const [key] of tenantHandlerMap) {
          const [provider] = key.split(":");
          handlersByProvider[provider] = (handlersByProvider[provider] || 0) + 1;
          registeredProviders.add(provider as WebhookProvider);
        }
      }
    }

    return {
      totalHandlers,
      handlersByProvider,
      registeredProviders: Array.from(registeredProviders),
      tenantId,
    };
  }

  /**
   * Health check for webhook integration
   */
  healthCheck(tenantId?: string): WebhookHealthCheck {
    const stats = this.getHandlerStats(tenantId);

    return {
      status: "healthy",
      configuredProviders: stats.registeredProviders || [],
      totalHandlers: stats.totalHandlers || 0,
      tenantId,
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
   * Register tenant-specific wildcard handler for all events from a provider
   */
  registerTenantProviderHandler(
    tenantId: string,
    provider: WebhookProvider,
    handler: WebhookHandler
  ): void {
    if (!this.tenantHandlers.has(tenantId)) {
      this.tenantHandlers.set(tenantId, new Map());
    }

    const tenantHandlerMap = this.tenantHandlers.get(tenantId)!;
    const key = `${provider}:*`;
    tenantHandlerMap.set(key, handler);

    logger.info("Tenant webhook provider handler registered", {
      tenantId,
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

  /**
   * Remove tenant-specific handler
   */
  removeTenantHandler(tenantId: string, provider: WebhookProvider, eventType: string): boolean {
    const tenantHandlerMap = this.tenantHandlers.get(tenantId);
    if (!tenantHandlerMap) {
      return false;
    }

    const key = `${provider}:${eventType}`;
    const removed = tenantHandlerMap.delete(key);

    if (removed) {
      logger.info("Tenant webhook handler removed", {
        tenantId,
        provider,
        eventType,
      });
    }

    return removed;
  }

  /**
   * Get all registered tenants
   */
  getRegisteredTenants(): string[] {
    return Array.from(this.tenantHandlers.keys());
  }

  /**
   * Clear all handlers for a tenant
   */
  clearTenantHandlers(tenantId: string): boolean {
    const removed = this.tenantHandlers.delete(tenantId);

    if (removed) {
      logger.info("All tenant webhook handlers cleared", { tenantId });
    }

    return removed;
  }

  /**
   * Trigger a generic webhook given the URL and payload
   * @param url - webhook endpoint (unused in mock)
   * @param payload - body data (unused in mock)
   */
  async triggerWebhook(_url: string, _payload: any): Promise<void> {
    // Đây là mock cho unit test/kiểm tra TS
    return Promise.resolve();
  }
}

export const webhookApi = new WebhookApiIntegration();
export default webhookApi;
