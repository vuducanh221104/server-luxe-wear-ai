/**
 * @file agent.service.test.ts
 * @description Unit tests for AgentService
 */

import { AgentService } from "../../../src/services/agent.service";
import { supabaseAdmin } from "../../../src/config/supabase";

// Mock dependencies
jest.mock("../../../src/config/supabase", () => ({
  supabaseAdmin: {
    from: jest.fn(),
  },
}));

jest.mock("../../../src/config/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}));

jest.mock("../../../src/utils/apiKey", () => ({
  generateApiKey: jest.fn(() => "test-api-key-12345"),
}));

describe("AgentService", () => {
  let agentService: AgentService;

  const mockAgent = {
    id: "agent-1",
    name: "Test Agent",
    description: "A test agent",
    owner_id: "user-1",
    tenant_id: "tenant-1",
    config: { model: "gemini-pro" },
    api_key: "test-api-key",
    is_public: false,
    allowed_origins: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    agentService = new AgentService();
    jest.clearAllMocks();
  });

  describe("createAgent", () => {
    it("should create agent successfully", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockAgent, error: null }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await agentService.createAgent(
        "user-1",
        { name: "Test Agent", description: "A test agent" },
        "tenant-1"
      );

      expect(result).toEqual(mockAgent);
    });

    it("should throw error if agent name already exists", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest
                  .fn()
                  .mockResolvedValue({ data: { id: "existing-agent" }, error: null }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      await expect(
        agentService.createAgent("user-1", { name: "Test Agent" }, "tenant-1")
      ).rejects.toThrow("Agent name already exists");
    });

    it("should throw error on database failure", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: "Database error" },
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      await expect(
        agentService.createAgent("user-1", { name: "Test Agent" }, "tenant-1")
      ).rejects.toThrow("Database error");
    });
  });

  describe("getAgentById", () => {
    it("should return agent when found and user owns it", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockAgent, error: null }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await agentService.getAgentById("agent-1", "user-1", "tenant-1");

      expect(result).toEqual(mockAgent);
    });

    it("should throw error when agent not found", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { message: "Not found" },
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      await expect(agentService.getAgentById("agent-1", "user-1", "tenant-1")).rejects.toThrow(
        "Agent not found"
      );
    });

    it("should throw access denied when user doesn't own agent", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...mockAgent, owner_id: "other-user" },
                error: null,
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      await expect(agentService.getAgentById("agent-1", "user-1", "tenant-1")).rejects.toThrow(
        "Access denied"
      );
    });
  });

  describe("listUserAgents", () => {
    it("should return paginated agent list", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: [mockAgent],
                  error: null,
                  count: 1,
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await agentService.listUserAgents("user-1", "tenant-1", 1, 10);

      expect(result.agents).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.totalCount).toBe(1);
    });

    it("should return empty list when no agents", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                  count: 0,
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await agentService.listUserAgents("user-1", "tenant-1");

      expect(result.agents).toHaveLength(0);
      expect(result.pagination.totalCount).toBe(0);
    });

    it("should throw error on database failure", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Database error" },
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      await expect(agentService.listUserAgents("user-1", "tenant-1")).rejects.toThrow(
        "Database error"
      );
    });
  });

  describe("updateAgent", () => {
    it("should update agent successfully", async () => {
      const updatedAgent = { ...mockAgent, name: "Updated Agent" };
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockAgent, error: null }),
            }),
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: updatedAgent, error: null }),
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await agentService.updateAgent("agent-1", "user-1", "tenant-1", {
        name: "Updated Agent",
      });

      expect(result.name).toBe("Updated Agent");
    });
  });

  describe("deleteAgent", () => {
    it("should delete agent successfully", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({ data: mockAgent, error: null }),
            }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      await expect(
        agentService.deleteAgent("agent-1", "user-1", "tenant-1")
      ).resolves.toBeUndefined();
    });
  });

  describe("getAgentStats", () => {
    it("should return agent statistics", async () => {
      const mockFrom = jest.fn((table: string) => {
        if (table === "agents") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({ data: mockAgent, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: 5 }),
          }),
        };
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await agentService.getAgentStats("agent-1", "user-1", "tenant-1");

      expect(result).toHaveProperty("knowledgeCount");
      expect(result).toHaveProperty("webhookCount");
      expect(result).toHaveProperty("lastActivity");
    });
  });

  describe("searchAgents", () => {
    it("should search agents by query", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: [mockAgent],
                error: null,
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await agentService.searchAgents("user-1", "tenant-1", "Test");

      expect(result.agents).toBeDefined();
    });

    it("should return all agents when query is empty", async () => {
      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                range: jest.fn().mockResolvedValue({
                  data: [mockAgent],
                  error: null,
                  count: 1,
                }),
              }),
            }),
          }),
        }),
      });
      (supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom);

      const result = await agentService.searchAgents("user-1", "tenant-1", "");

      expect(result.agents).toHaveLength(1);
    });
  });
});
