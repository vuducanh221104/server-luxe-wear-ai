/**
 * @file tool.registry.test.ts
 * @description Unit tests for tool registry
 */

import { ToolRegistry } from "../../../src/tools/registry/tool.registry";

// Mock allFunctionCallingTools
jest.mock("../../../src/tools/tools", () => ({
  allFunctionCallingTools: [
    {
      name: "test_tool_1",
      description: "Test tool 1 description",
      schema: require("zod").z.object({
        query: require("zod").z.string().describe("Query parameter"),
      }),
      handler: jest.fn().mockResolvedValue({ success: true }),
      permission: "public",
      enabled: true,
      category: "test",
    },
    {
      name: "test_tool_2",
      description: "Test tool 2 description",
      schema: require("zod").z.object({
        id: require("zod").z.string().describe("ID parameter"),
      }),
      handler: jest.fn().mockResolvedValue({ success: true }),
      permission: "public",
      enabled: true,
      category: "test",
    },
    {
      name: "disabled_tool",
      description: "Disabled tool description",
      schema: require("zod").z.object({
        data: require("zod").z.string().describe("Data parameter"),
      }),
      handler: jest.fn().mockResolvedValue({ success: true }),
      permission: "public",
      enabled: false,
      category: "test",
    },
  ],
}));

// Mock logger
jest.mock("../../../src/config/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

describe("ToolRegistry", () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new ToolRegistry();
  });

  describe("constructor", () => {
    it("should initialize with tools from allFunctionCallingTools", () => {
      expect(registry.hasTool("test_tool_1")).toBe(true);
      expect(registry.hasTool("test_tool_2")).toBe(true);
      expect(registry.hasTool("disabled_tool")).toBe(true);
    });
  });

  describe("getTool", () => {
    it("should return tool by name", () => {
      const tool = registry.getTool("test_tool_1");

      expect(tool).toBeDefined();
      expect(tool?.name).toBe("test_tool_1");
      expect(tool?.description).toBe("Test tool 1 description");
    });

    it("should return undefined for non-existent tool", () => {
      const result = registry.getTool("non_existent");

      expect(result).toBeUndefined();
    });
  });

  describe("hasTool", () => {
    it("should return true for existing tool", () => {
      expect(registry.hasTool("test_tool_1")).toBe(true);
    });

    it("should return false for non-existent tool", () => {
      expect(registry.hasTool("non_existent")).toBe(false);
    });
  });

  describe("getEnabledTools", () => {
    it("should return only enabled tools", () => {
      const enabledTools = registry.getEnabledTools();

      expect(enabledTools).toHaveLength(2);
      expect(enabledTools.map((t) => t.name)).toContain("test_tool_1");
      expect(enabledTools.map((t) => t.name)).toContain("test_tool_2");
      expect(enabledTools.map((t) => t.name)).not.toContain("disabled_tool");
    });
  });

  describe("getFunctionDeclaration", () => {
    it("should return function declaration for existing tool", () => {
      const declaration = registry.getFunctionDeclaration("test_tool_1");

      expect(declaration).toBeDefined();
      expect(declaration?.name).toBe("test_tool_1");
      expect(declaration?.description).toBe("Test tool 1 description");
      expect(declaration?.parameters).toBeDefined();
      expect(declaration?.parameters.type).toBe("object");
    });

    it("should return undefined for non-existent tool", () => {
      const declaration = registry.getFunctionDeclaration("non_existent");

      expect(declaration).toBeUndefined();
    });

    it("should include required parameters in declaration", () => {
      const declaration = registry.getFunctionDeclaration("test_tool_1");

      expect(declaration?.parameters.properties).toHaveProperty("query");
      expect(declaration?.parameters.required).toContain("query");
    });
  });

  describe("getEnabledFunctionDeclarations", () => {
    it("should return declarations only for enabled tools", () => {
      const declarations = registry.getEnabledFunctionDeclarations();

      expect(declarations).toHaveLength(2);
      expect(declarations.map((d) => d.name)).toContain("test_tool_1");
      expect(declarations.map((d) => d.name)).toContain("test_tool_2");
      expect(declarations.map((d) => d.name)).not.toContain("disabled_tool");
    });
  });

  describe("getToolsForAgent", () => {
    it("should return tools matching given names", () => {
      const tools = registry.getToolsForAgent(["test_tool_1", "test_tool_2"]);

      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toContain("test_tool_1");
      expect(tools.map((t) => t.name)).toContain("test_tool_2");
    });

    it("should filter out non-existent tool names", () => {
      const tools = registry.getToolsForAgent(["test_tool_1", "non_existent"]);

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("test_tool_1");
    });

    it("should filter out disabled tools", () => {
      const tools = registry.getToolsForAgent(["test_tool_1", "disabled_tool"]);

      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe("test_tool_1");
    });

    it("should return empty array for non-matching names", () => {
      const tools = registry.getToolsForAgent(["non_existent1", "non_existent2"]);

      expect(tools).toHaveLength(0);
    });
  });

  describe("getFunctionDeclarationsForAgent", () => {
    it("should return declarations matching given names", () => {
      const declarations = registry.getFunctionDeclarationsForAgent(["test_tool_1", "test_tool_2"]);

      expect(declarations).toHaveLength(2);
      expect(declarations.map((d) => d.name)).toContain("test_tool_1");
      expect(declarations.map((d) => d.name)).toContain("test_tool_2");
    });

    it("should filter out non-existent tool names", () => {
      const declarations = registry.getFunctionDeclarationsForAgent([
        "test_tool_1",
        "non_existent",
      ]);

      expect(declarations).toHaveLength(1);
      expect(declarations[0].name).toBe("test_tool_1");
    });
  });

  describe("getAllToolNames", () => {
    it("should return all tool names", () => {
      const names = registry.getAllToolNames();

      expect(names).toContain("test_tool_1");
      expect(names).toContain("test_tool_2");
      expect(names).toContain("disabled_tool");
      expect(names).toHaveLength(3);
    });
  });
});
