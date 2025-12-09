/**
 * @file tools/knowledge.tools.ts
 * @description Function calling tools for knowledge base operations
 * These tools allow AI agents to search and retrieve information from their knowledge bases
 */

import {
  MCPTool,
  ToolCategory,
  ToolPermission,
  ToolExecutionContext,
  ToolResult,
  SearchKnowledgeArgs,
  SearchKnowledgeArgsSchema,
} from "../types";
import { vectorService } from "../../services/vector.service";
import { knowledgeService } from "../../services/knowledge.service";
import logger from "../../config/logger";
import { z } from "zod";

// Constants
const DEFAULT_SEARCH_LIMIT = 5;
const MAX_LIST_LIMIT = 50;

/**
 * Helper: Create success result
 */
const createSuccessResult = (
  data: unknown,
  startTime: number,
  source: string,
  cached = false
): ToolResult => ({
  success: true,
  data,
  metadata: { executionTime: Date.now() - startTime, source, cached },
});

/**
 * Helper: Create error result
 */
const createErrorResult = (error: unknown, startTime: number): ToolResult => ({
  success: false,
  error: error instanceof Error ? error.message : "Unknown error",
  metadata: { executionTime: Date.now() - startTime },
});

/**
 * Search Knowledge Tool
 * Performs semantic search in the agent's knowledge base using Pinecone
 */
export const searchKnowledgeTool: MCPTool = {
  name: "search_knowledge",
  description:
    "Search the knowledge base using semantic search. Returns relevant documents, FAQs, or information that matches the query. Use this when you need to find specific information to answer customer questions.",
  category: ToolCategory.KNOWLEDGE,
  permission: ToolPermission.PUBLIC,
  enabled: true,
  schema: SearchKnowledgeArgsSchema,

  async handler(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { query, limit = DEFAULT_SEARCH_LIMIT } = SearchKnowledgeArgsSchema.parse(
        args
      ) as SearchKnowledgeArgs;

      // Search knowledge base using vector search
      const results = await vectorService.searchKnowledge(
        query,
        context.userId,
        context.tenantId,
        limit
      );

      // Format results for AI consumption
      const formattedResults = results.map((result, index) => ({
        rank: index + 1,
        content: result.metadata?.content || "",
        title: result.metadata?.title || `Result ${index + 1}`,
        score: Math.round((result.score || 0) * 100) / 100,
        source: result.metadata?.source || "knowledge_base",
      }));

      logger.info("search_knowledge completed", {
        agentId: context.agentId,
        resultsCount: formattedResults.length,
        executionTime: Date.now() - startTime,
      });

      return createSuccessResult(
        { results: formattedResults, total_results: formattedResults.length, query },
        startTime,
        "pinecone_vector_db"
      );
    } catch (error) {
      logger.error("search_knowledge error", {
        error: error instanceof Error ? error.message : "Unknown error",
        agentId: context.agentId,
      });
      return createErrorResult(error, startTime);
    }
  },
};

/**
 * Get Knowledge by ID Tool
 * Retrieves specific knowledge entry by ID
 */
const GetKnowledgeByIdArgsSchema = z.object({
  knowledge_id: z.string().uuid().describe("Knowledge entry ID"),
});

export const getKnowledgeByIdTool: MCPTool = {
  name: "get_knowledge_by_id",
  description:
    "Get a specific knowledge entry by its ID. Use this when you need the full details of a particular knowledge item.",
  category: ToolCategory.KNOWLEDGE,
  permission: ToolPermission.PUBLIC,
  enabled: true,
  schema: GetKnowledgeByIdArgsSchema,

  async handler(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { knowledge_id } = GetKnowledgeByIdArgsSchema.parse(args);

      const knowledge = await knowledgeService.getKnowledgeById(
        knowledge_id,
        context.userId || "",
        context.tenantId
      );

      if (!knowledge) {
        return createErrorResult(new Error("Knowledge entry not found"), startTime);
      }

      return createSuccessResult(
        {
          id: knowledge.id,
          title: knowledge.title,
          file_name: knowledge.file_name,
          file_type: knowledge.file_type,
          file_url: knowledge.file_url,
          created_at: knowledge.created_at,
          metadata: knowledge.metadata,
        },
        startTime,
        "supabase_database"
      );
    } catch (error) {
      logger.error("get_knowledge_by_id error", {
        error: error instanceof Error ? error.message : "Unknown error",
        agentId: context.agentId,
      });
      return createErrorResult(error, startTime);
    }
  },
};

/**
 * List Agent Knowledge Tool
 * Lists all knowledge entries for the current agent
 */
const ListAgentKnowledgeArgsSchema = z.object({
  limit: z.number().optional().default(10).describe("Number of entries to return (max 50)"),
  page: z.number().optional().default(1).describe("Page number for pagination"),
});

export const listAgentKnowledgeTool: MCPTool = {
  name: "list_agent_knowledge",
  description:
    "List all knowledge entries available to this agent. Use this to see what information the agent has access to.",
  category: ToolCategory.KNOWLEDGE,
  permission: ToolPermission.PUBLIC,
  enabled: true,
  schema: ListAgentKnowledgeArgsSchema,

  async handler(args: unknown, context: ToolExecutionContext): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      const { limit, page } = ListAgentKnowledgeArgsSchema.parse(args);
      const safeLimit = Math.min(limit, MAX_LIST_LIMIT);

      const result = await knowledgeService.listKnowledge(context.userId || "", context.tenantId, {
        agentId: context.agentId,
        limit: safeLimit,
        page,
      });

      return createSuccessResult(
        {
          knowledge_entries: result.knowledge.map((k) => ({
            id: k.id,
            title: k.title,
            file_name: k.file_name,
            file_type: k.file_type,
            created_at: k.created_at,
          })),
          pagination: result.pagination,
        },
        startTime,
        "supabase_database"
      );
    } catch (error) {
      logger.error("list_agent_knowledge error", {
        error: error instanceof Error ? error.message : "Unknown error",
        agentId: context.agentId,
      });
      return createErrorResult(error, startTime);
    }
  },
};

/** Export all knowledge tools */
export const knowledgeTools: MCPTool[] = [
  searchKnowledgeTool,
  getKnowledgeByIdTool,
  listAgentKnowledgeTool,
];
