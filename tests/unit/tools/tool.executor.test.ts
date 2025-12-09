/**
 * @file tool.executor.test.ts
 * @description Unit tests for tool executor
 */

import { ToolExecutor } from "../../../src/tools/executor/tool.executor";
import {
  FunctionCall,
  ToolExecutionContext,
  ToolPermission,
  ToolCategory,
} from "../../../src/tools/types";
import { z } from "zod";

// Mock tool registry
const mockGetTool = jest.fn();
jest.mock("../../../src/tools/registry/tool.registry", () => ({
  toolRegistry: {
    getTool: (name: string) => mockGetTool(name),
  },
}));

// Mock logger
jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe("ToolExecutor", () => {
  let executor: ToolExecutor;

  const mockContext: ToolExecutionContext = {
    agentId: "agent-1",
    userId: "user-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
  };

  const createMockTool = (
    name: string,
    permission: ToolPermission = ToolPermission.PUBLIC,
    enabled: boolean = true
  ) => ({
    name,
    description: `${name} description`,
    category: ToolCategory.KNOWLEDGE,
    permission,
    enabled,
    schema: z.object({
      query: z.string(),
    }),
    handler: jest.fn().mockResolvedValue({ success: true, data: { result: "test" } }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    executor = new ToolExecutor();
  });

  describe("executeFunctionCall", () => {
    it("should execute a valid function call successfully", async () => {
      const mockTool = createMockTool("search_knowledge");
      mockGetTool.mockReturnValue(mockTool);

      const functionCall: FunctionCall = {
        name: "search_knowledge",
        args: { query: "test query" },
      };

      const result = await executor.executeFunctionCall(functionCall, mockContext);

      expect(result.name).toBe("search_knowledge");
      expect(result.response.success).toBe(true);
      expect(result.response.data).toEqual({ result: "test" });
      expect(mockTool.handler).toHaveBeenCalledWith({ query: "test query" }, mockContext);
    });

    it("should return error for non-existent tool", async () => {
      mockGetTool.mockReturnValue(undefined);

      const functionCall: FunctionCall = {
        name: "non_existent_tool",
        args: {},
      };

      const result = await executor.executeFunctionCall(functionCall, mockContext);

      expect(result.name).toBe("non_existent_tool");
      expect(result.response.success).toBe(false);
      expect(result.response.error).toContain("Tool not found");
    });

    it("should return error for disabled tool", async () => {
      const mockTool = createMockTool("disabled_tool", ToolPermission.PUBLIC, false);
      mockGetTool.mockReturnValue(mockTool);

      const functionCall: FunctionCall = {
        name: "disabled_tool",
        args: {},
      };

      const result = await executor.executeFunctionCall(functionCall, mockContext);

      expect(result.response.success).toBe(false);
      expect(result.response.error).toContain("disabled");
    });

    it("should check permissions for authenticated tools", async () => {
      const mockTool = createMockTool("auth_tool", ToolPermission.AUTHENTICATED);
      mockGetTool.mockReturnValue(mockTool);

      // Context without userId
      const contextWithoutUser: ToolExecutionContext = {
        agentId: "agent-1",
        tenantId: "tenant-1",
      };

      const functionCall: FunctionCall = {
        name: "auth_tool",
        args: { query: "test" },
      };

      const result = await executor.executeFunctionCall(functionCall, contextWithoutUser);

      expect(result.response.success).toBe(false);
      expect(result.response.error).toContain("Authentication required");
    });

    it("should allow authenticated tools when user is present", async () => {
      const mockTool = createMockTool("auth_tool", ToolPermission.AUTHENTICATED);
      mockGetTool.mockReturnValue(mockTool);

      const functionCall: FunctionCall = {
        name: "auth_tool",
        args: { query: "test" },
      };

      const result = await executor.executeFunctionCall(functionCall, mockContext);

      expect(result.response.success).toBe(true);
    });

    it("should handle tool execution errors", async () => {
      const mockTool = createMockTool("error_tool");
      mockTool.handler = jest.fn().mockRejectedValue(new Error("Execution failed"));
      mockGetTool.mockReturnValue(mockTool);

      const functionCall: FunctionCall = {
        name: "error_tool",
        args: { query: "test" },
      };

      const result = await executor.executeFunctionCall(functionCall, mockContext);

      expect(result.response.success).toBe(false);
      expect(result.response.error).toBe("Execution failed");
    });

    it("should handle non-Error exceptions", async () => {
      const mockTool = createMockTool("weird_error_tool");
      mockTool.handler = jest.fn().mockRejectedValue("string error");
      mockGetTool.mockReturnValue(mockTool);

      const functionCall: FunctionCall = {
        name: "weird_error_tool",
        args: { query: "test" },
      };

      const result = await executor.executeFunctionCall(functionCall, mockContext);

      expect(result.response.success).toBe(false);
      expect(result.response.error).toBe("Tool execution failed");
    });
  });

  describe("executeFunctionCalls", () => {
    it("should execute multiple function calls in parallel", async () => {
      const mockTool1 = createMockTool("tool1");
      const mockTool2 = createMockTool("tool2");

      mockGetTool.mockImplementation((name: string) => {
        if (name === "tool1") return mockTool1;
        if (name === "tool2") return mockTool2;
        return undefined;
      });

      const functionCalls: FunctionCall[] = [
        { name: "tool1", args: { query: "query1" } },
        { name: "tool2", args: { query: "query2" } },
      ];

      const results = await executor.executeFunctionCalls(functionCalls, mockContext);

      expect(results).toHaveLength(2);
      expect(results[0].name).toBe("tool1");
      expect(results[1].name).toBe("tool2");
      expect(mockTool1.handler).toHaveBeenCalled();
      expect(mockTool2.handler).toHaveBeenCalled();
    });

    it("should handle empty function calls array", async () => {
      const results = await executor.executeFunctionCalls([], mockContext);

      expect(results).toHaveLength(0);
    });

    it("should handle mixed success and failure", async () => {
      const mockTool1 = createMockTool("success_tool");
      const mockTool2 = createMockTool("fail_tool");
      mockTool2.handler = jest.fn().mockRejectedValue(new Error("Failed"));

      mockGetTool.mockImplementation((name: string) => {
        if (name === "success_tool") return mockTool1;
        if (name === "fail_tool") return mockTool2;
        return undefined;
      });

      const functionCalls: FunctionCall[] = [
        { name: "success_tool", args: { query: "q1" } },
        { name: "fail_tool", args: { query: "q2" } },
      ];

      const results = await executor.executeFunctionCalls(functionCalls, mockContext);

      expect(results).toHaveLength(2);
      expect(results[0].response.success).toBe(true);
      expect(results[1].response.success).toBe(false);
    });
  });

  describe("admin permission", () => {
    it("should deny admin tools for unauthenticated users", async () => {
      const mockTool = createMockTool("admin_tool", ToolPermission.ADMIN);
      mockGetTool.mockReturnValue(mockTool);

      // Context without userId (unauthenticated)
      const unauthenticatedContext: ToolExecutionContext = {
        agentId: "agent-1",
        tenantId: "tenant-1",
      };

      const functionCall: FunctionCall = {
        name: "admin_tool",
        args: { query: "test" },
      };

      const result = await executor.executeFunctionCall(functionCall, unauthenticatedContext);

      expect(result.response.success).toBe(false);
      expect(result.response.error).toContain("Admin access required");
    });

    it("should allow admin tools for authenticated users", async () => {
      const mockTool = createMockTool("admin_tool", ToolPermission.ADMIN);
      mockGetTool.mockReturnValue(mockTool);

      // Context with userId (authenticated)
      const authenticatedContext: ToolExecutionContext = {
        agentId: "agent-1",
        userId: "user-1",
        tenantId: "tenant-1",
      };

      const functionCall: FunctionCall = {
        name: "admin_tool",
        args: { query: "test" },
      };

      const result = await executor.executeFunctionCall(functionCall, authenticatedContext);

      expect(result.response.success).toBe(true);
    });
  });
});
