/**
 * @file config/mcp.config.ts
 * @description Global MCP configuration
 */

// Re-export MCP_PROTOCOL_VERSION from shared types
export { MCP_PROTOCOL_VERSION } from "../types/shared.types";

/**
 * Global MCP Settings
 */
export const MCPConfig = {
  // Function Calling Settings
  functionCalling: {
    maxIterations: 5,
    defaultTemperature: 0.7,
    fallbackEnabled: true,
  },

  // Server Settings
  server: {
    name: "luxe-wear-ai-platform",
    version: "1.0.0",
    description: "MCP Server for Platform AI Agent Management",
  },
};
