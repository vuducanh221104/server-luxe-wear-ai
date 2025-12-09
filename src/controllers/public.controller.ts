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

/**
 * Public Controller Class
 * Object-based controller for public operations
 */
export class PublicController {
  /**
   * Chat with public agent using API key - STREAMING
   * POST /api/public/agents/:agentId/chat
   * @access Public (API key required)
   */
  chatWithPublicAgent = async (req: Request, res: Response): Promise<void> => {
    try {
      const startTime = Date.now();

      // Validation
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array()) as any;
      }

      if (!req.agent) {
        return errorResponse(res, "Agent not found", 404) as any;
      }

      // Extract data
      const { message, context } = req.body;
      const agent = req.agent;
      const agentConfig = agent.config as Record<string, unknown>;
      const systemPrompt =
        (agentConfig?.systemPrompt as string) || "You are a helpful AI assistant.";
      const fullMessage = context ? `${context}\n\nUser: ${message}` : message;

      logger.info("Public streaming chat request", {
        agentId: agent.id,
        messageLen: message.length,
        origin: req.get("Origin"),
      });

      // Check knowledge (use agent service for consistency)
      const { agentService } = await import("../services/agent.service");
      const useRag = await agentService.hasKnowledge(agent.owner_id || "", agent.tenant_id || "");

      logger.info(`Using ${useRag ? "streaming RAG" : "direct streaming AI"}`, {
        agentId: agent.id,
      });

      // Set headers for streaming
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

      const aiStart = Date.now();
      let fullResponse = "";
      let generator: AsyncGenerator<string, void, unknown>;

      if (useRag) {
        // Use RAG pipeline with knowledge base
        const { streamChatWithRAG } = await import("../services/rag.service");
        generator = streamChatWithRAG(fullMessage, agent.owner_id || undefined, systemPrompt);
      } else {
        // Direct AI call without RAG
        const { geminiApi } = await import("../integrations/gemini.api");
        const prompt = `${systemPrompt}\n\nUser: ${fullMessage}\n\n[IMPORTANT: Keep response focused and under 2000 words. Be detailed but concise.]`;

        generator = geminiApi.streamGenerateContent(prompt, {
          model: "gemini-2.5-flash",
          maxOutputTokens: 3072,
          temperature: 0.7,
        });
      }

      // Stream the response
      for await (const chunk of generator) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }

      const aiDuration = Date.now() - aiStart;

      // Send completion event
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();

      // Log analytics asynchronously (delegated to service - fire-and-forget)
      agentService
        .logChatAnalytics(
          agent.id,
          agent.owner_id || "public",
          agent.tenant_id || "",
          message,
          fullResponse
        )
        .catch((error) => {
          logger.warn("Analytics logging failed (non-critical)", {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        });

      const totalDuration = Date.now() - startTime;

      logger.info("Streaming chat completed", {
        agentId: agent.id,
        aiDuration: `${aiDuration}ms`,
        totalDuration: `${totalDuration}ms`,
        useRag,
        responseLength: fullResponse.length,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      logger.error("Streaming AI failed", {
        agentId: req.agent?.id,
        error: msg,
      });

      if (!res.headersSent) {
        return errorResponse(res, "Failed to generate streaming response", 500) as any;
      } else {
        // If streaming already started, send error event
        res.write(`data: ${JSON.stringify({ error: "Stream failed" })}\n\n`);
        res.end();
      }
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
