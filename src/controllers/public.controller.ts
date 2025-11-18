/**
 * @file public.controller.ts
 * @description Public controller for external agent access
 * Handles HTTP requests for public agent operations (API key based)
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { successResponse, errorResponse } from "../utils/response";
import { chatWithRAG } from "../services/rag.service";
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
   * Generate AI response with timeout
   */
  private generateWithTimeout = async (
    message: string,
    systemPrompt: string,
    ownerId: string | null,
    useRag: boolean,
    timeoutMs: number
  ): Promise<string> => {
    let generator: Promise<string>;

    if (useRag) {
      generator = chatWithRAG(message, ownerId || undefined, systemPrompt);
    } else {
      // For direct AI without RAG, use Flash model for speed (3-5x faster)
      const { geminiApi } = await import("../integrations/gemini.api");

      generator = (async (): Promise<string> => {
        const prompt = `${systemPrompt}\n\nUser: ${message}\n\n[IMPORTANT: Keep response focused and under 2000 words. Be detailed but concise.]`;

        const result = await geminiApi.generateContent(prompt, {
          model: "gemini-2.5-flash",
          maxOutputTokens: 3072,
          temperature: 0.7,
        });

        if (!result.data) {
          throw new Error("AI response is empty");
        }

        return result.data;
      })();
    }

    return Promise.race([
      generator,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error("AI response timeout")), timeoutMs)
      ),
    ]);
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
  chatWithPublicAgent = async (req: Request, res: Response): Promise<Response> => {
    return handleAsyncOperationStrict(
      async () => {
        const startTime = Date.now();

        // Validate
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
          return errorResponse(res, "Validation failed", 400, errors.array());
        }

        if (!req.agent) {
          return errorResponse(res, "Agent not found", 404);
        }

        // Extract data
        const { message, context } = req.body;
        const agent = req.agent;
        const agentConfig = agent.config as Record<string, unknown>;
        const systemPrompt =
          (agentConfig?.systemPrompt as string) || "You are a helpful AI assistant.";
        const timeoutMs = (agentConfig?.timeout as number) || 90000;
        const fullMessage = context ? `${context}\n\nUser: ${message}` : message;

        logger.info("Public chat request", {
          agentId: agent.id,
          messageLen: message.length,
          origin: req.get("Origin"),
        });

        // Check knowledge & generate response
        const useRag = await this.hasKnowledge(agent.owner_id || "");
        logger.info(`Using ${useRag ? "RAG" : "direct AI"}`, { agentId: agent.id });

        const aiStart = Date.now();
        let response: string;

        try {
          response = await this.generateWithTimeout(
            fullMessage,
            systemPrompt,
            agent.owner_id,
            useRag,
            timeoutMs
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          logger.error("AI failed", {
            agentId: agent.id,
            error: msg,
            duration: Date.now() - aiStart,
          });

          return errorResponse(
            res,
            msg.includes("timeout")
              ? "Request timeout. Please try again."
              : "Failed to generate response",
            msg.includes("timeout") ? 504 : 500
          );
        }

        // Log analytics (background)
        this.logAnalyticsAsync({
          agent_id: agent.id,
          user_id: agent.owner_id || "public",
          tenant_id: agent.tenant_id,
          query: message,
          response,
        });

        const aiDuration = Date.now() - aiStart;
        const totalDuration = Date.now() - startTime;

        logger.info("Chat completed", {
          agentId: agent.id,
          aiDuration: `${aiDuration}ms`,
          totalDuration: `${totalDuration}ms`,
          useRag,
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
            performance: { aiDuration, totalDuration, useRag },
          },
          "Chat response generated successfully"
        );
      },
      "chat with public agent",
      {
        context: {
          agentId: req.agent?.id,
          messageLength: req.body?.message?.length,
        },
      }
    );
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

  /**
   * Get embeddable chat widget HTML page
   * GET /api/public/widget/:agentId
   * @access Public (API key optional in query param)
   */
  getWidgetPage = async (req: Request, res: Response): Promise<void> => {
    try {
      const { agentId } = req.params;
      const apiKey = req.query.apiKey as string | undefined;
      const API_BASE_URL = process.env.NEXT_PUBLIC_SERVER_URL || process.env.SERVER_URL || "http://localhost:3001";
      const API_PREFIX = "/api";

      // Get agent info to display name
      let agentName = "AI Assistant";

      if (apiKey) {
        try {
          // Try to get agent info with API key
          const { data: agent, error } = await supabaseAdmin
            .from("agents")
            .select("name")
            .eq("id", agentId)
            .eq("api_key", apiKey)
            .single();

          if (!error && agent) {
            agentName = agent.name || "AI Assistant";
          }
        } catch (error) {
          logger.warn("Failed to fetch agent info for widget", {
            agentId,
            error: error instanceof Error ? error.message : "Unknown",
          });
        }
      }

      // Generate HTML widget page
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${agentName} - Chat Widget</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #ffffff;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .chat-header {
      padding: 16px;
      background: #007bff;
      color: white;
      border-radius: 12px 12px 0 0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .chat-header h3 {
      font-size: 16px;
      font-weight: 600;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      background: #28a745;
      border-radius: 50%;
      display: inline-block;
      margin-right: 8px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      background: #f8f9fa;
    }
    .message {
      margin-bottom: 16px;
      display: flex;
      gap: 8px;
      align-items: flex-start;
    }
    .message.user {
      flex-direction: row-reverse;
    }
    .message-content {
      max-width: 75%;
      padding: 12px 16px;
      border-radius: 12px;
      word-wrap: break-word;
    }
    .message.user .message-content {
      background: #007bff;
      color: white;
    }
    .message.assistant .message-content {
      background: white;
      color: #333;
      border: 1px solid #e0e0e0;
    }
    .message-content pre {
      background: #f5f5f5;
      padding: 8px;
      border-radius: 4px;
      overflow-x: auto;
      margin: 8px 0;
    }
    .message-content code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.9em;
    }
    .message-content pre code {
      background: transparent;
      padding: 0;
    }
    .avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .message.user .avatar {
      background: #6c757d;
      color: white;
    }
    .message.assistant .avatar {
      background: #007bff;
      color: white;
    }
    .chat-input-container {
      padding: 16px;
      background: white;
      border-top: 1px solid #e0e0e0;
    }
    .chat-input-wrapper {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    .chat-input {
      flex: 1;
      padding: 12px;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      resize: none;
      font-family: inherit;
      font-size: 14px;
      min-height: 44px;
      max-height: 120px;
    }
    .chat-input:focus {
      outline: none;
      border-color: #007bff;
    }
    .send-button {
      padding: 12px 24px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: background 0.2s;
      flex-shrink: 0;
    }
    .send-button:hover:not(:disabled) {
      background: #0056b3;
    }
    .send-button:disabled {
      background: #ccc;
      cursor: not-allowed;
    }
    .loading {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #6c757d;
      font-size: 14px;
      padding: 8px 16px;
    }
    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #007bff;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .error {
      background: #f8d7da;
      color: #721c24;
      padding: 12px;
      border-radius: 8px;
      margin: 8px 0;
    }
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #6c757d;
      text-align: center;
      padding: 32px;
    }
    .empty-state p {
      margin-top: 8px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="chat-header">
    <div>
      <span class="status-dot"></span>
      <h3>${agentName}</h3>
    </div>
  </div>
  <div class="chat-messages" id="messages">
    <div class="empty-state">
      <p>Start a conversation</p>
      <p style="font-size: 12px; margin-top: 4px;">Type a message below to begin</p>
    </div>
  </div>
  <div class="chat-input-container">
    <div class="chat-input-wrapper">
      <textarea
        id="messageInput"
        class="chat-input"
        placeholder="Type your message... (Press Enter to send, Shift+Enter for new line)"
        rows="1"
      ></textarea>
      <button id="sendButton" class="send-button">Send</button>
    </div>
  </div>

  <script>
    const agentId = '${agentId}';
    // Get API key from URL query parameter or from template
    const urlParams = new URLSearchParams(window.location.search);
    const apiKeyFromUrl = urlParams.get('apiKey');
    const apiKey = apiKeyFromUrl || '${apiKey || ""}';
    const apiUrl = '${API_BASE_URL}${API_PREFIX}';
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    let isLoading = false;
    let messages = [];
    
    // Check if API key is available
    if (!apiKey) {
      messagesContainer.innerHTML = '<div class="empty-state"><p style="color: #dc3545;">⚠️ API Key Required</p><p style="font-size: 12px; margin-top: 4px;">Please provide API key in URL: ?apiKey=YOUR_API_KEY</p></div>';
    }

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    // Send message on Enter (Shift+Enter for new line)
    messageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // Send button click
    sendButton.addEventListener('click', sendMessage);

    function addMessage(role, content) {
      messages.push({ role, content, timestamp: Date.now() });
      renderMessages();
    }

    function renderMessages() {
      if (messages.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-state"><p>Start a conversation</p><p style="font-size: 12px; margin-top: 4px;">Type a message below to begin</p></div>';
        return;
      }

      messagesContainer.innerHTML = messages.map((msg, idx) => {
        const isUser = msg.role === 'user';
        const content = escapeHtml(msg.content).replace(/\\n/g, '<br>');
        // Simple markdown: **bold**, *italic*, code, code block
        const boldRegex = /\\*\\*([^*]+)\\*\\*/g;
        const italicRegex = /\\*([^*]+)\\*/g;
        const codeRegex = /\`([^\`]+)\`/g;
        const codeBlockRegex = /\`\`\`([\\s\\S]*?)\`\`\`/g;
        const formatted = content
          .replace(boldRegex, '<strong>$1</strong>')
          .replace(italicRegex, '<em>$1</em>')
          .replace(codeRegex, '<code>$1</code>')
          .replace(codeBlockRegex, '<pre><code>$1</code></pre>');
        
        const messageClass = isUser ? 'user' : 'assistant';
        const avatarText = isUser ? 'You' : 'AI';
        return '<div class="message ' + messageClass + '"><div class="avatar">' + avatarText + '</div><div class="message-content">' + formatted + '</div></div>';
      }).join('');
      
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    async function sendMessage() {
      const message = messageInput.value.trim();
      if (!message || isLoading) return;
      
      // Check API key before sending
      if (!apiKey) {
        addMessage('assistant', '❌ Error: API key is required. Please provide API key in URL: ?apiKey=YOUR_API_KEY');
        return;
      }

      // Add user message
      addMessage('user', message);
      messageInput.value = '';
      messageInput.style.height = 'auto';
      
      // Show loading
      isLoading = true;
      sendButton.disabled = true;
      const loadingDiv = document.createElement('div');
      loadingDiv.className = 'loading';
      loadingDiv.id = 'loading';
      loadingDiv.innerHTML = '<div class="spinner"></div><span>Assistant is thinking...</span>';
      messagesContainer.appendChild(loadingDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      try {
        const headers = {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey, // Always send API key if available
        };

        const response = await fetch(apiUrl + '/public/agents/' + agentId + '/chat', {
          method: 'POST',
          headers,
          body: JSON.stringify({ message }),
        });

        const data = await response.json();

        // Remove loading
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.remove();

        if (data.success && data.data && data.data.response) {
          addMessage('assistant', data.data.response);
        } else {
          const errorMsg = data.message || 'Failed to get response';
          addMessage('assistant', '❌ Error: ' + errorMsg);
        }
      } catch (error) {
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.remove();
        
        const errorMsg = error.message || 'Network error';
        addMessage('assistant', '❌ Error: ' + errorMsg);
      } finally {
        isLoading = false;
        sendButton.disabled = false;
        messageInput.focus();
      }
    }
  </script>
</body>
</html>`;

      res.setHeader("Content-Type", "text/html");
      res.setHeader("X-Frame-Options", "ALLOWALL");
      res.setHeader("Content-Security-Policy", "frame-ancestors *");
      res.send(html);
    } catch (error) {
      logger.error("Failed to render widget page", {
        agentId: req.params.agentId,
        error: error instanceof Error ? error.message : "Unknown",
      });
      res.status(500).send(`
        <html>
          <body style="font-family: Arial; padding: 20px;">
            <h2>Error loading widget</h2>
            <p>Failed to load chat widget. Please check the agent ID and try again.</p>
          </body>
        </html>
      `);
    }
  };
}

// Create and export controller instance
export const publicController = new PublicController();

// Export individual methods for backward compatibility
export const { chatWithPublicAgent, getPublicAgentInfo, publicHealthCheck, getWidgetPage } = publicController;

export default publicController;
