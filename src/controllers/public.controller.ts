/**
 * @file public.controller.ts
 * @description Public controller for external agent access
 * Handles HTTP requests for public agent operations (API key based)
 */

import { Request, Response } from "express";
import { validationResult } from "express-validator";
import { successResponse, errorResponse } from "../utils/response";
import { chatWithRAG, type RAGChatResponse, type Citation } from "../services/rag.service";
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
   * Returns response string and optional citations
   */
  private generateWithTimeout = async (
    message: string,
    systemPrompt: string,
    ownerId: string | null,
    useRag: boolean,
    timeoutMs: number
  ): Promise<{ response: string; citations?: Citation[] }> => {
    let generator: Promise<{ response: string; citations?: Citation[] }>;

    if (useRag) {
      const ragResult = chatWithRAG(
        message,
        ownerId || undefined,
        systemPrompt,
        undefined, // tenantId
        undefined, // agentId
        true // includeCitations
      );

      generator = (async (): Promise<{ response: string; citations?: Citation[] }> => {
        const result = await ragResult;
        if (typeof result === "string") {
          return { response: result };
        }
        return { response: result.response, citations: result.citations };
      })();
    } else {
      // For direct AI without RAG, use Flash model for speed (3-5x faster)
      const { geminiApi } = await import("../integrations/gemini.api");

      generator = (async (): Promise<{ response: string; citations?: Citation[] }> => {
        const prompt = `${systemPrompt}\n\nUser: ${message}\n\n[IMPORTANT: Keep response focused and under 2000 words. Be detailed but concise.]`;

        const result = await geminiApi.generateContent(prompt, {
          model: "gemini-2.5-flash",
          maxOutputTokens: 3072,
          temperature: 0.7,
        });

        if (!result.data) {
          throw new Error("AI response is empty");
        }

        return { response: result.data };
      })();
    }

    return Promise.race([
      generator,
      new Promise<{ response: string; citations?: Citation[] }>((_, reject) =>
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
        let citations: Citation[] | undefined;

        try {
          const result = await this.generateWithTimeout(
            fullMessage,
            systemPrompt,
            agent.owner_id,
            useRag,
            timeoutMs
          );
          response = result.response;
          citations = result.citations;
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
          citationsCount: citations?.length || 0,
        });

        return successResponse(
          res,
          {
            response,
            citations: citations && citations.length > 0 ? citations : undefined,
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
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      color: #1f2937;
    }
    
    /* Header */
    .chat-header {
      padding: 16px 20px;
      background: #1f2937; /* Dark charcoal */
      color: white;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      z-index: 10;
    }
    .header-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .agent-avatar {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 16px;
      border: 2px solid rgba(255,255,255,0.2);
    }
    .agent-details h3 {
      font-size: 16px;
      font-weight: 600;
      line-height: 1.2;
    }
    .status-text {
      font-size: 12px;
      opacity: 0.8;
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
    }
    .status-dot {
      width: 6px;
      height: 6px;
      background: #10b981;
      border-radius: 50%;
      display: inline-block;
    }
    .close-btn {
      background: none;
      border: none;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      padding: 4px;
      transition: color 0.2s;
    }
    .close-btn:hover {
      color: white;
    }

    /* Messages */
    .chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 24px 20px;
      background: #f9fafb; /* Very light gray */
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .message-group {
      display: flex;
      gap: 12px;
      align-items: flex-end;
      width: 100%;
    }
    .message-group.user {
      flex-direction: row-reverse;
    }
    .message-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #e5e7eb;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      color: #6b7280;
      flex-shrink: 0;
      margin-bottom: 4px;
    }
    .message-avatar.assistant {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;
    }
    
    .message-bubble {
      max-width: 80%;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.5;
      position: relative;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      animation: slideUp 0.3s ease-out;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message-group.assistant .message-bubble {
      background: white;
      color: #1f2937;
      border-bottom-left-radius: 4px;
    }
    .message-group.user .message-bubble {
      background: #FFF9E6; /* Pale yellow/beige as requested */
      color: #1f2937;
      border-bottom-right-radius: 4px;
      /* If beige is too light, use a soft blue: #eff6ff */
    }
    
    .timestamp {
      font-size: 10px;
      color: #9ca3af;
      margin-top: 4px;
      text-align: right;
    }
    .message-group.assistant .timestamp {
      text-align: left;
    }

    /* Content Styling */
    .message-bubble pre {
      background: #f3f4f6;
      padding: 10px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 8px 0;
      border: 1px solid #e5e7eb;
    }
    .message-bubble code {
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 0.9em;
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
      padding: 2px 4px;
      border-radius: 4px;
    }
    .message-bubble pre code {
      color: inherit;
      background: transparent;
      padding: 0;
    }
    .message-bubble p {
      margin-bottom: 8px;
    }
    .message-bubble p:last-child {
      margin-bottom: 0;
    }

    /* Input Area */
    .chat-input-container {
      padding: 16px 20px;
      background: white;
      border-top: 1px solid #f3f4f6;
    }
    .input-wrapper {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 24px;
      padding: 8px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .input-wrapper:focus-within {
      border-color: #3b82f6;
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      background: white;
    }
    
    .chat-input {
      flex: 1;
      border: none;
      background: transparent;
      padding: 8px 0;
      font-family: inherit;
      font-size: 14px;
      resize: none;
      max-height: 100px;
      outline: none;
      color: #1f2937;
    }
    .chat-input::placeholder {
      color: #9ca3af;
    }

    .icon-btn {
      background: none;
      border: none;
      cursor: pointer;
      color: #6b7280;
      padding: 4px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s;
    }
    .icon-btn:hover {
      color: #374151;
      background: #f3f4f6;
    }
    .send-btn {
      background: #1f2937;
      color: white;
      width: 32px;
      height: 32px;
      padding: 0;
    }
    .send-btn:hover:not(:disabled) {
      background: #374151;
      transform: scale(1.05);
      color: white;
    }
    .send-btn:disabled {
      background: #d1d5db;
      cursor: not-allowed;
      transform: none;
    }

    /* Loading */
    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 4px 8px;
    }
    .typing-dot {
      width: 6px;
      height: 6px;
      background: #9ca3af;
      border-radius: 50%;
      animation: typing 1.4s infinite ease-in-out both;
    }
    .typing-dot:nth-child(1) { animation-delay: -0.32s; }
    .typing-dot:nth-child(2) { animation-delay: -0.16s; }
    
    @keyframes typing {
      0%, 80%, 100% { transform: scale(0); }
      40% { transform: scale(1); }
    }

    /* Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: #d1d5db;
      border-radius: 3px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #9ca3af;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #9ca3af;
      text-align: center;
      padding: 32px;
      opacity: 0.6;
    }
  </style>
</head>
<body>
  <div class="chat-header">
    <div class="header-info">
      <div class="agent-avatar">AI</div>
      <div class="agent-details">
        <h3>${agentName}</h3>
        <div class="status-text">
          <span class="status-dot"></span>
          Typically replies instantly
        </div>
      </div>
    </div>
    <button class="close-btn" onclick="window.parent.postMessage('close-widget', '*')">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
    </button>
  </div>

  <div class="chat-messages" id="messages">
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 12px;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      <p>How can I help you today?</p>
    </div>
  </div>

  <div class="chat-input-container">
    <div class="input-wrapper">

      <textarea
        id="messageInput"
        class="chat-input"
        placeholder="Type a message..."
        rows="1"
      ></textarea>
      <button id="sendButton" class="icon-btn send-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
      </button>
    </div>
  </div>

  <script>
    const agentId = '${agentId}';
    const urlParams = new URLSearchParams(window.location.search);
    const apiKeyFromUrl = urlParams.get('apiKey');
    const apiKey = apiKeyFromUrl || '${apiKey || ""}';
    const apiUrl = '${API_BASE_URL}${API_PREFIX}';
    const messagesContainer = document.getElementById('messages');
    const messageInput = document.getElementById('messageInput');
    const sendButton = document.getElementById('sendButton');
    
    let isLoading = false;
    let messages = [];

    // Auto-resize textarea
    messageInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = Math.min(this.scrollHeight, 100) + 'px';
    });

    // Send on Enter
    messageInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendButton.addEventListener('click', sendMessage);

    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function addMessage(role, content) {
      messages.push({ role, content, timestamp: Date.now() });
      renderMessages();
    }

    function renderMessages() {
      if (messages.length === 0) return; // Keep empty state if no messages

      messagesContainer.innerHTML = messages.map((msg) => {
        const isUser = msg.role === 'user';
        const content = escapeHtml(msg.content).replace(/\\n/g, '<br>');
        
        // Markdown formatting
        const formatted = content
          .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
          .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
          .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
          .replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, '<pre><code>$1</code></pre>');

        const avatarInitial = isUser ? 'U' : 'AI';
        const groupClass = isUser ? 'user' : 'assistant';
        const avatarClass = isUser ? 'user' : 'assistant';

        // Only show avatar for assistant or user
        const avatarHtml = \`
          <div class="message-avatar \${avatarClass}">
            \${isUser ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>' : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path><path d="M19.07 4.93L17.66 6.34C17.66 6.34 16 9 12 9c-4 0-5.66-2.66-5.66-2.66L4.93 4.93a2 2 0 0 0-1.41 1.41C3.52 6.34 2 9.17 2 12s1.52 5.66 1.52 5.66l1.41 1.41a2 2 0 0 0 1.41 1.41L12 22l5.66-1.52a2 2 0 0 0 1.41-1.41l1.41-1.41c0 0 1.52-2.83 1.52-5.66s-1.52-5.66-1.52-5.66a2 2 0 0 0-1.41-1.41z"></path><circle cx="12" cy="12" r="2"></circle></svg>'}
          </div>
        \`;

        return \`
          <div class="message-group \${groupClass}">
            \${!isUser ? avatarHtml : ''}
            <div>
              <div class="message-bubble">
                \${formatted}
              </div>
              <div class="timestamp">\${formatTime(msg.timestamp)}</div>
            </div>
             \${isUser ? '' : ''} <!-- No avatar for user side to keep it clean -->
          </div>
        \`;
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
      
      if (!apiKey) {
        addMessage('assistant', '⚠️ Error: API key is required.');
        return;
      }

      addMessage('user', message);
      messageInput.value = '';
      messageInput.style.height = 'auto';
      messageInput.focus();
      
      isLoading = true;
      sendButton.disabled = true;
      
      // Add typing indicator
      const loadingId = 'loading-' + Date.now();
      const loadingHtml = \`
        <div class="message-group assistant" id="\${loadingId}">
          <div class="message-avatar assistant">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z"></path><path d="M19.07 4.93L17.66 6.34C17.66 6.34 16 9 12 9c-4 0-5.66-2.66-5.66-2.66L4.93 4.93a2 2 0 0 0-1.41 1.41C3.52 6.34 2 9.17 2 12s1.52 5.66 1.52 5.66l1.41 1.41a2 2 0 0 0 1.41 1.41L12 22l5.66-1.52a2 2 0 0 0 1.41-1.41l1.41-1.41c0 0 1.52-2.83 1.52-5.66s-1.52-5.66-1.52-5.66a2 2 0 0 0-1.41-1.41z"></path><circle cx="12" cy="12" r="2"></circle></svg>
          </div>
          <div class="message-bubble" style="padding: 12px 16px;">
            <div class="typing-indicator">
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
              <div class="typing-dot"></div>
            </div>
          </div>
        </div>
      \`;
      messagesContainer.insertAdjacentHTML('beforeend', loadingHtml);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;

      try {
        const response = await fetch(apiUrl + '/public/agents/' + agentId + '/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({ message }),
        });

        const data = await response.json();
        
        // Remove loading
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();

        if (data.success && data.data && data.data.response) {
          addMessage('assistant', data.data.response);
        } else {
          addMessage('assistant', '❌ Error: ' + (data.message || 'Unknown error'));
        }
      } catch (error) {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        addMessage('assistant', '❌ Network Error');
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
