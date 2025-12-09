/**
 * @file services/function.calling.service.ts
 * @description Service for AI function calling with tools
 * Orchestrates the flow: AI request → Tool execution → AI response
 */

import { geminiApi } from "../../integrations/gemini.api";
import { toolRegistry } from "../registry/tool.registry";
import { toolExecutor } from "../executor/tool.executor";
import { ToolExecutionContext, FunctionCallingResult, FunctionCall } from "../types";
import {
  Content,
  Part,
  FunctionDeclaration as SDKFunctionDeclaration,
} from "@google/generative-ai";
import logger from "../../config/logger";

// Constants for configuration
const DEFAULT_MAX_ITERATIONS = 5;
const DEFAULT_TEMPERATURE = 0.7;
const TOOL_INSTRUCTIONS = `
IMPORTANT INSTRUCTIONS:
1. You have access to tools that can retrieve information from the user's knowledge base.
2. When the user asks a question that might be answered by the knowledge base, you MUST use the search_knowledge tool first.
3. If you find relevant information using these tools, you MUST answer based on that information.
4. Do NOT answer from your own memory - always search the knowledge base first for factual questions.`;

/**
 * Function Calling Service
 * Handles the complete flow of function calling with AI agents
 */
export class FunctionCallingService {
  /**
   * Build the initial prompt with system instructions
   */
  private buildPrompt(systemPrompt: string, userMessage: string): string {
    return `${systemPrompt}${TOOL_INSTRUCTIONS}\n\nUser: ${userMessage}`;
  }

  /**
   * Create a result object with common fields
   */
  private createResult(
    response: string,
    toolsCalled: number,
    startTime: number,
    toolResults: Array<{ toolName: string; success: boolean; data?: unknown }>
  ): FunctionCallingResult {
    return {
      response,
      toolsCalled,
      executionTime: Date.now() - startTime,
      toolResults,
    };
  }

  /**
   * Execute function calls and collect results
   */
  private async executeFunctionCalls(
    functionCalls: Array<{ name: string; args: Record<string, unknown> }>,
    context: ToolExecutionContext,
    toolResults: Array<{ toolName: string; success: boolean; data?: unknown }>
  ): Promise<Array<{ name: string; response: Record<string, unknown> }>> {
    return Promise.all(
      functionCalls.map(async (fc) => {
        const result = await toolExecutor.executeFunctionCall(fc as FunctionCall, context);
        const success = this.isSuccessfulResponse(result.response);
        toolResults.push({ toolName: fc.name, success, data: result.response });
        // Ensure response is properly typed as Record<string, unknown>
        const response =
          result.response && typeof result.response === "object"
            ? (result.response as Record<string, unknown>)
            : { result: result.response };
        return { name: fc.name, response };
      })
    );
  }

  /**
   * Check if a tool response indicates success
   */
  private isSuccessfulResponse(response: unknown): boolean {
    if (response && typeof response === "object" && "success" in response) {
      return (response as { success: boolean }).success;
    }
    return true; // Assume success for primitive responses
  }

  /**
   * Build chat history entries for function calls
   */
  private buildFunctionCallParts(
    functionCalls: Array<{ name: string; args: Record<string, unknown> }>
  ): Part[] {
    return functionCalls.map((fc) => ({
      functionCall: { name: fc.name, args: fc.args },
    })) as Part[];
  }

  /**
   * Build chat history entries for function responses
   */
  private buildFunctionResponseParts(
    functionResponses: Array<{ name: string; response: Record<string, unknown> }>
  ): Part[] {
    return functionResponses.map((fr) => ({
      functionResponse: { name: fr.name, response: fr.response as object },
    })) as Part[];
  }

  /**
   * Generate fallback response without tools
   */
  private async generateFallbackResponse(
    systemPrompt: string,
    userMessage: string
  ): Promise<string> {
    let responseText = "";
    for await (const chunk of geminiApi.generateContent(`${systemPrompt}\n\nUser: ${userMessage}`, {
      useCase: "rag",
    })) {
      responseText += chunk;
    }
    return responseText || "Sorry, I couldn't generate a response.";
  }

  /**
   * Chat with AI agent that can call tools
   * @param userMessage - User's message
   * @param context - Execution context (agent, user, tenant info)
   * @param systemPrompt - System prompt for AI
   * @param enabledTools - List of enabled tool names for this agent
   * @param maxIterations - Maximum number of tool calling iterations
   */
  async chatWithTools(
    userMessage: string,
    context: ToolExecutionContext,
    systemPrompt: string = "You are a helpful AI assistant.",
    enabledTools?: string[],
    maxIterations: number = DEFAULT_MAX_ITERATIONS
  ): Promise<FunctionCallingResult> {
    const startTime = Date.now();
    let toolsCalled = 0;
    const toolResults: Array<{ toolName: string; success: boolean; data?: unknown }> = [];

    try {
      // Get available tools
      const tools = enabledTools
        ? toolRegistry.getFunctionDeclarationsForAgent(enabledTools)
        : toolRegistry.getEnabledFunctionDeclarations();

      // Fallback to normal chat if no tools available
      if (tools.length === 0) {
        const response = await this.generateFallbackResponse(systemPrompt, userMessage);
        return this.createResult(response, 0, startTime, toolResults);
      }

      const initialPrompt = this.buildPrompt(systemPrompt, userMessage);
      const chatHistory: Content[] = [{ role: "user", parts: [{ text: initialPrompt }] }];

      // Initial AI request with tools
      let currentResponse = await geminiApi.generateContentWithTools(
        initialPrompt,
        tools as unknown as SDKFunctionDeclaration[],
        { useCase: "rag", temperature: DEFAULT_TEMPERATURE }
      );

      if (!currentResponse || typeof currentResponse !== "object") {
        throw new Error("Failed to get AI response");
      }

      // Function calling loop
      for (let iteration = 0; iteration < maxIterations; iteration++) {
        // Check if AI returned a complete text response
        if (currentResponse.isComplete || !currentResponse.functionCalls?.length) {
          break;
        }

        const functionCalls = currentResponse.functionCalls;
        logger.info("AI requested tool calls", {
          toolCount: functionCalls.length,
          tools: functionCalls.map((fc) => fc.name),
          iteration: iteration + 1,
        });

        // Execute function calls in parallel
        const functionResponses = await this.executeFunctionCalls(
          functionCalls,
          context,
          toolResults
        );
        toolsCalled += functionCalls.length;

        // Update chat history
        chatHistory.push({ role: "model", parts: this.buildFunctionCallParts(functionCalls) });
        chatHistory.push({
          role: "function",
          parts: this.buildFunctionResponseParts(functionResponses),
        });

        // Continue conversation with function results
        const continuedResponse = await geminiApi.continueWithFunctionResults(
          chatHistory,
          functionResponses,
          tools as unknown as SDKFunctionDeclaration[],
          { useCase: "rag", temperature: DEFAULT_TEMPERATURE }
        );

        logger.info("Chat with tools completed", {
          agentId: context.agentId,
          toolsCalled,
          iterations: iteration + 1,
          executionTime: Date.now() - startTime,
        });

        return this.createResult(continuedResponse, toolsCalled, startTime, toolResults);
      }

      // Return text response if AI didn't use tools
      if (currentResponse.text) {
        return this.createResult(currentResponse.text, toolsCalled, startTime, toolResults);
      }

      // Max iterations reached without resolution
      logger.warn("Max function calling iterations reached", { agentId: context.agentId });
      return this.createResult(
        "I apologize, but I've reached the maximum number of tool calls. Please try rephrasing your question.",
        toolsCalled,
        startTime,
        toolResults
      );
    } catch (error) {
      logger.error("Chat with tools error", {
        error: error instanceof Error ? error.message : "Unknown error",
        agentId: context.agentId,
      });

      // Fallback to normal chat on error
      try {
        const fallbackResponse = await this.generateFallbackResponse(systemPrompt, userMessage);
        return this.createResult(fallbackResponse, toolsCalled, startTime, toolResults);
      } catch {
        return this.createResult(
          "I'm sorry, I encountered an error processing your request.",
          toolsCalled,
          startTime,
          toolResults
        );
      }
    }
  }
}

/** Global function calling service instance */
export const functionCallingService = new FunctionCallingService();
