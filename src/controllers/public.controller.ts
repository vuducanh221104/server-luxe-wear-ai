/**
 * @file public.controller.ts
 * @description Public controller for external agent access
 * Handles HTTP requests for public agent operations (API key based)
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { successResponse, errorResponse } from "../utils/response";
import { chatWithRAG } from "../utils/vectorizer";
import logger from "../config/logger";
import { supabaseAdmin } from "../config/supabase";

/**
 * Public Controller Class
 * Object-based controller for public operations
 */
export class PublicController {
  /**
   * Chat with public agent using API key
   * POST /api/public/agents/:agentId/chat
   * @access Public (API key required)
   */
  async chatWithPublicAgent(req: Request, res: Response): Promise<Response> {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return errorResponse(res, "Validation failed", 400, errors.array());
      }

      // Agent is attached by apiKeyMiddleware
      if (!req.agent) {
        return errorResponse(res, "Agent not found or not accessible", 404);
      }

      const { message, context } = req.body;
      const agent = req.agent;

      // Get agent configuration
      const agentConfig = agent.config as Record<string, unknown>;
      const systemPrompt =
        (agentConfig?.systemPrompt as string) || "You are a helpful AI assistant.";

      logger.info("Public agent chat request", {
        agentId: agent.id,
        agentName: agent.name,
        messageLength: message.length,
        hasContext: !!context,
        origin: req.get("Origin"),
      });

      // Use RAG to generate response with agent's knowledge base
      const response = await chatWithRAG(
        context ? `${context}\n\nUser: ${message}` : message,
        agent.owner_id || undefined, // Use agent owner's knowledge base
        systemPrompt
      );

      // Log analytics
      try {
        await supabaseAdmin.from("analytics").insert({
          agent_id: agent.id,
          user_id: agent.owner_id || "public",
          query: message,
          response: response,
          vector_score: null, // Could be enhanced to include similarity scores
        });
      } catch (analyticsError) {
        logger.warn("Failed to log analytics", {
          agentId: agent.id,
          error: analyticsError instanceof Error ? analyticsError.message : "Unknown error",
        });
      }

      logger.info("Public agent chat completed", {
        agentId: agent.id,
        responseLength: response.length,
      });

      return successResponse(
        res,
        {
          response,
          agent: {
            id: agent.id,
            name: agent.name,
            description: agent.description,
          },
          timestamp: new Date().toISOString(),
        },
        "Chat response generated successfully"
      );
    } catch (error) {
      logger.error("Public agent chat error", {
        agentId: req.agent?.id,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      return errorResponse(
        res,
        error instanceof Error ? error.message : "Failed to generate response",
        500
      );
    }
  }

  /**
   * Get public agent information
   * GET /api/public/agents/:agentId
   * @access Public (API key required)
   */
  async getPublicAgentInfo(req: Request, res: Response): Promise<Response> {
    try {
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
    } catch (error) {
      logger.error("Get public agent info error", {
        agentId: req.agent?.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });

      return errorResponse(res, "Failed to get agent information", 500);
    }
  }

  /**
   * Health check for public API
   * GET /api/public/health
   * @access Public (no auth required)
   */
  async publicHealthCheck(_req: Request, res: Response): Promise<Response> {
    return successResponse(
      res,
      {
        status: "ok",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      },
      "Public API is healthy"
    );
  }
}

// Create and export controller instance
export const publicController = new PublicController();

// Export individual methods for backward compatibility
export const { chatWithPublicAgent, getPublicAgentInfo, publicHealthCheck } = publicController;

export default publicController;
