/**
 * @file registry/tool.registry.ts
 * @description Tool registry for function calling tools
 * Manages tool registration, lookup, and function declaration generation
 */

import { MCPTool, FunctionDeclaration, ToolRegistryEntry, PropertySchema } from "../types";
import { allFunctionCallingTools } from "../tools";
import logger from "../../config/logger";
import { z } from "zod";

/**
 * Tool Registry Class
 * Manages all available function calling tools and their function declarations
 */
export class ToolRegistry {
  private tools: Map<string, ToolRegistryEntry> = new Map();

  constructor() {
    this.registerTools(allFunctionCallingTools);
  }

  /**
   * Register tools in the registry
   */
  private registerTools(tools: MCPTool[]): void {
    for (const tool of tools) {
      const functionDeclaration = this.generateFunctionDeclaration(tool);
      this.tools.set(tool.name, {
        tool,
        functionDeclaration,
      });

      logger.debug(`Registered tool: ${tool.name}`, {
        category: tool.category,
        permission: tool.permission,
        enabled: tool.enabled,
      });
    }

    logger.info(`Tool registry initialized with ${this.tools.size} tools`);
  }

  /**
   * Generate Gemini-compatible function declaration from Zod schema
   */
  private generateFunctionDeclaration(tool: MCPTool): FunctionDeclaration {
    const zodSchema = tool.schema as z.ZodObject<z.ZodRawShape>;
    const shape = zodSchema.shape;

    const properties: Record<string, PropertySchema> = {};
    const required: string[] = [];

    // Convert Zod schema to Gemini function declaration format
    for (const [key, zodType] of Object.entries(shape)) {
      const zodDef = (zodType as z.ZodTypeAny)._def;

      // Determine if required
      if (zodDef.typeName !== "ZodOptional" && zodDef.typeName !== "ZodDefault") {
        required.push(key);
      }

      // Extract property schema
      properties[key] = this.zodToPropertySchema(zodType as z.ZodTypeAny);
    }

    return {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: "object",
        properties,
        required: required.length > 0 ? required : undefined,
      },
    };
  }

  /**
   * Convert Zod type to Property Schema
   */
  private zodToPropertySchema(zodType: z.ZodTypeAny): PropertySchema {
    const zodDef = zodType._def;

    // Handle optional/default
    if (zodDef.typeName === "ZodOptional" || zodDef.typeName === "ZodDefault") {
      return this.zodToPropertySchema(zodDef.innerType);
    }

    // Get description if available
    const description = zodDef.description || "No description";

    switch (zodDef.typeName) {
      case "ZodString":
        return {
          type: "string",
          description,
        };

      case "ZodNumber":
        return {
          type: "number",
          description,
        };

      case "ZodBoolean":
        return {
          type: "boolean",
          description,
        };

      case "ZodEnum":
        return {
          type: "string",
          description,
          enum: zodDef.values,
        };

      case "ZodArray":
        return {
          type: "array",
          description,
          items: this.zodToPropertySchema(zodDef.type),
        };

      case "ZodObject": {
        const shape = zodDef.shape();
        const properties: Record<string, PropertySchema> = {};
        for (const [key, value] of Object.entries(shape)) {
          properties[key] = this.zodToPropertySchema(value as z.ZodTypeAny);
        }
        return {
          type: "object",
          description,
          properties,
        };
      }

      case "ZodRecord":
        return {
          type: "object",
          description,
        };

      default:
        logger.warn(`Unknown Zod type: ${zodDef.typeName}, defaulting to string`);
        return {
          type: "string",
          description,
        };
    }
  }

  /**
   * Get tool by name
   */
  public getTool(name: string): MCPTool | undefined {
    return this.tools.get(name)?.tool;
  }

  /**
   * Get function declaration by tool name
   */
  public getFunctionDeclaration(name: string): FunctionDeclaration | undefined {
    return this.tools.get(name)?.functionDeclaration;
  }

  /**
   * Get all enabled tools
   */
  public getEnabledTools(): MCPTool[] {
    return Array.from(this.tools.values())
      .filter((entry) => entry.tool.enabled)
      .map((entry) => entry.tool);
  }

  /**
   * Get all enabled function declarations
   */
  public getEnabledFunctionDeclarations(): FunctionDeclaration[] {
    return Array.from(this.tools.values())
      .filter((entry) => entry.tool.enabled)
      .map((entry) => entry.functionDeclaration);
  }

  /**
   * Get tools filtered by agent configuration
   */
  public getToolsForAgent(enabledToolNames: string[]): MCPTool[] {
    return enabledToolNames
      .map((name) => this.getTool(name))
      .filter((tool): tool is MCPTool => tool !== undefined && tool.enabled);
  }

  /**
   * Get function declarations filtered by agent configuration
   */
  public getFunctionDeclarationsForAgent(enabledToolNames: string[]): FunctionDeclaration[] {
    return enabledToolNames
      .map((name) => this.getFunctionDeclaration(name))
      .filter((decl): decl is FunctionDeclaration => decl !== undefined);
  }

  /**
   * Get all tool names
   */
  public getAllToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if tool exists
   */
  public hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}

/**
 * Global tool registry instance
 */
export const toolRegistry = new ToolRegistry();
