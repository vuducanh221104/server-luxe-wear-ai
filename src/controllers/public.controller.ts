/**
 * @file public.controller.ts
 * @description Public controller for external agent access
 * Handles HTTP requests for public agent operations (API key based)
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { successResponse, errorResponse } from "../utils/response";
import { handleAsyncOperationStrict } from "../utils/errorHandler";
import logger from "../config/logger";
import { supabaseAdmin } from "../config/supabase";

/**
 * Public Controller Class
 * Object-based controller for public operations
 */
export class PublicController {
  /**
   * Check if user has knowledge base
   */
  private hasKnowledge = async (userId: string): Promise<boolean> => {
    try {
      const { count } = await supabaseAdmin
        .from("knowledge")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .limit(1);

      return (count || 0) > 0;
    } catch (error) {
      logger.warn("Knowledge check failed, assuming no knowledge", {
        userId,
        error: error instanceof Error ? error.message : "Unknown",
      });
      return false;
    }
  };

  /**
   * Log analytics in background (non-blocking)
   */
  private logAnalyticsAsync = (data: {
    agent_id: string;
    user_id: string;
    tenant_id: string | null;
    query: string;
    response: string;
  }): void => {
    void (async (): Promise<void> => {
      try {
        await supabaseAdmin.from("analytics").insert(data);
        logger.debug("Analytics logged", { agentId: data.agent_id });
      } catch (error) {
        logger.warn("Analytics failed", {
          agentId: data.agent_id,
          error: error instanceof Error ? error.message : "Unknown",
        });
      }
    })();
  };

  /**
   * Chat with public agent using API key
   * POST /api/public/agents/:agentId/chat
   * @access Public (API key required)
   */
  chatWithPublicAgent = async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      errorResponse(res, "Validation failed", 400, errors.array());
      return;
    }
    if (!req.agent) {
      errorResponse(res, "Agent not found", 404);
      return;
    }
    const { message, context } = req.body;
    const agent = req.agent;
    const agentConfig = agent.config as Record<string, unknown>;
    const systemPrompt = (agentConfig?.systemPrompt as string) || "You are a helpful AI assistant.";
    const fullMessage = context ? `${context}\n\nUser: ${message}` : message;
    // Kiểm tra knowledge base (RAG) theo owner
    const useRag = await this.hasKnowledge(agent.owner_id || "");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.flushHeaders && res.flushHeaders();
    let fullResponseText = "";
    try {
      if (useRag) {
        const { chatWithRAGStream } = await import("../services/rag.service");
        for await (const chunk of chatWithRAGStream(fullMessage, agent.owner_id ?? undefined, systemPrompt)) {
          fullResponseText += chunk;
          res.write(chunk);
        }
      } else {
        const { geminiApi } = await import("../integrations/gemini.api");
        for await (const chunk of geminiApi.generateContent(
          `${systemPrompt}\n\nUser: ${fullMessage}\n\n[IMPORTANT: Keep response focused and under 2000 words. Be detailed but concise.]`,
          {
            model: "gemini-2.5-flash",
            maxOutputTokens: 3072,
            temperature: 0.7,
          }
        )) {
          fullResponseText += chunk;
          res.write(chunk);
        }
      }
      res.end();
      // log analytics in background
      this.logAnalyticsAsync({
        agent_id: agent.id,
        user_id: agent.owner_id || "public",
        tenant_id: agent.tenant_id,
        query: message,
        response: fullResponseText,
      });
    } catch (err) {
      logger.error("AI streaming error (public)", { error: err });
      res.status(500).end("Error generating streaming AI response");
    }
  };

  /**
   * Get public agent information
   * GET /api/public/agents/:agentId
   * @access Public (API key required)
   */
  getPublicAgentInfo = async (req: Request, res: Response): Promise<Response> => {
    return handleAsyncOperationStrict(
      async () => {
        // Agent is attached by apiKeyMiddleware
        if (!req.agent) {
          return errorResponse(res, "Agent not found or not accessible", 404);
        }

        const agent = req.agent;

        logger.info("Public agent info request", {
          agentId: agent.id,
          origin: req.get("Origin"),
        });

        return successResponse(
          res,
          {
            id: agent.id,
            name: agent.name,
            description: agent.description,
            config: {
              // Only expose safe config properties
              model: (agent.config as Record<string, unknown>)?.model,
              temperature: (agent.config as Record<string, unknown>)?.temperature,
              maxTokens: (agent.config as Record<string, unknown>)?.maxTokens,
              // Don't expose systemPrompt or other sensitive data
            },
            createdAt: agent.created_at,
            updatedAt: agent.updated_at,
          },
          "Agent information retrieved successfully"
        );
      },
      "get public agent info",
      {
        context: {
          agentId: req.agent?.id,
          origin: req.get("Origin"),
        },
      }
    );
  };

  /**
   * Health check for public API
   * GET /api/public/health
   * @access Public (no auth required)
   */
  publicHealthCheck = async (_req: Request, res: Response): Promise<Response> => {
    return handleAsyncOperationStrict(
      async () => {
        return successResponse(
          res,
          {
            status: "ok",
            timestamp: new Date().toISOString(),
            version: "1.0.0",
          },
          "Public API is healthy"
        );
      },
      "public health check",
      {
        context: {
          userAgent: _req.get("User-Agent"),
          ip: _req.ip,
        },
      }
    );
  };
}

// Create and export controller instance
export const publicController = new PublicController();

// Export individual methods for backward compatibility
export const { chatWithPublicAgent, getPublicAgentInfo, publicHealthCheck } = publicController;

export default publicController;
