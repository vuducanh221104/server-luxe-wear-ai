/**
 * @file function.calling.service.test.ts
 * @description Unit tests for function calling service
 */

// Mock dependencies BEFORE importing the service
const mockGenerateContent = jest.fn();
const mockGenerateContentWithTools = jest.fn();
const mockContinueWithFunctionResults = jest.fn();

jest.mock("../../../src/integrations/gemini.api", () => ({
  geminiApi: {
    generateContent: mockGenerateContent,
    generateContentWithTools: mockGenerateContentWithTools,
    continueWithFunctionResults: mockContinueWithFunctionResults,
  },
}));

const mockGetEnabledFunctionDeclarations = jest.fn();
const mockGetFunctionDeclarationsForAgent = jest.fn();
jest.mock("../../../src/tools/registry/tool.registry", () => ({
  toolRegistry: {
    getEnabledFunctionDeclarations: mockGetEnabledFunctionDeclarations,
    getFunctionDeclarationsForAgent: mockGetFunctionDeclarationsForAgent,
  },
}));

const mockExecuteFunctionCall = jest.fn();
jest.mock("../../../src/tools/executor/tool.executor", () => ({
  toolExecutor: {
    executeFunctionCall: mockExecuteFunctionCall,
  },
}));

jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

// Now import the service after mocks are set up
import { FunctionCallingService } from "../../../src/tools/services/function.calling.service";

describe("FunctionCallingService", () => {
  let service: FunctionCallingService;
  const mockContext = {
    agentId: "agent-1",
    tenantId: "tenant-1",
    userId: "user-1",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FunctionCallingService();

    // Default mock setup
    mockGetEnabledFunctionDeclarations.mockReturnValue([]);
    mockGetFunctionDeclarationsForAgent.mockReturnValue([]);
  });

  describe("chatWithTools", () => {
    it("should return response without tool calls when no tools available", async () => {
      mockGetEnabledFunctionDeclarations.mockReturnValue([]);

      // Mock async generator
      async function* generateResponse() {
        yield "Hello, ";
        yield "how can I help?";
      }
      mockGenerateContent.mockReturnValue(generateResponse());

      const result = await service.chatWithTools(
        "Hello",
        mockContext,
        "You are a helpful assistant"
      );

      expect(result.response).toBe("Hello, how can I help?");
      expect(result.toolsCalled).toBe(0);
      expect(result.toolResults).toEqual([]);
    });

    it("should include execution time in result", async () => {
      async function* generateResponse() {
        yield "Response";
      }
      mockGenerateContent.mockReturnValue(generateResponse());

      const result = await service.chatWithTools("Test", mockContext, "System prompt");

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it("should handle empty response gracefully", async () => {
      async function* generateResponse() {
        // Empty response
      }
      mockGenerateContent.mockReturnValue(generateResponse());

      const result = await service.chatWithTools("Test", mockContext, "System prompt");

      expect(result.response).toBe("Sorry, I couldn't generate a response.");
      expect(result.toolsCalled).toBe(0);
    });

    it("should use agent-specific tools when enabledTools provided", async () => {
      const mockDeclarations = [
        { name: "search_knowledge", description: "Search", parameters: {} },
      ];
      mockGetFunctionDeclarationsForAgent.mockReturnValue(mockDeclarations);

      // Return complete response (no function calls)
      mockGenerateContentWithTools.mockResolvedValue({
        isComplete: true,
        text: "Here is the result",
      });

      await service.chatWithTools(
        "Search for something",
        mockContext,
        "System prompt",
        ["search_knowledge"] // enabledTools is just a string array
      );

      expect(mockGetFunctionDeclarationsForAgent).toHaveBeenCalledWith(["search_knowledge"]);
    });

    it("should handle tool execution in function calling loop", async () => {
      const mockDeclarations = [
        { name: "search_knowledge", description: "Search", parameters: {} },
      ];
      mockGetEnabledFunctionDeclarations.mockReturnValue(mockDeclarations);

      // First call returns function calls
      mockGenerateContentWithTools.mockResolvedValue({
        isComplete: false,
        functionCalls: [{ name: "search_knowledge", args: { query: "test" } }],
      });

      // Mock tool execution
      mockExecuteFunctionCall.mockResolvedValue({
        name: "search_knowledge",
        response: { success: true, data: { results: ["result1"] } },
      });

      // Continue returns final response
      mockContinueWithFunctionResults.mockResolvedValue("I found the results");

      const result = await service.chatWithTools("Search", mockContext, "System prompt");

      expect(result.toolsCalled).toBe(1);
      expect(mockExecuteFunctionCall).toHaveBeenCalled();
      expect(result.response).toBe("I found the results");
    });

    it("should handle complete response without function calls", async () => {
      const mockDeclarations = [
        { name: "search_knowledge", description: "Search", parameters: {} },
      ];
      mockGetEnabledFunctionDeclarations.mockReturnValue(mockDeclarations);

      mockGenerateContentWithTools.mockResolvedValue({
        isComplete: true,
        text: "Direct answer without tools",
      });

      const result = await service.chatWithTools("Simple question", mockContext, "System prompt");

      expect(result.toolsCalled).toBe(0);
      expect(result.response).toBe("Direct answer without tools");
    });

    it("should fallback gracefully on error", async () => {
      const mockDeclarations = [
        { name: "search_knowledge", description: "Search", parameters: {} },
      ];
      mockGetEnabledFunctionDeclarations.mockReturnValue(mockDeclarations);

      // First call fails
      mockGenerateContentWithTools.mockRejectedValue(new Error("API Error"));

      // Fallback should work
      async function* generateFallback() {
        yield "Fallback response";
      }
      mockGenerateContent.mockReturnValue(generateFallback());

      const result = await service.chatWithTools("Test", mockContext, "System prompt");

      expect(result.response).toBe("Fallback response");
    });

    it("should handle max iterations", async () => {
      const mockDeclarations = [{ name: "search", description: "Search", parameters: {} }];
      mockGetEnabledFunctionDeclarations.mockReturnValue(mockDeclarations);

      // Always return function calls (never complete)
      mockGenerateContentWithTools.mockResolvedValue({
        isComplete: false,
        functionCalls: [{ name: "search", args: { query: "test" } }],
      });

      mockExecuteFunctionCall.mockResolvedValue({
        name: "search",
        response: { success: true, data: {} },
      });

      mockContinueWithFunctionResults.mockResolvedValue("Partial response");

      // Should stop after reaching a response
      const result = await service.chatWithTools(
        "Test",
        mockContext,
        "System prompt",
        undefined,
        3
      );

      expect(result).toBeDefined();
      expect(result.toolsCalled).toBeGreaterThanOrEqual(1);
    });
  });

  describe("error handling", () => {
    it("should handle missing tools gracefully", async () => {
      mockGetEnabledFunctionDeclarations.mockReturnValue([]);

      async function* generateResponse() {
        yield "Response without tools";
      }
      mockGenerateContent.mockReturnValue(generateResponse());

      const result = await service.chatWithTools("Test", mockContext, "System prompt");

      expect(result).toBeDefined();
      expect(result.response).toBe("Response without tools");
    });

    it("should handle missing context gracefully", async () => {
      async function* generateResponse() {
        yield "Response";
      }
      mockGenerateContent.mockReturnValue(generateResponse());

      const minimalContext = {
        agentId: "agent-1",
        tenantId: "tenant-1",
      };

      const result = await service.chatWithTools("Test", minimalContext, "System prompt");

      expect(result).toBeDefined();
      expect(result.response).toBe("Response");
    });
  });

  describe("tool results tracking", () => {
    it("should track tool execution results", async () => {
      const mockDeclarations = [{ name: "search", description: "Search", parameters: {} }];
      mockGetEnabledFunctionDeclarations.mockReturnValue(mockDeclarations);

      mockGenerateContentWithTools.mockResolvedValue({
        isComplete: false,
        functionCalls: [{ name: "search", args: { query: "test" } }],
      });

      mockExecuteFunctionCall.mockResolvedValue({
        name: "search",
        response: { success: true, data: { results: ["item1", "item2"] } },
      });

      mockContinueWithFunctionResults.mockResolvedValue("Found results");

      const result = await service.chatWithTools("Search", mockContext, "System prompt");

      expect(result.toolResults).toBeDefined();
      expect(result.toolResults!.length).toBe(1);
      expect(result.toolResults![0].toolName).toBe("search");
      expect(result.toolResults![0].success).toBe(true);
    });

    it("should track failed tool executions", async () => {
      const mockDeclarations = [{ name: "failing_tool", description: "Fails", parameters: {} }];
      mockGetEnabledFunctionDeclarations.mockReturnValue(mockDeclarations);

      mockGenerateContentWithTools.mockResolvedValue({
        isComplete: false,
        functionCalls: [{ name: "failing_tool", args: {} }],
      });

      mockExecuteFunctionCall.mockResolvedValue({
        name: "failing_tool",
        response: { success: false, error: "Tool failed" },
      });

      mockContinueWithFunctionResults.mockResolvedValue("Sorry, tool failed");

      const result = await service.chatWithTools("Test", mockContext, "System prompt");

      expect(result.toolResults).toBeDefined();
      expect(result.toolResults!.length).toBe(1);
      expect(result.toolResults![0].success).toBe(false);
    });
  });
});
