/**
 * @file tools/index.ts
 * @description Central export for all function calling tools
 * Aggregates tools from all categories
 */

import { MCPTool } from "../types";
import { knowledgeTools } from "./knowledge.tools";

/**
 * All available function calling tools
 */
export const allFunctionCallingTools: MCPTool[] = [...knowledgeTools];

/**
 * Get tools by category
 */
export function getToolsByCategory(category: string): MCPTool[] {
  return allFunctionCallingTools.filter((tool) => tool.category === category);
}

/**
 * Get enabled tools only
 */
export function getEnabledTools(): MCPTool[] {
  return allFunctionCallingTools.filter((tool) => tool.enabled);
}

/**
 * Get tool by name
 */
export function getToolByName(name: string): MCPTool | undefined {
  return allFunctionCallingTools.find((tool) => tool.name === name);
}

/**
 * Export individual tool categories
 */
export { knowledgeTools };
