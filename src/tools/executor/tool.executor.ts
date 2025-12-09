/**
 * @file executor/tool.executor.ts
 * @description Tool executor for function calling tools
 * Handles tool execution, permission checks, and error handling
 */

import {
  MCPTool,
  ToolExecutionContext,
  FunctionCall,
  FunctionResponse,
  ToolPermission,
} from "../types";
import { toolRegistry } from "../registry/tool.registry";
import logger from "../../config/logger";

// Permission check result type
interface PermissionResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Tool Executor Class
 * Executes function calling tools with proper context and permission checks
 */
export class ToolExecutor {
  /**
   * Create error response helper
   */
  private createErrorResponse(name: string, error: string): FunctionResponse {
    return { name, response: { success: false, error } };
  }

  /**
   * Execute a function call from Gemini
   */
  async executeFunctionCall(
    functionCall: FunctionCall,
    context: ToolExecutionContext
  ): Promise<FunctionResponse> {
    const startTime = Date.now();
    const { name, args } = functionCall;

    try {
      // Get and validate tool
      const tool = toolRegistry.getTool(name);
      if (!tool) {
        return this.createErrorResponse(name, `Tool not found: ${name}`);
      }

      if (!tool.enabled) {
        return this.createErrorResponse(name, `Tool is disabled: ${name}`);
      }

      // Check permissions
      const permissionCheck = this.checkPermission(tool, context);
      if (!permissionCheck.allowed) {
        return this.createErrorResponse(name, permissionCheck.reason || "Permission denied");
      }

      // Execute tool
      const result = await tool.handler(args, context);

      logger.info("Tool executed", {
        toolName: name,
        success: result.success,
        executionTime: Date.now() - startTime,
      });

      return { name, response: result };
    } catch (error) {
      logger.error("Tool execution error", {
        toolName: name,
        error: error instanceof Error ? error.message : "Unknown error",
        executionTime: Date.now() - startTime,
      });

      return this.createErrorResponse(
        name,
        error instanceof Error ? error.message : "Tool execution failed"
      );
    }
  }

  /**
   * Execute multiple function calls in parallel for better performance
   */
  async executeFunctionCalls(
    functionCalls: FunctionCall[],
    context: ToolExecutionContext
  ): Promise<FunctionResponse[]> {
    return Promise.all(functionCalls.map((call) => this.executeFunctionCall(call, context)));
  }

  /**
   * Check if user has permission to execute tool
   */
  private checkPermission(tool: MCPTool, context: ToolExecutionContext): PermissionResult {
    const { permission } = tool;
    const { userId } = context;

    switch (permission) {
      case ToolPermission.PUBLIC:
        return { allowed: true };

      case ToolPermission.AUTHENTICATED:
        return userId ? { allowed: true } : { allowed: false, reason: "Authentication required" };

      case ToolPermission.ADMIN:
        // Note: Currently allows any authenticated user. In production, check user.role === 'admin'
        return userId ? { allowed: true } : { allowed: false, reason: "Admin access required" };

      case ToolPermission.CUSTOM:
        // Note: Custom permission checks can be added here based on tool-specific requirements
        return { allowed: true };

      default:
        return { allowed: false, reason: "Unknown permission level" };
    }
  }

  /**
   * Get available tools for context
   */
  getAvailableTools(context: ToolExecutionContext, enabledToolNames?: string[]): MCPTool[] {
    const tools = enabledToolNames?.length
      ? toolRegistry.getToolsForAgent(enabledToolNames)
      : toolRegistry.getEnabledTools();

    return tools.filter((tool) => this.checkPermission(tool, context).allowed);
  }
}

/** Global tool executor instance */
export const toolExecutor = new ToolExecutor();
